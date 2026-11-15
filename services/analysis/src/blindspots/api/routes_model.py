"""Model-backed endpoints (docs/API.md): surface, predict, target/assess, candidates, model, brief."""

from __future__ import annotations

from collections import OrderedDict
from collections.abc import Callable
from threading import Lock
from typing import Any

import numpy as np
from fastapi import APIRouter, Query

from blindspots import config
from blindspots.api import deps
from blindspots.api.errors import ApiError
from blindspots.api.models import (
    AssessRequest,
    AssessResponse,
    BriefRequest,
    BriefResponse,
    CompareRequest,
    CompareResponse,
    CounterfactualRequest,
    CounterfactualResponse,
    ModelMetadata,
    Plane,
    PredictRequest,
    PredictResponse,
    RankRequest,
    RankResponse,
    SurfaceResponse,
    ValidationReport,
)
from blindspots.api.routes_data import axes_payload, resolve_plane_params
from blindspots.api.services import assess as assess_mod
from blindspots.api.services import brief as brief_mod
from blindspots.api.services import modeling, ranking
from blindspots.coverage.coverage import to_coords

router = APIRouter(prefix="/api")

_MEMO: OrderedDict[str, Any] = OrderedDict()
_MEMO_LOCK = Lock()
_MEMO_MAX = 512


def memo(name: str, request: Any, compute: Callable[[], Any]) -> Any:
    """Cache keyed by endpoint, canonical request and artifact versions (responses are deterministic)."""
    key = ranking.canonical(
        [
            name,
            str(config.NORMALIZED_DIR),
            config.dataset_version(),
            str(config.MODELS_DIR),
            config.model_version(),
            request,
        ]
    )
    with _MEMO_LOCK:
        if key in _MEMO:
            _MEMO.move_to_end(key)
            return _MEMO[key]
    value = compute()
    with _MEMO_LOCK:
        _MEMO[key] = value
        while len(_MEMO) > _MEMO_MAX:
            _MEMO.popitem(last=False)
    return value


def clear_memo() -> None:
    with _MEMO_LOCK:
        _MEMO.clear()


def _grid(a: np.ndarray, shape: tuple[int, int], nd: int = 5) -> list[list[float | None]]:
    return np.round(np.asarray(a, dtype=float).reshape(shape), nd).tolist()


# --- surface ---------------------------------------------------------------------------------------


@router.get("/surface", response_model=SurfaceResponse)
def surface(
    group: str,
    plane: Plane = "o2_flow",
    slice_value: float | None = Query(default=None, alias="slice"),
    nx: int = Query(default=61, ge=2, le=200),
    ny: int = Query(default=41, ge=2, le=200),
    x_min: float | None = None,
    x_max: float | None = None,
    y_min: float | None = None,
    y_max: float | None = None,
) -> dict[str, Any]:
    store = deps.require_store()
    deps.get_group(group, store)
    p = resolve_plane_params(plane, slice_value, nx, ny, x_min, x_max, y_min, y_max)
    request = {"g": group, "plane": plane, "p": {k: str(v) for k, v in p.items()}}
    return memo("surface", request, lambda: _surface(group, plane, p))


def _surface(group: str, plane: str, p: dict[str, Any]) -> dict[str, Any]:
    gm = modeling.group_model(group)
    x0, x1 = p["x_range"]
    y0, y1 = p["y_range"]
    xs = np.linspace(x0, x1, p["nx"])
    if plane == "o2_flow":
        ys = np.geomspace(y0, y1, p["ny"])
        gx, gy = np.meshgrid(xs, ys)
        pts = to_coords(gx.ravel(), p["slice_value"], gy.ravel())
    else:
        ys = np.linspace(y0, y1, p["ny"])
        gx, gy = np.meshgrid(xs, ys)
        pts = to_coords(gx.ravel(), gy.ravel(), p["slice_value"])
    shape = gx.shape
    base: dict[str, Any] = {
        "group_id": group,
        "plane": plane,
        **axes_payload(plane, xs, ys, p["slice_value"]),
    }
    if gm is None:
        return {
            **base,
            "p_sustained": None,
            "latent_std_ratio": None,
            "epistemic": None,
            "aleatoric": None,
            "total": None,
            "verdict": None,
            "model_id": None,
            "model_version": modeling.full_registry().model_version if config.model_version() else None,
            "model_status": "insufficient_data",
        }
    assert gm.model is not None
    a = modeling.assess_points(gm.model, pts)
    ev = modeling.explain_points(
        pts, modeling.evidence_coords(gm.model), a["ratio"], a["aleatoric"], a["total"]
    )
    verdict = np.asarray(ev["verdict"], dtype=object).reshape(shape).tolist()
    return {
        **base,
        "p_sustained": _grid(a["p"], shape),
        "latent_std_ratio": _grid(a["ratio"], shape),
        "epistemic": _grid(a["epistemic"], shape),
        "aleatoric": _grid(a["aleatoric"], shape),
        "total": _grid(a["total"], shape),
        "verdict": verdict,
        "model_id": modeling.model_id(group),
        "model_version": modeling.full_registry().model_version,
        "model_status": "modeled",
    }


# --- predict ---------------------------------------------------------------------------------------


