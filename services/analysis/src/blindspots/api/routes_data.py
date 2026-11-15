"""Data and coverage endpoints (docs/API.md): everything that does not need a trained model."""

from __future__ import annotations

import csv
import io
import json
import math
import os
from typing import Any

import numpy as np
from fastapi import APIRouter, Query
from fastapi.responses import Response

from blindspots import __version__, config
from blindspots.api import deps
from blindspots.api.errors import ApiError
from blindspots.api.models import (
    ContextResponse,
    CoverageResponse,
    ExperimentDetail,
    ExperimentWithGroup,
    GroupSummary,
    HeadlineResponse,
    HealthResponse,
    MethodologyResponse,
    ObservationWithGroup,
    Plane,
    SourcesResponse,
    TargetsResponse,
)
from blindspots.coverage.grid import DEFAULT_SLICE, coverage_grid_xy, in_slice_mask
from blindspots.schemas import ExperimentRecord, Investigation

router = APIRouter(prefix="/api")

API_VERSION = "1"
CANDIDATE_DOMAIN = {
    "oxygen_percent": [12.0, 40.0],
    "pressure_kpa": [50.0, 103.0],
    "airflow_cm_s": [0.5, 45.0],
}
SPARSE_THRESHOLD = 1.0
PRESSURE_LENGTH_SCALE_DEFAULT = 0.3
PRESSURE_LENGTH_SCALE_SENSITIVITY = [0.15, 0.3, 0.6]
REPOSITORY_ENV = "BLINDSPOTS_REPOSITORY_URL"  # set only once the public repository exists; never invented
HEADLINE_PROFILES = ["iss_cabin_nominal", "exploration_atmosphere_8p2_34"]
DASH = "\u2013"

AXIS_MAX = 1000.0  # kPa on the pressure axis, cm/s on the airflow axis

DEFAULT_AXES = {
    "o2_flow": {"x": (10.0, 40.0), "y": (0.2, 50.0)},
    "o2_pressure": {"x": (10.0, 40.0), "y": (30.0, 110.0)},
}


# --- health ----------------------------------------------------------------------------------------


@router.get("/health", response_model=HealthResponse)
def health() -> dict[str, Any]:
    dataset = config.dataset_version()
    registry = deps.get_registry()
    artifacts = {
        "dataset": dataset is not None and deps.dataset_available(),
        "models": registry is not None,
        "validation": bool(registry and registry.has_validation),
    }
    return {
        "status": "ok" if artifacts["dataset"] and artifacts["models"] else "degraded",
        "dataset_version": dataset,
        "model_version": registry.version if registry else None,
        "artifacts": artifacts,
        "api_version": API_VERSION,
    }


# --- investigations / groups -----------------------------------------------------------------------


@router.get("/investigations", response_model=list[Investigation])
def investigations() -> list[dict[str, Any]]:
    return deps.require_store().investigations


@router.get("/groups", response_model=list[GroupSummary])
def groups() -> list[dict[str, Any]]:
    store = deps.require_store()
    default = deps.default_group_id(store)
    return [{**g, "is_default": g["group_id"] == default} for g in deps.groups_with_status(store)]


# --- experiments / observations --------------------------------------------------------------------


def _filter_experiments(
    store: deps.DataStore,
    investigation: str | None,
    group: str | None,
    q: str | None,
    included: bool | None,
) -> list[dict[str, Any]]:
    if group is not None and not any(r["group_id"] == group for r in store.experiments):
        # Context-only groups (e.g. Saffire `other__concurrent`) are valid filters even though they are
        # not analysis groups; only ids that appear on no record at all are unknown.
        deps.get_group(group, store)
    rows = store.experiments
    if investigation:
        inv = investigation.strip().lower()
        rows = [
            r
            for r in rows
            if r["investigation_id"].lower() == inv or str(r.get("investigation_acronym", "")).lower() == inv
        ]
    if group is not None:
        rows = [r for r in rows if r["group_id"] == group]
    if included is not None:
        rows = [r for r in rows if bool(r["included_in_training"]) == included]
    if q and q.strip():
        needle = q.strip().lower()
        fields = ("test_label", "experiment_id", "material_type", "material_family", "notes_raw")
        rows = [r for r in rows if any(needle in str(r.get(f) or "").lower() for f in fields)]
    return rows


@router.get("/experiments", response_model=list[ExperimentWithGroup])
def experiments(
    investigation: str | None = None,
    group: str | None = None,
    q: str | None = None,
    included: bool | None = None,
) -> list[dict[str, Any]]:
    return _filter_experiments(deps.require_store(), investigation, group, q, included)


