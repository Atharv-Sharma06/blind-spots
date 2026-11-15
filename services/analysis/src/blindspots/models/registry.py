"""Model registry: training configuration, per-group GP fits and versioned artifacts.

Layout written by `save_registry` (repo root `models/`):

    models/LATEST                              one line: model_version
    models/<model_version>/manifest.json
    models/<model_version>/validation.json     (when validation was run)
    models/<model_version>/groups/<group_id>.json   GP `to_dict` + metadata (no timestamps: hashes are stable)
    models/retrospective/<dataset_version>.json     written by another task, loaded when present

`load_registry` re-solves each Laplace mode from the stored data and hyperparameters (deterministic).
"""

from __future__ import annotations

import hashlib
import json
import math
from concurrent.futures import ProcessPoolExecutor
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from blindspots.config import MODELS_DIR, NORMALIZED_DIR
from blindspots.models.features import TrainingSet, build_training_set
from blindspots.models.gp_laplace import GPLaplaceClassifier
from blindspots.models.groups import (
    assign_group_ids,
    group_label,
    modelability,
    parse_group_id,
)

MODEL_FAMILY = "gp-laplace-v1"
MEAN_CHOICES = ("constant", "linear_o2")


class ArtifactMissing(FileNotFoundError):
    """Raised when a model artifact (or the dataset it needs) is absent."""


def _default_priors() -> dict[str, list[float]]:
    # Same as GPLaplaceClassifier defaults (log-normal MAP-II priors: [mu_log, sd_log]); written out so
    # they are part of the config hash.
    return {
        "l_o2": [round(math.log(3.0), 10), 0.75],
        "l_flow": [0.0, 0.75],
        "signal_var": [round(math.log(4.0), 10), 0.75],
        "b0": [0.0, 3.0],
        "b1": [0.0, 1.0],
    }


@dataclass(frozen=True)
class TrainConfig:
    """Everything that determines the trained artifacts (hashed into model_version)."""

    pressure_length_scale: float = 0.3  # ln-pressure units; FIXED (pressure barely varies in the data)
    priors: dict[str, list[float]] = field(default_factory=_default_priors)
    n_restarts: int = 8
    seed: int = 0
    training_confidence: tuple[str, ...] = ("high", "medium")
    min_group_rows: int = 1  # optional extra row floor (modelability rule itself lives in models.groups)
    cv_k_max: int = 5
    cv_repeats: int = 5
    cv_seeds: tuple[int, ...] = (0, 1, 2, 3, 4)
    n_bootstrap: int = 1000  # group-bootstrap draws for metric CIs
    ensemble_members: int = 200
    n_permutations: int = 2000
    loeo_refit_budget_s: float = 480.0  # soft budget for leave-one-experiment-out per group set
    # Constant mean only, fixed a priori (docs/decisions.d/lead-review-fixes.md): choosing the mean on the
    # same CV folds that produce the reported metrics biased them, and the linear-in-O2 mean extrapolated
    # to confident predictions far from the data. "linear_o2" remains available for sensitivity runs.
    mean_options: tuple[str, ...] = ("constant",)
    only_groups: tuple[str, ...] | None = None  # restrict (tests / smoke runs); part of the hash

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        for k in ("training_confidence", "cv_seeds", "mean_options"):
            d[k] = list(d[k])
        d["only_groups"] = None if self.only_groups is None else list(self.only_groups)
        return d

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> TrainConfig:
        kw = dict(d)
        for k in ("training_confidence", "cv_seeds", "mean_options"):
            if k in kw:
                kw[k] = tuple(kw[k])
        if kw.get("only_groups") is not None:
            kw["only_groups"] = tuple(kw["only_groups"])
        return cls(**kw)

    def canonical_json(self) -> str:
        return json.dumps(self.to_dict(), sort_keys=True, separators=(",", ":"))

    def config_hash(self) -> str:
        return hashlib.sha256(self.canonical_json().encode()).hexdigest()[:6]

    def gp_factory(
        self, mean: str, seed: int | None = None, n_restarts: int | None = None
    ) -> GPLaplaceClassifier:
        priors = {k: (v[0], v[1]) for k, v in self.priors.items() if k != "b1" or mean == "linear_o2"}
        return GPLaplaceClassifier(
            [3.0, 1.0, self.pressure_length_scale],
            signal_var=4.0,
            mean=mean,
            fixed=("l_p",),
            priors=priors,
            n_restarts=self.n_restarts if n_restarts is None else n_restarts,
            seed=self.seed if seed is None else seed,
        )


def make_model_version(dataset_version: str, config: TrainConfig) -> str:
    return f"{MODEL_FAMILY}+{dataset_version[:8]}.{config.config_hash()}"


