"""Process-wide caches for normalized tables, manifests and the model registry.

Everything is loaded once per (path, version) key and re-loaded only when the dataset/model version files
change (tests point ``blindspots.config`` at temporary roots). Missing artifacts give a degraded mode:
``get_store()`` returns None and ``require_store()`` raises the 503 ``artifact_missing`` envelope.

Model registry layout (written by the training pipeline, read here): ``models/LATEST`` names a version
directory ``models/<version>/`` holding ``manifest.json`` (written by ``models.registry.save_registry``:
``model_version``, ``dataset_version``, ``trained_at``, ``config`` and per-group ``model_status`` /
``model_reason``) and optional ``validation.json`` (``GET /api/model/validation``).
"""

from __future__ import annotations

import csv
import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock
from typing import Any

import numpy as np
import pandas as pd

from blindspots import config
from blindspots.api.errors import ApiError
from blindspots.coverage.coverage import to_coords
from blindspots.models.groups import assign_group_ids, summarize_groups, training_rows

_LOCK = Lock()
_CACHE: dict[str, tuple[Any, Any]] = {}


def clean(value: Any) -> Any:
    """NaN/inf to None, numpy scalars to Python, recursively."""
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    if isinstance(value, list | tuple):
        return [clean(v) for v in value]
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def _cached(name: str, key: Any, build: Any) -> Any:
    with _LOCK:
        hit = _CACHE.get(name)
        if hit is not None and hit[0] == key:
            return hit[1]
    value = build()
    with _LOCK:
        _CACHE[name] = (key, value)
    return value


def clear_caches() -> None:
    with _LOCK:
        _CACHE.clear()


# --- dataset ---------------------------------------------------------------------------------------


@dataclass
class DataStore:
    dataset_version: str
    experiments: list[dict[str, Any]]
    observations: list[dict[str, Any]]
    investigations: list[dict[str, Any]]
    report: dict[str, Any]
    obs_df: pd.DataFrame
    exp_df: pd.DataFrame
    base_groups: list[dict[str, Any]]
    experiment_by_id: dict[str, dict[str, Any]] = field(default_factory=dict)
    obs_by_experiment: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    _coords: dict[str, tuple[np.ndarray, pd.DataFrame]] = field(default_factory=dict)

    def evidence(self, group_id: str) -> tuple[np.ndarray, pd.DataFrame]:
        """Training observations of a group with complete coordinates, and their analysis coordinates."""
        if group_id not in self._coords:
            rows = self.obs_df.loc[self.obs_df["group_id"] == group_id]
            rows = training_rows(rows)
            cols = ["oxygen_percent", "airflow_cm_s", "pressure_for_analysis_kpa"]
            rows = rows.dropna(subset=cols)
            coords = (
                to_coords(
                    rows["oxygen_percent"].to_numpy(float),
                    rows["pressure_for_analysis_kpa"].to_numpy(float),
                    rows["airflow_cm_s"].to_numpy(float),
                )
                if len(rows)
                else np.zeros((0, 3))
            )
            self._coords[group_id] = (coords, rows.reset_index(drop=True))
        return self._coords[group_id]


def _read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def _build_store() -> DataStore:
    norm = config.NORMALIZED_DIR
    version = config.dataset_version()
    assert version is not None
    experiments = _read_json(norm / "experiments.json")
    observations = _read_json(norm / "observations.json")
    investigations = _read_json(norm / "investigations.json")
    report_path = norm / "dataset_report.json"
    report = _read_json(report_path) if report_path.is_file() else {}
    exp_df = pd.DataFrame(experiments)
    obs_df = pd.DataFrame(observations)
    exp_gid = assign_group_ids(exp_df)
    obs_gid = assign_group_ids(obs_df)
    for rec, gid in zip(experiments, exp_gid, strict=True):
        rec["group_id"] = gid if isinstance(gid, str) else None
    for rec, gid in zip(observations, obs_gid, strict=True):
        rec["group_id"] = gid if isinstance(gid, str) else None
    obs_df["group_id"] = obs_gid
    exp_df["group_id"] = exp_gid
    store = DataStore(
        dataset_version=version,
        experiments=experiments,
        observations=observations,
        investigations=investigations,
        report=report,
        obs_df=obs_df,
        exp_df=exp_df,
        base_groups=summarize_groups(obs_df.drop(columns=["group_id"])) if len(obs_df) else [],
    )
    store.experiment_by_id = {e["experiment_id"]: e for e in experiments}
    for o in observations:
        store.obs_by_experiment.setdefault(o["experiment_id"], []).append(o)
    return store


def dataset_available() -> bool:
    """Cheap check (no loading): VERSION plus the three normalized JSON tables exist."""
    norm = config.NORMALIZED_DIR
    needed = ("experiments.json", "observations.json", "investigations.json")
    return config.dataset_version() is not None and all((norm / n).is_file() for n in needed)


def get_store() -> DataStore | None:
    """The cached normalized dataset, or None when it has not been built."""
    version = config.dataset_version()
    norm = config.NORMALIZED_DIR
    if version is None or not dataset_available():
        return None
    return _cached("store", (str(norm), version), _build_store)


def require_store() -> DataStore:
    store = get_store()
    if store is None:
        raise ApiError(
            503,
            "artifact_missing",
            "The normalized dataset has not been built (run `uv run blindspots build-dataset`).",
            {"artifact": "dataset"},
        )
    return store


# --- model registry --------------------------------------------------------------------------------


@dataclass
class Registry:
    version: str
    groups: dict[str, dict[str, Any]]
    trained_at: str | None
    dataset_version: str | None
    seeds: dict[str, Any] | None
    has_validation: bool
    directory: Path