@router.get("/experiments/{experiment_id:path}", response_model=ExperimentDetail)
def experiment_detail(experiment_id: str) -> dict[str, Any]:
    store = deps.require_store()
    exp = store.experiment_by_id.get(experiment_id)
    if exp is None:
        raise ApiError(
            404, "not_found", f"Unknown experiment {experiment_id!r}.", {"experiment_id": experiment_id}
        )
    obs = sorted(store.obs_by_experiment.get(experiment_id, []), key=lambda o: o["step_index"])
    return {"experiment": exp, "observations": obs}


@router.get("/observations", response_model=list[ObservationWithGroup])
def observations(group: str | None = None) -> list[dict[str, Any]]:
    store = deps.require_store()
    if group is None:
        return store.observations
    deps.get_group(group, store)
    return [o for o in store.observations if o["group_id"] == group]


@router.get("/export/experiments.csv")
def export_experiments(investigation: str | None = None, group: str | None = None) -> Response:
    store = deps.require_store()
    rows = _filter_experiments(store, investigation, group, None, None)
    fields = list(ExperimentRecord.model_fields)
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    for r in rows:
        writer.writerow(
            {k: (json.dumps(v) if isinstance(v, list) else ("" if v is None else v)) for k, v in r.items()}
        )
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="experiments.csv"'},
    )


# --- targets / context -----------------------------------------------------------------------------


@router.get("/targets", response_model=TargetsResponse)
def targets() -> dict[str, Any]:
    manifest = deps.profiles_manifest()
    return {"profiles": manifest.get("profiles", []), "ventilation": manifest.get("ventilation")}


@router.get("/context", response_model=ContextResponse)
def context() -> dict[str, Any]:
    store = deps.get_store()
    context_ids: set[str] = set()
    if store is not None:
        context_ids = {
            i["investigation_id"] for i in store.investigations if i["role"] == "integrated_context"
        }
    return {
        "not_integrated": deps.not_integrated_records(),
        "ground_flammability": deps.ground_flammability_rows(),
        "context_experiments": (
            [e for e in store.experiments if e["investigation_id"] in context_ids] if store else []
        ),
    }


# --- sources / methodology -------------------------------------------------------------------------


@router.get("/sources", response_model=SourcesResponse)
def sources() -> dict[str, Any]:
    store = deps.get_store()
    manifest = deps.profiles_manifest()
    atmosphere: dict[str, dict[str, Any]] = {}
    for profile in manifest.get("profiles", []):
        for s in profile.get("sources", []):
            atmosphere.setdefault(s["ref_id"], s)
    for s in (manifest.get("ventilation") or {}).get("sources", []):
        atmosphere.setdefault(s["ref_id"], s)

    publications: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for inv in store.investigations if store else []:
        if inv.get("doi"):
            title = inv["title"]
            seen.add((title, inv["landing_url"]))
            publications.append(
                {
                    "title": f"{inv['acronym']}: {title} (NASA PSI dataset)",
                    "doi": inv["doi"],
                    "url": inv["landing_url"],
                    "investigation_id": inv["investigation_id"],
                }
            )
    for r in deps.publication_point_rows():
        key = (r.get("source_title", ""), r.get("url", ""))
        if not key[0] or key in seen:
            continue
        seen.add(key)
        matched = r.get("matched_psi_test_label") or ""
        publications.append(
            {
                "title": key[0],
                "doi": None,
                "url": key[1] or None,
                "investigation_id": matched.split(":")[0] if ":" in matched else None,
            }
        )

    ground: dict[tuple[str, Any], dict[str, Any]] = {}
    for g in deps.ground_flammability_rows():
        gkey = (g.get("source_title") or "", g.get("source_url"))
        entry = ground.setdefault(
            gkey, {"title": gkey[0], "url": gkey[1], "ntrs_id": g.get("ntrs_id"), "n_records": 0}
        )
        entry["n_records"] += 1

    raw = deps.raw_files_manifest()
    return {
        "investigations": store.investigations if store else [],
        "publications": publications,
        "atmosphere_sources": list(atmosphere.values()),
        "other_investigations": deps.not_integrated_records(),
        "ground_data_sources": list(ground.values()),
        "raw_files": [
            {
                "path": f["path"],
                "psi_file_name": f.get("psi_file_name"),
                "sha256": f.get("sha256"),
                "investigation_id": f.get("accession"),
            }
            for f in raw.get("files", [])
        ],
    }