@dataclass
class GroupModel:
    group_id: str
    material_family: str
    flame_configuration: str
    label: str
    training_set: dict[str, Any]
    model: GPLaplaceClassifier | None
    model_status: str  # "modeled" | "insufficient_data"
    model_reason: str | None
    mean_function: str | None
    hyperparameters: dict[str, float] | None
    metrics_summary: dict[str, Any]


@dataclass
class Registry:
    model_version: str
    dataset_version: str
    config: TrainConfig
    groups: dict[str, GroupModel]
    validation: dict[str, Any] | None = None
    retrospective: dict[str, Any] | None = None
    trained_at: str | None = None
    timings_s: dict[str, float] = field(default_factory=dict)


# ------------------------------------------------------------------------------------------ data access
def load_dataset(normalized_dir: Path = NORMALIZED_DIR) -> tuple[pd.DataFrame, pd.DataFrame, str]:
    """(observations, experiments, dataset_version) from data/normalized."""
    version_file = normalized_dir / "VERSION"
    if not version_file.is_file():
        raise ArtifactMissing(f"dataset not built: {version_file} is missing")
    try:
        obs = pd.read_parquet(normalized_dir / "observations.parquet")
        exp = pd.read_parquet(normalized_dir / "experiments.parquet")
    except OSError as exc:
        raise ArtifactMissing(f"normalized tables missing in {normalized_dir}") from exc
    return obs, exp, version_file.read_text(encoding="utf-8").strip()


def _flags(value: Any) -> list[str]:
    if value is None:
        return []
    try:
        return [str(v) for v in value]
    except TypeError:
        return []


def group_frame(
    observations: pd.DataFrame,
    group_id: str,
    config: TrainConfig,
    *,
    add_low_confidence: bool = False,
    o2_initial_only: bool = False,
    experiments: pd.DataFrame | None = None,
    drop_flags: tuple[str, ...] = (),
) -> pd.DataFrame:
    """Training rows of one group under the documented filter (plus optional sensitivity variants).

    Base filter: included_in_training, label present, confidence in config.training_confidence, all three
    coordinates present. `add_low_confidence` adds rows whose only exclusion reason is low confidence;
    `o2_initial_only` replaces interpolated O2 by the experiment's initial O2; `drop_flags` removes rows
    carrying any of those quality flags.
    """
    obs = observations.copy()
    obs["group_id"] = assign_group_ids(obs)
    obs = obs.loc[obs["group_id"] == group_id]
    keep = obs["included_in_training"].astype(bool)
    if add_low_confidence:
        keep |= obs["exclusion_reason"].eq("low_confidence")
    allowed = set(config.training_confidence) | ({"low"} if add_low_confidence else set())
    keep &= obs["confidence"].isin(allowed) & obs["label"].notna()
    obs = obs.loc[keep].copy()
    if o2_initial_only and experiments is not None:
        init = experiments.set_index("experiment_id")["oxygen_percent_initial"]
        repl = obs["experiment_id"].map(init)
        obs["oxygen_percent"] = repl.where(repl.notna(), obs["oxygen_percent"])
    if drop_flags:
        bad = obs["quality_flags"].map(lambda v: any(f in set(_flags(v)) for f in drop_flags))
        obs = obs.loc[~bad]
    obs["included_in_training"] = True
    cols = ["oxygen_percent", "airflow_cm_s", "pressure_for_analysis_kpa"]
    return obs.loc[obs[cols].notna().all(axis=1)]


def group_training_set(frame: pd.DataFrame, group_id: str) -> TrainingSet:
    family, configuration = parse_group_id(group_id)
    return build_training_set(frame, family, configuration)


def side_info(frame: pd.DataFrame, ts: TrainingSet) -> dict[str, np.ndarray]:
    """Per-row confidence and flag arrays aligned with a TrainingSet built from `frame`."""
    idx = frame.set_index("observation_id")
    sel = idx.loc[list(ts.observation_ids)]
    flags = [set(_flags(v)) for v in sel["quality_flags"]]
    return {
        "confidence": sel["confidence"].to_numpy(dtype=str),
        "flow_off_transient": np.array(["flow_off_transient" in f for f in flags]),
        "extinction_mode": sel["extinction_mode"].fillna("").to_numpy(dtype=str),
    }