@router.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> dict[str, Any]:
    group = deps.get_group(req.group_id)
    gm = modeling.group_model(req.group_id)
    version = modeling.full_registry().model_version if config.model_version() else None
    pts_in = [p.model_dump() for p in req.points]
    if gm is None or not pts_in:
        reasons = [modeling.no_model_reason(group.get("model_reason"))]
        return {
            "group_id": req.group_id,
            "model_version": version,
            "predictions": [
                {
                    "point": p,
                    "p_sustained": None,
                    "latent_mean": None,
                    "latent_std": None,
                    "latent_std_ratio": None,
                    "epistemic": None,
                    "aleatoric": None,
                    "total": None,
                    "verdict": "insufficient_evidence",
                    "reasons": reasons,
                }
                for p in pts_in
            ],
        }
    assert gm.model is not None
    pts = to_coords(
        [p["oxygen_percent"] for p in pts_in],
        [p["pressure_kpa"] for p in pts_in],
        [p["airflow_cm_s"] for p in pts_in],
    )
    a = modeling.assess_points(gm.model, pts)
    ev = modeling.explain_points(
        pts, modeling.evidence_coords(gm.model), a["ratio"], a["aleatoric"], a["total"]
    )
    out = []
    for i, p in enumerate(pts_in):
        out.append(
            {
                "point": p,
                "p_sustained": float(a["p"][i]),
                "latent_mean": float(a["latent_mean"][i]),
                "latent_std": float(a["latent_std"][i]),
                "latent_std_ratio": float(a["ratio"][i]),
                "epistemic": float(a["epistemic"][i]),
                "aleatoric": float(a["aleatoric"][i]),
                "total": float(a["total"][i]),
                "verdict": ev["verdict"][i],
                "reasons": ev["reasons"][i],
            }
        )
    return {"group_id": req.group_id, "model_version": version, "predictions": out}


# --- target / candidates ---------------------------------------------------------------------------


@router.post("/target/assess", response_model=AssessResponse)
def target_assess(req: AssessRequest) -> dict[str, Any]:
    deps.require_store()
    body = req.model_dump()
    return memo("assess", body, lambda: assess_mod.assess(req.group_id, req.target))


@router.post("/candidates/rank", response_model=RankResponse)
def candidates_rank(req: RankRequest) -> dict[str, Any]:
    deps.require_store()
    lp = req.assumptions.pressure_length_scale
    return memo("rank", req.model_dump(), lambda: ranking.rank(req.group_id, req.target, req.k, lp))


@router.post("/candidates/compare", response_model=CompareResponse)
def candidates_compare(req: CompareRequest) -> dict[str, Any]:
    deps.require_store()
    return memo("compare", req.model_dump(), lambda: ranking.compare(req.group_id, req.target, req.a, req.b))


@router.post("/candidates/counterfactual", response_model=CounterfactualResponse)
def candidates_counterfactual(req: CounterfactualRequest) -> dict[str, Any]:
    deps.require_store()
    return memo(
        "counterfactual",
        req.model_dump(),
        lambda: ranking.counterfactual_response(
            req.group_id, req.target, req.candidate, req.plane, req.slice
        ),
    )


# --- model card / validation -----------------------------------------------------------------------

MODEL_LIMITATIONS = [
    "Every integrated observation is at about 1 atm; the pressure length scale is fixed (0.3 in ln "
    "units) and cannot be learned, so predictions away from that pressure are assumption-driven.",
    "Training labels are heavily imbalanced toward 'sustained'; compare every metric with the "
    "majority-class baseline and read the confidence intervals (group bootstrap over experiments).",
    "Small samples: groups have few experiments; uncertainty is wide and validation metrics are unstable.",
    "Flow values are mostly derived from borrowed calibrations (extrapolated at low flow); oxygen is "
    "partly interpolated between initial and final values.",
    "Outputs are computational research candidates requiring qualified scientific review, established "
    "safety procedures and formal feasibility assessment.",
]


@router.get("/model/metadata", response_model=ModelMetadata)
def model_metadata(group: str) -> dict[str, Any]:
    store = deps.require_store()
    g = deps.get_group(group, store)
    reg = modeling.full_registry()
    gm = modeling.group_model(group)
    if gm is None or gm.model is None:
        raise ApiError(
            404,
            "not_found",
            f"No model for group {group!r}: {g.get('model_reason') or 'insufficient data'}.",
            {"group_id": group, "model_status": g["model_status"]},
        )
    ts = gm.training_set
    model = gm.model
    return {
        "model_id": modeling.model_id(group),
        "model_version": reg.model_version,
        "group_id": group,
        "algorithm": "GP classifier (logit link, Laplace approximation, ARD squared-exponential kernel, "
        f"MAP-II hyperparameters); mean function: {gm.mean_function}",
        "features": modeling.PRESSURE_FEATURES,
        "hyperparameters": gm.hyperparameters or model.hyperparameters(),
        "fixed_hyperparameters": list(model.fixed),
        "priors": {k: {"log_mean": v[0], "log_sd": v[1]} for k, v in model.priors.items()},
        "training": {
            "n_observations": ts["n_observations"],
            "n_experiments": ts["n_experiments"],
            "label_counts": ts["label_counts"],
            "confidence_included": ts["confidence_included"],
            "filters": ts["filters"],
        },
        "seed": reg.config.seed,
        "trained_at": reg.trained_at,
        "dataset_version": reg.dataset_version,
        "limitations": MODEL_LIMITATIONS,
    }


@router.get("/model/validation", response_model=ValidationReport)
def model_validation() -> dict[str, Any]:
    reg = modeling.full_registry()
    if reg.validation is None:
        raise ApiError(
            503,
            "artifact_missing",
            "No validation report for this model version.",
            {"artifact": "validation"},
        )
    out = dict(reg.validation)
    out["acquisition_retrospective"] = (reg.retrospective or {}).get("acquisition_retrospective") or {
        "scenarios": []
    }
    return out


# --- brief -----------------------------------------------------------------------------------------


@router.post("/brief", response_model=BriefResponse)
def brief(req: BriefRequest) -> dict[str, Any]:
    deps.require_store()
    return memo(
        "brief", req.model_dump(), lambda: brief_mod.build_brief(req.group_id, req.target, req.candidate)
    )