def flow_provenance_counts(store: deps.DataStore | None) -> dict[str, int] | None:
    """Airflow provenance counts over the training observations (included and labelled), from the store."""
    if store is None:
        return None
    train = [o for o in store.observations if o["included_in_training"] and o.get("label") is not None]
    if not train:
        return None

    def flagged(o: dict[str, Any], flag: str) -> bool:
        return flag in (o.get("quality_flags") or [])

    borrowed_flag = "calibration_borrowed_from_bass2"
    return {
        "n_training": len(train),
        "n_recorded": sum(1 for o in train if o.get("airflow_basis") in ("air_display", "stated_cm_s")),
        "n_converted_bass2_calibration": sum(
            1
            for o in train
            if o.get("airflow_basis") in ("fan_calibration", "pot_calibration")
            and not flagged(o, borrowed_flag)
        ),
        "n_borrowed_calibration": sum(1 for o in train if flagged(o, borrowed_flag)),
        "n_below_calibration_range": sum(1 for o in train if flagged(o, "below_calibration_range")),
    }


def flow_provenance_sentence(store: deps.DataStore | None) -> str | None:
    """LEAD_DECISIONS D5: airflow provenance of the training observations, computed from the store."""
    c = flow_provenance_counts(store)
    if c is None:
        return None
    borrowed = c["n_borrowed_calibration"]
    out = (
        f"{c['n_recorded']} of {c['n_training']} training steps use a recorded airflow (duct reading or a "
        f"value stated in the source); {c['n_converted_bass2_calibration']} are converted from fan or pot "
        "settings with the BASS-II calibration; "
        + ("none use a borrowed calibration" if borrowed == 0 else f"{borrowed} use a borrowed calibration")
        + "."
    )
    if c["n_below_calibration_range"]:
        out += (
            f" {c['n_below_calibration_range']} lie below the calibrated range and are linearly extrapolated "
            "and flagged."
        )
    return out


def _context_names(store: deps.DataStore | None) -> str:
    if store is None:
        return "context records"
    names = sorted(
        {
            str(i.get("acronym") or i["investigation_id"])
            for i in store.investigations
            if i["role"] == "integrated_context"
        }
    )
    return ", ".join(names) if names else "no context records"


def stationarity_sentence(store: deps.DataStore | None) -> str:
    rng = ""
    if store is not None:
        o2 = [
            o["oxygen_percent"]
            for o in store.observations
            if o["included_in_training"]
            and o.get("label") is not None
            and o.get("oxygen_percent") is not None
        ]
        if o2:
            rng = f" and {min(o2):.1f}{DASH}{max(o2):.1f}% O₂"
    return (
        "The GP's correlation depends only on the distance between conditions (a stationary kernel whose "
        f"length scales were learned near 1 atm{rng}). Away from the data, the candidate ranking follows "
        "this assumption: the most informative single experiment is then usually at the target conditions "
        "themselves."
    )


def _limitations(store: deps.DataStore | None) -> list[str]:
    out = [
        "Evidence is limited to the integrated NASA PSI records (BASS and BASS-II). "
        f"{_context_names(store)} records and ground-test records are shown as context only, never modelled. "
        "Conditions outside the integrated records are 'not represented in the integrated records', which "
        "does not mean NASA has not studied them (see the related NASA work that is not integrated).",
        "Every integrated observation is at about 1 atm (BASS measured, BASS-II assumed 101.353 kPa "
        "and flagged). "
        "The GP pressure length scale is fixed at 0.3 (ln units) and cannot be learned, so any pressure "
        "extrapolation is assumption-driven; sensitivity at 0.15 / 0.3 / 0.6 is reported.",
        stationarity_sentence(store),
        "Outputs are computational research candidates requiring qualified scientific review, "
        "established safety "
        "procedures and formal feasibility assessment; not a certified fire-safety assessment.",
    ]
    flow = flow_provenance_sentence(store)
    if flow:
        out.insert(2, "Airflow provenance: " + flow)
    if store is not None:
        train = [o for o in store.observations if o["included_in_training"] and o.get("label") is not None]
        n1 = sum(1 for o in train if o["label"] == 1)
        n0 = len(train) - n1
        flow_off = sum(1 for o in train if o["label"] == 0 and "flow_off_transient" in o["quality_flags"])
        if train:
            out.insert(
                1,
                f"Training data are imbalanced: {len(train)} observations, {n1} flame sustained and {n0} "
                "flame not sustained "
                f"({100 * n1 / len(train):.0f}% sustained); {flow_off} of the {n0} not-sustained "
                "observations are flow-turned-off transients. Compare every metric with the majority-class "
                "baseline; small groups give wide uncertainty.",
            )
    return out


