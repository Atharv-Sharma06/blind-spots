"""Documented, not-integrated investigations that overlap a target region or contain a candidate."""

from __future__ import annotations

from typing import Any

from blindspots.acquisition.targets import TargetSpec
from blindspots.api import deps

TOL = 1e-9


def _contains(rng: list[float] | None, value: float) -> bool:
    return rng is not None and rng[0] - TOL <= value <= rng[1] + TOL


def _overlaps(rng: list[float] | None, lo: float, hi: float) -> bool:
    return rng is not None and rng[0] - TOL <= hi and lo <= rng[1] + TOL


def documented_context(spec: TargetSpec) -> list[dict[str, Any]]:
    """Investigations whose documented O2 and pressure ranges (and flow range, when documented) overlap."""
    out = []
    o2_lo = spec.o2_min if spec.o2_min is not None else spec.o2_nominal
    o2_hi = spec.o2_max if spec.o2_max is not None else spec.o2_nominal
    p_lo = spec.pressure_min_kpa if spec.pressure_min_kpa is not None else spec.pressure_nominal_kpa
    p_hi = spec.pressure_max_kpa if spec.pressure_max_kpa is not None else spec.pressure_nominal_kpa
    for rec in deps.not_integrated_records():
        o2r, pr, fr = (
            rec.get("oxygen_percent_range"),
            rec.get("pressure_kpa_range"),
            rec.get("flow_cm_s_range"),
        )
        if o2r is None or pr is None:
            continue
        if not (_overlaps(o2r, o2_lo, o2_hi) and _overlaps(pr, p_lo, p_hi)):
            continue
        if fr is not None and not _overlaps(fr, spec.airflow_min_cm_s, spec.airflow_max_cm_s):
            continue
        nominal_inside = _contains(o2r, spec.o2_nominal) and _contains(pr, spec.pressure_nominal_kpa)
        out.append(
            {
                "id": rec["id"],
                "name": rec["name"],
                "overlap": "contains_target_nominal" if nominal_inside else "overlaps_target_region",
                "data_availability": rec.get("data_availability"),
                "reason_not_integrated": rec.get("reason_not_integrated"),
            }
        )
    return out


def related_to_candidate(o2: float, pressure_kpa: float, airflow_cm_s: float) -> list[dict[str, Any]]:
    out = []
    for rec in deps.not_integrated_records():
        o2r, pr, fr = (
            rec.get("oxygen_percent_range"),
            rec.get("pressure_kpa_range"),
            rec.get("flow_cm_s_range"),
        )
        if o2r is None or pr is None:
            continue
        if not (_contains(o2r, o2) and _contains(pr, pressure_kpa)):
            continue
        if fr is not None and not _contains(fr, airflow_cm_s):
            continue
        reason = rec.get("reason_not_integrated") or "reason not recorded"
        out.append(
            {
                "id": rec["id"],
                "name": rec["name"],
                "data_availability": rec.get("data_availability"),
                "note": f"Inside the documented test envelope of {rec['name']}; existing data may already "
                f"inform this candidate (not integrated: {reason}).",
            }
        )
    return out


def names(items: list[dict[str, Any]]) -> str:
    return "; ".join(i["name"] for i in items)