def describe_training_set(ts: TrainingSet, frame: pd.DataFrame, config: TrainConfig) -> dict[str, Any]:
    n1 = int((ts.y == 1).sum())
    n0 = int((ts.y == 0).sum())
    pressure = ts.X[:, 2]
    return {
        "n_observations": ts.n,
        "n_experiments": ts.n_groups,
        "label_counts": {"sustained": n1, "not_sustained": n0},
        "sustained_fraction": (n1 / ts.n) if ts.n else None,
        "campaigns": sorted(set(ts.campaign_group.tolist())),
        "confidence_included": list(config.training_confidence),
        "filters": [
            "included_in_training",
            "label not null",
            f"confidence in {list(config.training_confidence)}",
            "oxygen, airflow and analysis pressure present",
        ],
        "oxygen_percent_range": _rng(ts.X[:, 0]),
        "airflow_cm_s_range": _rng(np.expm1(ts.X[:, 1])),
        "z_p_range": _rng(pressure),
        "n_flow_off_transient": int(
            frame["quality_flags"].map(lambda v: "flow_off_transient" in _flags(v)).sum()
        )
        if len(frame)
        else 0,
    }


def _rng(a: np.ndarray) -> list[float] | None:
    return [float(np.min(a)), float(np.max(a))] if a.size else None


# --------------------------------------------------------------------------------------------- training
def _fit_group_job(args: tuple[str, pd.DataFrame, pd.DataFrame, TrainConfig]) -> dict[str, Any]:
    """Worker: choose the mean function by grouped-CV log loss and fit the final GP for one group."""
    from blindspots.evaluation.validation import choose_mean_function

    group_id, obs, _exp, config = args
    frame = group_frame(obs, group_id, config)
    ts = group_training_set(frame, group_id) if len(frame) else None
    verdict = modelability(frame)
    out: dict[str, Any] = {
        "group_id": group_id,
        "status": verdict.status,
        "reason": verdict.reason,
        "frame_rows": len(frame),
    }
    if ts is None or verdict.status != "modeled":
        out["training_set"] = describe_training_set(ts, frame, config) if ts is not None else {}
        return out
    selection = choose_mean_function(ts, config)
    mean = selection["chosen"]
    model = config.gp_factory(mean).fit(ts.X, ts.y)
    out.update(
        {
            "training_set": describe_training_set(ts, frame, config),
            "mean_function": mean,
            "mean_selection": selection,
            "model": model.to_dict(),
        }
    )
    return out


def train_registry(
    config: TrainConfig | None = None,
    observations: pd.DataFrame | None = None,
    experiments: pd.DataFrame | None = None,
    dataset_version: str | None = None,
    workers: int = 1,
) -> Registry:
    """Select the mean function per modelable group by grouped CV and fit the final GP on all its rows."""
    import time

    config = config or TrainConfig()
    if observations is None or experiments is None or dataset_version is None:
        obs_df, exp_df, dsv = load_dataset()
        observations = obs_df if observations is None else observations
        experiments = exp_df if experiments is None else experiments
        dataset_version = dsv if dataset_version is None else dataset_version
    t0 = time.time()
    obs = observations.copy()
    obs["group_id"] = assign_group_ids(obs)
    group_ids = sorted(str(g) for g in obs["group_id"].dropna().unique())
    if config.only_groups is not None:
        group_ids = [g for g in group_ids if g in config.only_groups]
    jobs = [(g, obs, experiments, config) for g in group_ids]
    if workers > 1 and len(jobs) > 1:
        with ProcessPoolExecutor(max_workers=min(workers, len(jobs))) as pool:
            results = list(pool.map(_fit_group_job, jobs))
    else:
        results = [_fit_group_job(j) for j in jobs]
    groups: dict[str, GroupModel] = {}
    for res in results:
        gid = res["group_id"]
        family, configuration = parse_group_id(gid)
        model = GPLaplaceClassifier.from_dict(res["model"]) if "model" in res else None
        groups[gid] = GroupModel(
            group_id=gid,
            material_family=family,
            flame_configuration=configuration,
            label=group_label(family, configuration),
            training_set=res["training_set"],
            model=model,
            model_status=res["status"],
            model_reason=res["reason"],
            mean_function=res.get("mean_function"),
            hyperparameters=None if model is None else model.hyperparameters(),
            metrics_summary={"mean_selection": res.get("mean_selection")} if model is not None else {},
        )
    return Registry(
        model_version=make_model_version(dataset_version, config),
        dataset_version=dataset_version,
        config=config,
        groups=groups,
        trained_at=datetime.now(UTC).isoformat(timespec="seconds"),
        timings_s={"fit": round(time.time() - t0, 1)},
    )


# ------------------------------------------------------------------------------------------ persistence
def _dump(obj: Any) -> str:
    return json.dumps(obj, indent=2, sort_keys=True, ensure_ascii=False, default=_json_default) + "\n"


