"""Model registry access, pressure-length-scale variants and vectorised verdicts/reasons for query points."""

from __future__ import annotations

from collections import OrderedDict
from threading import Lock
from typing import Any

import numpy as np

from blindspots import config
from blindspots.api import deps
from blindspots.api.errors import ApiError
from blindspots.config import COVERAGE_SCALES
from blindspots.coverage.coverage import count_within, inside_hull, nn_distance
from blindspots.models.gp_laplace import GPLaplaceClassifier
from blindspots.models.registry import MODEL_FAMILY, ArtifactMissing, GroupModel, Registry, load_registry
from blindspots.uncertainty.explanations import VERDICT_SENTENCES

PRESSURE_LS_SENSITIVITY = [0.15, 0.3, 0.6]
SPARSE_MIN_COUNT = 3
PRESSURE_FEATURES = [
    "oxygen_percent",
    "ln(1 + airflow_cm_s)",
    "ln(total_pressure_kpa / 101.325)",
]


def full_registry() -> Registry:
    """The trained registry (GP states re-solved once per process), or 503 artifact_missing."""
    version = config.model_version()
    if version is None:
        raise ApiError(
            503,
            "artifact_missing",
            "No trained models (run `uv run blindspots train`).",
            {"artifact": "models"},
        )

    def build() -> Registry:
        return load_registry(config.MODELS_DIR, version)

    try:
        return deps._cached("model_registry_full", (str(config.MODELS_DIR), version), build)
    except ArtifactMissing as exc:
        raise ApiError(503, "artifact_missing", str(exc), {"artifact": "models"}) from exc


def group_model(group_id: str) -> GroupModel | None:
    """The fitted group model, or None when the group is not modelled (insufficient data / unknown)."""
    gm = full_registry().groups.get(group_id)
    if gm is None or gm.model is None or gm.model_status != "modeled":
        return None
    return gm


def trained_pressure_length_scale(model: GPLaplaceClassifier) -> float:
    return float(model.length_scales[2])


_LP_CACHE: OrderedDict[str, GPLaplaceClassifier] = OrderedDict()
_LP_LOCK = Lock()
_LP_CACHE_MAX = 32  # bounded: clients can request any pressure length scale in [0.05, 3]


def model_for_lp(gm: GroupModel, lp: float) -> GPLaplaceClassifier:
    """The group posterior with the pressure length scale replaced by ``lp`` (all else fixed)."""
    assert gm.model is not None
    if abs(trained_pressure_length_scale(gm.model) - lp) < 1e-12:
        return gm.model
    reg = full_registry()

    def build() -> GPLaplaceClassifier:
        assert gm.model is not None
        d = gm.model.to_dict()
        d["length_scales"][2] = float(lp)
        return GPLaplaceClassifier.from_dict(d)

    key = f"{config.MODELS_DIR}:{reg.model_version}:{id(reg)}:{gm.group_id}:{lp:.6f}"
    with _LP_LOCK:
        if key in _LP_CACHE:
            _LP_CACHE.move_to_end(key)
            return _LP_CACHE[key]
    model = build()
    with _LP_LOCK:
        _LP_CACHE[key] = model
        while len(_LP_CACHE) > _LP_CACHE_MAX:
            _LP_CACHE.popitem(last=False)
    return model


def model_id(group_id: str) -> str:
    return f"{MODEL_FAMILY}:{group_id}"


def observed_pressure_range_kpa(model: GPLaplaceClassifier) -> tuple[float, float]:
    assert model.X is not None
    p = config.P_REF_KPA * np.exp(model.X[:, 2])
    return float(p.min()), float(p.max())


def evidence_coords(model: GPLaplaceClassifier) -> np.ndarray:
    assert model.X is not None
    return np.asarray(model.X, dtype=float)


# --- point assessment ------------------------------------------------------------------------------


def assess_points(model: GPLaplaceClassifier, pts: np.ndarray) -> dict[str, np.ndarray]:
    u = model.uncertainty(pts)
    return {
        "p": np.asarray(u["p_mean"]),
        "latent_mean": np.asarray(u["latent_mean"]),
        "latent_std": np.asarray(u["latent_std"]),
        "ratio": np.asarray(u["latent_std_ratio"]),
        "epistemic": np.asarray(u["epistemic"]),
        "aleatoric": np.asarray(u["aleatoric"]),
        "total": np.asarray(u["total"]),
    }


def explain_points(
    pts: np.ndarray,
    obs: np.ndarray,
    ratio: np.ndarray,
    aleatoric: np.ndarray | None = None,
    total: np.ndarray | None = None,
) -> dict[str, Any]:
    """Vectorised form of ``uncertainty.explanations.explain_point`` (same thresholds and rules).

    Returns arrays ``count``, ``nn``, ``hull``, ``pressure_gap``, ``verdict`` and a per-point list of
    reasons ``{"code", "message", "value"}``.
    """
    x = np.atleast_2d(pts)
    o = np.asarray(obs, dtype=float).reshape(-1, 3)
    n = len(x)
    count = count_within(x, o)
    nn = nn_distance(x, o)
    hull = inside_hull(x, o)
    dp = np.min(np.abs(o[None, :, 2] - x[:, None, 2]), axis=1) if len(o) else np.full(n, np.nan)
    verdict = np.where(
        (hull | (count >= SPARSE_MIN_COUNT)) & (ratio < 0.6),
        "supported",
        np.where((count == 0) & (ratio > 0.85), "insufficient_evidence", "extrapolation"),
    )
    reasons: list[list[dict[str, Any]]] = []
    for i in range(n):
        r: list[dict[str, Any]] = []
        if count[i] < SPARSE_MIN_COUNT:
            r.append(
                {
                    "code": "sparse_observations",
                    "message": f"Only {int(count[i])} comparable observation(s) within one reference "
                    f"distance (fewer than {SPARSE_MIN_COUNT}).",
                    "value": float(count[i]),
                }
            )
        if not hull[i]:
            r.append(
                {
                    "code": "outside_hull",
                    "message": "The point lies outside the region spanned by the observed conditions.",
                    "value": None,
                }
            )
        if len(o) and dp[i] > COVERAGE_SCALES["p"]:
            r.append(
                {
                    "code": "unobserved_pressure",
                    "message": f"Nearest observed pressure differs by {dp[i]:.2f} in ln-pressure units "
                    f"(reference scale {COVERAGE_SCALES['p']}).",
                    "value": float(dp[i]),
                }
            )
        elif not len(o):
            r.append(
                {
                    "code": "unobserved_pressure",
                    "message": "No observations are available at any pressure.",
                    "value": None,
                }
            )
        if aleatoric is not None and total is not None and total[i] > 0:
            frac = float(aleatoric[i] / total[i])
            if frac > 0.6 and ratio[i] < 0.5:
                r.append(
                    {
                        "code": "outcome_variability",
                        "message": "Outcomes at similar conditions vary: aleatoric share of predictive "
                        f"uncertainty is {frac:.2f}.",
                        "value": frac,
                    }
                )
        reasons.append(r)
    return {
        "count": count,
        "nn": nn,
        "hull": hull,
        "pressure_gap": dp,
        "verdict": [str(v) for v in verdict],
        "reasons": reasons,
    }


def no_model_reason(status_reason: str | None) -> dict[str, Any]:
    msg = "No model is available for this analysis group (insufficient data); coverage is shown only."
    if status_reason:
        msg += f" Reason: {status_reason}."
    return {"code": "no_model", "message": msg, "value": None}


def verdict_sentence(verdict: str) -> str:
    return VERDICT_SENTENCES[verdict]