@router.get("/methodology", response_model=MethodologyResponse)
def methodology() -> dict[str, Any]:
    store = deps.get_store()
    registry = deps.get_registry()
    raw = deps.raw_files_manifest()
    retrieved = raw.get("retrieved_at")
    return {
        "versions": {
            "dataset_version": config.dataset_version(),
            "model_version": registry.version if registry else None,
            "pipeline_version": __version__,
            "api_version": API_VERSION,
        },
        "config": {
            "training_filter": {
                "rule": "included_in_training and a label (sustained or not sustained)",
                "confidence_included": ["high", "medium"],
                "excluded_by_default": "low-confidence rows (sensitivity analysis only), not_ignited, "
                "n2_suppression, no numeric airflow, provenance mismatches",
                "exclusions_in_dataset": (store.report.get("exclusions") if store else None),
            },
            "coverage_scales": config.COVERAGE_SCALES,
            "support_thresholds": {
                "sparse_nn_distance": SPARSE_THRESHOLD,
                "comparable_radius": 1.0,
                "hull": "convex hull over varying dimensions; degenerate dimensions within 1 scale unit",
                "point_supported": "inside the observed region or >= 3 comparable observations, and latent "
                "std ratio < 0.6",
                "point_insufficient_evidence": "no comparable observation and latent std ratio > 0.85",
                "target_supported_fraction": 0.5,
                "target_insufficient_evidence": "no target point has a comparable observation",
                "p_sustained_shown": "only at supported points",
            },
            "candidate_domain": CANDIDATE_DOMAIN,
            "seeds": registry.seeds if registry else None,
            "pressure_length_scale_default": PRESSURE_LENGTH_SCALE_DEFAULT,
            "pressure_length_scale_sensitivity": PRESSURE_LENGTH_SCALE_SENSITIVITY,
            "pressure_length_scale_fixed": True,
            "training_flow_provenance": flow_provenance_counts(store),
        },
        "dates": {
            "data_retrieved": str(retrieved) if retrieved else None,
            "last_analysis": registry.trained_at if registry else None,
        },
        "limitations": _limitations(store),
        "repository_url": os.environ.get(REPOSITORY_ENV) or None,
    }


# --- coverage --------------------------------------------------------------------------------------

SLICE_META = {
    "o2_flow": {"variable": "pressure_kpa", "unit": "kPa"},
    "o2_pressure": {"variable": "airflow_cm_s", "unit": "cm/s"},
}
Y_META = {
    "o2_flow": {"variable": "airflow_cm_s", "unit": "cm/s", "scale": "log"},
    "o2_pressure": {"variable": "pressure_kpa", "unit": "kPa", "scale": "linear"},
}


def resolve_plane_params(
    plane: str,
    slice_value: float | None,
    nx: int,
    ny: int,
    x_min: float | None,
    x_max: float | None,
    y_min: float | None,
    y_max: float | None,
) -> dict[str, Any]:
    """Validate/default the grid parameters shared by /api/coverage and /api/surface."""
    d = DEFAULT_AXES[plane]
    given = [v for v in (slice_value, x_min, x_max, y_min, y_max) if v is not None]
    if not all(math.isfinite(v) for v in given):
        raise ApiError(422, "validation_error", "Numeric parameters must be finite.")
    xr = (d["x"][0] if x_min is None else x_min, d["x"][1] if x_max is None else x_max)
    yr = (d["y"][0] if y_min is None else y_min, d["y"][1] if y_max is None else y_max)
    if not (xr[0] < xr[1] and yr[0] < yr[1]):
        raise ApiError(422, "validation_error", "Axis ranges need min < max.")
    if xr[0] < 0 or xr[1] > 100:
        raise ApiError(422, "validation_error", "The oxygen axis must lie within 0-100 %.")
    if yr[0] <= 0 or yr[1] > AXIS_MAX:
        unit = "cm/s" if plane == "o2_flow" else "kPa"
        raise ApiError(422, "validation_error", f"The y axis must lie within (0, {AXIS_MAX:g}] {unit}.")
    sv = DEFAULT_SLICE[plane] if slice_value is None else slice_value
    if sv <= 0 or sv > AXIS_MAX:
        raise ApiError(422, "validation_error", f"slice must be > 0 and <= {AXIS_MAX:g}.")
    return {"slice_value": sv, "nx": nx, "ny": ny, "x_range": xr, "y_range": yr}


def axes_payload(plane: str, xs: np.ndarray, ys: np.ndarray, slice_value: float) -> dict[str, Any]:
    return {
        "slice": {**SLICE_META[plane], "value": slice_value},
        "x": {"variable": "oxygen_percent", "unit": "%", "scale": "linear", "values": xs.tolist()},
        "y": {**Y_META[plane], "values": ys.tolist()},
    }