def _json_default(o: Any) -> Any:
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.floating):
        return None if not np.isfinite(o) else float(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    if isinstance(o, np.bool_):
        return bool(o)
    raise TypeError(f"not JSON serialisable: {type(o)}")


def clean_json(obj: Any) -> Any:
    """Recursively replace NaN/inf by None so output is strict JSON."""
    if isinstance(obj, dict):
        return {k: clean_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [clean_json(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return clean_json(obj.tolist())
    if isinstance(obj, (np.floating, float)):
        return None if not math.isfinite(float(obj)) else float(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj


def group_to_dict(gm: GroupModel) -> dict[str, Any]:
    return clean_json(
        {
            "group_id": gm.group_id,
            "material_family": gm.material_family,
            "flame_configuration": gm.flame_configuration,
            "label": gm.label,
            "training_set": gm.training_set,
            "model_status": gm.model_status,
            "model_reason": gm.model_reason,
            "mean_function": gm.mean_function,
            "hyperparameters": gm.hyperparameters,
            "metrics_summary": gm.metrics_summary,
            "gp": None if gm.model is None else gm.model.to_dict(),
        }
    )


def group_from_dict(d: dict[str, Any]) -> GroupModel:
    return GroupModel(
        group_id=d["group_id"],
        material_family=d["material_family"],
        flame_configuration=d["flame_configuration"],
        label=d["label"],
        training_set=d["training_set"],
        model=None if d.get("gp") is None else GPLaplaceClassifier.from_dict(d["gp"]),
        model_status=d["model_status"],
        model_reason=d.get("model_reason"),
        mean_function=d.get("mean_function"),
        hyperparameters=d.get("hyperparameters"),
        metrics_summary=d.get("metrics_summary", {}),
    )


def save_registry(reg: Registry, models_dir: Path = MODELS_DIR) -> Path:
    """Write the versioned artifact directory and update LATEST. Returns the version directory."""
    vdir = models_dir / reg.model_version
    (vdir / "groups").mkdir(parents=True, exist_ok=True)
    hashes: dict[str, str] = {}
    for gid, gm in sorted(reg.groups.items()):
        text = _dump(group_to_dict(gm))
        (vdir / "groups" / f"{gid}.json").write_text(text, encoding="utf-8")
        hashes[gid] = hashlib.sha256(text.encode()).hexdigest()
    manifest = {
        "model_version": reg.model_version,
        "dataset_version": reg.dataset_version,
        "algorithm": "GP classifier (logit link, Laplace approximation, ARD SE kernel, MAP-II)",
        "config": reg.config.to_dict(),
        "groups": {
            gid: {
                "model_status": gm.model_status,
                "model_reason": gm.model_reason,
                "mean_function": gm.mean_function,
                "n_observations": gm.training_set.get("n_observations"),
                "n_experiments": gm.training_set.get("n_experiments"),
                "sha256": hashes[gid],
            }
            for gid, gm in sorted(reg.groups.items())
        },
        "group_hashes": hashes,
        "has_validation": reg.validation is not None,
        "trained_at": reg.trained_at,
        "timings_s": reg.timings_s,
    }
    (vdir / "manifest.json").write_text(_dump(clean_json(manifest)), encoding="utf-8")
    if reg.validation is not None:
        (vdir / "validation.json").write_text(_dump(clean_json(reg.validation)), encoding="utf-8")
    models_dir.mkdir(parents=True, exist_ok=True)
    (models_dir / "LATEST").write_text(reg.model_version + "\n", encoding="utf-8")
    return vdir


def load_registry(models_dir: Path = MODELS_DIR, model_version: str | None = None) -> Registry:
    """Load LATEST (or a named version). Modes are re-solved deterministically from stored data."""
    latest = models_dir / "LATEST"
    if model_version is None:
        if not latest.is_file():
            raise ArtifactMissing(f"no trained models: {latest} is missing")
        model_version = latest.read_text(encoding="utf-8").strip()
    vdir = models_dir / model_version
    manifest_path = vdir / "manifest.json"
    if not manifest_path.is_file():
        raise ArtifactMissing(f"model artifact missing: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    groups: dict[str, GroupModel] = {}
    for gid in manifest["group_hashes"]:
        gpath = vdir / "groups" / f"{gid}.json"
        if not gpath.is_file():
            raise ArtifactMissing(f"model artifact missing: {gpath}")
        groups[gid] = group_from_dict(json.loads(gpath.read_text(encoding="utf-8")))
    vpath = vdir / "validation.json"
    validation = json.loads(vpath.read_text(encoding="utf-8")) if vpath.is_file() else None
    retro_path = models_dir / "retrospective" / f"{manifest['dataset_version']}.json"
    retrospective = json.loads(retro_path.read_text(encoding="utf-8")) if retro_path.is_file() else None
    return Registry(
        model_version=manifest["model_version"],
        dataset_version=manifest["dataset_version"],
        config=TrainConfig.from_dict(manifest["config"]),
        groups=groups,
        validation=validation,
        retrospective=retrospective,
        trained_at=manifest.get("trained_at"),
        timings_s=manifest.get("timings_s", {}),
    )