def _seeds(cfg: Any) -> dict[str, Any] | None:
    if not isinstance(cfg, dict):
        return None
    found = {k: v for k, v in cfg.items() if "seed" in k}
    return found or None


def get_registry() -> Registry | None:
    version = config.model_version()
    if version is None:
        return None
    directory = config.MODELS_DIR / version

    def build() -> Registry:
        meta: dict[str, Any] = {}
        reg = directory / "manifest.json"
        if reg.is_file():
            try:
                loaded = _read_json(reg)
                meta = loaded if isinstance(loaded, dict) else {}
            except (OSError, ValueError):
                meta = {}
        return Registry(
            version=version,
            groups=dict(meta.get("groups") or {}),
            trained_at=meta.get("trained_at"),
            dataset_version=meta.get("dataset_version"),
            seeds=_seeds(meta.get("config")),
            has_validation=(directory / "validation.json").is_file(),
            directory=directory,
        )

    return _cached("registry", (str(config.MODELS_DIR), version), build)


def groups_with_status(store: DataStore) -> list[dict[str, Any]]:
    """Group summaries; ``model_status`` from the registry when it knows the group, else the rule."""
    registry = get_registry()

    def build() -> list[dict[str, Any]]:
        out = []
        for g in store.base_groups:
            g = dict(g)
            entry = registry.groups.get(g["group_id"]) if registry else None
            if entry and entry.get("model_status") in ("modeled", "insufficient_data"):
                g["model_status"] = entry["model_status"]
                g["model_reason"] = entry.get("model_reason")
            out.append(clean(g))
        return out

    key = (store.dataset_version, registry.version if registry else None)
    return _cached("groups", key, build)


def get_group(group_id: str, store: DataStore | None = None) -> dict[str, Any]:
    store = store or require_store()
    for g in groups_with_status(store):
        if g["group_id"] == group_id:
            return g
    raise ApiError(404, "not_found", f"Unknown analysis group {group_id!r}.", {"group_id": group_id})


def default_group_id(store: DataStore) -> str | None:
    """pmma_rod__stagnation if modelled, else the modelled group with the most training rows."""
    groups = groups_with_status(store)
    modelled = [g for g in groups if g["model_status"] == "modeled"]
    for g in modelled:
        if g["group_id"] == "pmma_rod__stagnation":
            return "pmma_rod__stagnation"
    if modelled:
        return str(max(modelled, key=lambda g: g["n_training"])["group_id"])
    return None


# --- manifests / context ---------------------------------------------------------------------------


def _manifest(name: str) -> Any:
    path = config.MANIFESTS_DIR / name
    if not path.is_file():
        return None
    return _cached(f"manifest:{name}", (str(path), path.stat().st_mtime_ns), lambda: _read_json(path))


def profiles_manifest() -> dict[str, Any]:
    data = _manifest("atmosphere_profiles.json")
    return data if isinstance(data, dict) else {"profiles": [], "ventilation": None}


def not_integrated_raw() -> list[dict[str, Any]]:
    data = _manifest("known_investigations_not_integrated.json")
    return data if isinstance(data, list) else []


def raw_files_manifest() -> dict[str, Any]:
    data = _manifest("raw_files.json")
    return data if isinstance(data, dict) else {}


def not_integrated_records() -> list[dict[str, Any]]:
    """API shape of the not-integrated investigations (sources = the documented condition quotes)."""
    out = []
    for r in not_integrated_raw():
        out.append(
            {
                "id": r["id"],
                "name": r.get("name", r["id"]),
                "agency": r.get("agency"),
                "platform": r.get("platform"),
                "years": r.get("years"),
                "oxygen_percent_range": r.get("o2_percent_range"),
                "pressure_kpa_range": r.get("pressure_kpa_range"),
                "flow_cm_s_range": r.get("flow_cm_s_range"),
                "data_availability": r.get("data_availability"),
                "reason_not_integrated": r.get("reason_not_integrated"),
                "sources": [
                    {"url": q.get("url"), "quote": q.get("quote")} for q in r.get("conditions_quotes", [])
                ],
            }
        )
    return out


def _num(text: str | None) -> float | None:
    if text is None or text.strip() == "":
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    return value if math.isfinite(value) else None


def ground_flammability_rows() -> list[dict[str, Any]]:
    folder = config.CURATION_DIR / "ground_flammability"
    files = sorted(folder.glob("*.csv")) if folder.is_dir() else []

    def build() -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for path in files:
            with path.open(encoding="utf-8", newline="") as fh:
                for r in csv.DictReader(fh):
                    rows.append(
                        {
                            "material": r.get("material", ""),
                            "total_pressure_kpa": _num(r.get("total_pressure_kpa")),
                            "oxygen_percent": _num(r.get("oxygen_percent")),
                            "result": r.get("result") or None,
                            "result_definition": r.get("result_definition") or None,
                            "source_title": r.get("source_title") or None,
                            "source_url": r.get("source_url") or None,
                            "ntrs_id": r.get("ntrs_id") or None,
                            "page": r.get("page") or None,
                            "table": r.get("table") or None,
                        }
                    )
        return rows

    return _cached("ground", tuple((str(p), p.stat().st_mtime_ns) for p in files), build)


def publication_point_rows() -> list[dict[str, str]]:
    path = config.CURATION_DIR / "publication_points.csv"
    if not path.is_file():
        return []

    def build() -> list[dict[str, str]]:
        with path.open(encoding="utf-8", newline="") as fh:
            return list(csv.DictReader(fh))

    return _cached("pubpoints", (str(path), path.stat().st_mtime_ns), build)