@router.get("/coverage", response_model=CoverageResponse)
def coverage(
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
    coords, rows = store.evidence(group)
    grid = coverage_grid_xy(coords, plane, p["slice_value"], nx, ny, p["x_range"], p["y_range"])
    mask = in_slice_mask(coords, plane, p["slice_value"])
    nn = grid["nn_d"]
    return {
        "group_id": group,
        "plane": plane,
        **axes_payload(plane, grid["x"], grid["y"], p["slice_value"]),
        "nn_distance": deps.clean(nn.tolist()),
        "comparable_count": grid["counts"].tolist(),
        "inside_hull": grid["inside_hull"].tolist(),
        "sparse_threshold": SPARSE_THRESHOLD,
        "scales": config.COVERAGE_SCALES,
        "observations_in_slice": rows.loc[mask, "observation_id"].tolist() if len(rows) else [],
        "n_evidence_observations": len(rows),
    }


# --- headline (finding strip) ----------------------------------------------------------------------


@router.get("/headline", response_model=HeadlineResponse)
def headline(profiles: str | None = None) -> dict[str, Any]:
    """Comparable observations for headline targets across all groups, plus the integrated envelope.

    Always includes the ISS nominal profile and the NASA Exploration Atmosphere; ``profiles`` adds more
    operating-point profile ids (comma-separated).
    """
    from blindspots.acquisition.targets import target_points
    from blindspots.api.models import Target
    from blindspots.api.services.targets import resolve_target
    from blindspots.coverage.coverage import count_within, standardized_distances
    from blindspots.models.groups import training_rows

    store = deps.require_store()
    ids = list(HEADLINE_PROFILES)
    for pid in (profiles or "").split(","):
        if pid.strip() and pid.strip() not in ids:
            ids.append(pid.strip())
    known = {p["profile_id"] for p in deps.profiles_manifest().get("profiles", [])}
    groups = deps.groups_with_status(store)
    out_profiles = []
    for pid in ids:
        if pid not in known:
            if pid in HEADLINE_PROFILES:
                continue  # manifest without this profile: omit rather than invent
            raise ApiError(404, "not_found", f"Unknown target profile {pid!r}.", {"profile_id": pid})
        resolved = resolve_target(Target(profile_id=pid))
        t, _ = target_points(resolved.spec)
        by_group = []
        for g in groups:
            coords, _rows = store.evidence(g["group_id"])
            if not len(coords):
                continue
            d = standardized_distances(t, coords).min(axis=0)
            by_group.append(
                {
                    "group_id": g["group_id"],
                    "label": g["label"],
                    "comparable_observations": int((d <= 1.0 + 1e-12).sum()),
                    "points_with_comparable": int((count_within(t, coords) > 0).sum()),
                }
            )
        by_group.sort(key=lambda r: (-r["comparable_observations"], r["group_id"]))
        payload = resolved.payload
        out_profiles.append(
            {
                "profile_id": pid,
                "label": payload["label"],
                "status": payload["status"],
                "oxygen_percent": payload["oxygen_percent"]["nominal"],
                "total_pressure_kpa": payload["total_pressure_kpa"]["nominal"],
                "n_target_points": len(t),
                "comparable_observations": sum(r["comparable_observations"] for r in by_group),
                "groups_with_comparable": sum(1 for r in by_group if r["comparable_observations"] > 0),
                "n_groups": len(by_group),
                "by_group": by_group,
            }
        )
    train = training_rows(store.obs_df)
    inv_ids = sorted(set(train["investigation_id"])) if len(train) else []
    acr = {i["investigation_id"]: i.get("acronym") or i["investigation_id"] for i in store.investigations}

    def span(col: Any) -> list[float] | None:
        v = col.dropna()
        return [float(v.min()), float(v.max())] if len(v) else None

    assumed = int(train["total_pressure_kpa"].isna().sum()) if "total_pressure_kpa" in train else len(train)
    envelope = {
        "investigations": [str(acr.get(i, i)) for i in inv_ids],
        "n_experiments": int(train["experiment_id"].nunique()) if len(train) else 0,
        "n_steps": len(train),
        "oxygen_percent": span(train["oxygen_percent"]) if len(train) else None,
        "pressure_kpa": span(train["pressure_for_analysis_kpa"]) if len(train) else None,
        "pressure_measured_kpa": span(train["total_pressure_kpa"]) if len(train) else None,
        "n_steps_pressure_assumed": assumed,
        "airflow_cm_s": span(train["airflow_cm_s"]) if len(train) else None,
    }
    return {"profiles": out_profiles, "envelope": envelope}
