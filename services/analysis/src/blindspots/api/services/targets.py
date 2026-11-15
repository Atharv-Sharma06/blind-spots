"""Target resolution: a profile id or a custom specification to a TargetSpec plus its API representation."""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass
from typing import Any

from blindspots.acquisition import targets as acq_targets
from blindspots.acquisition.targets import TargetSpec
from blindspots.api import deps
from blindspots.api.errors import ApiError
from blindspots.api.models import Target

CUSTOM_LABEL = "User-selected hypothetical conditions"
NEAR_QUIESCENT_FLOW_CM_S = 0.5
VENTILATION_NOTE = (
    "Airflow band: the documented ventilation standard range (NASA-STD-3001 Vol. 2 / Human Integration "
    "Design Handbook, {vmin:g}-{vmax:g} cm/s) extended down to {low:g} cm/s. The extension below the "
    "documented range is an analysis choice (ventilation loss or dead zones; microgravity flame "
    "extinction occurs at low flow), not a documented requirement."
)
DEFAULT_BAND_NOTE = (
    "No documented airflow for this target and no ventilation standard available; the default analysis "
    "band is used."
)


@dataclass(frozen=True)
class ResolvedSpec:
    spec: TargetSpec
    payload: dict[str, Any]  # ResolvedTarget as a dict
    flags: list[str]


def _range_payload(nominal: float | None, lo: Any, hi: Any) -> dict[str, Any]:
    return {
        "nominal": nominal,
        "min": None if lo is None else float(lo),
        "max": None if hi is None else float(hi),
    }


def _fill_nominal(rng: dict[str, Any] | None, name: str, flags: list[str]) -> dict[str, Any]:
    """Range with a nominal: a documented nominal is kept; else the documented bound is used and flagged."""
    r = dict(rng or {})
    if r.get("nominal") is not None:
        return r
    if r.get("max") is not None:
        r["nominal"] = r["max"]
        flags.append("documented_upper_bound_used" if name == "oxygen_percent" else "documented_bound_used")
        return r
    if r.get("min") is not None:
        r["nominal"] = r["min"]
        flags.append("documented_lower_bound_used" if name == "oxygen_percent" else "documented_bound_used")
        return r
    raise ApiError(422, "validation_error", f"Target has no documented {name} value.")


def _ventilation_band(
    airflow: dict[str, Any] | None,
) -> tuple[tuple[float, float], str, str | None, list[dict[str, Any]]]:
    if airflow and airflow.get("min") is not None and airflow.get("max") is not None:
        return (float(airflow["min"]), float(airflow["max"])), "profile", None, []
    vent = deps.profiles_manifest().get("ventilation")
    if vent and vent.get("max_cm_s") is not None:
        vmin, vmax = float(vent.get("min_cm_s", 0.0)), float(vent["max_cm_s"])
        note = VENTILATION_NOTE.format(vmin=vmin, vmax=vmax, low=NEAR_QUIESCENT_FLOW_CM_S)
        return (
            (NEAR_QUIESCENT_FLOW_CM_S, vmax),
            "ventilation_standard_with_near_quiescent_extension",
            note,
            list(vent.get("sources") or []),
        )
    lo, hi = acq_targets.DEFAULT_AIRFLOW_BAND
    return (lo, hi), "default_band", DEFAULT_BAND_NOTE, []


def _dedupe_sources(sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[Any, ...]] = set()
    out = []
    for s in sources:
        key = (s.get("ref_id"), s.get("page"), s.get("quote"))
        if key not in seen:
            seen.add(key)
            out.append(s)
    return out


def resolve_target(target: Target) -> ResolvedSpec:
    flags: list[str] = []
    if target.profile_id is not None:
        profiles = {p["profile_id"]: p for p in deps.profiles_manifest().get("profiles", [])}
        profile = profiles.get(target.profile_id)
        if profile is None:
            raise ApiError(
                404,
                "not_found",
                f"Unknown target profile {target.profile_id!r}.",
                {"profile_id": target.profile_id},
            )
        kind = str(profile.get("kind") or "operating_point")
        if kind != "operating_point":
            raise ApiError(
                422,
                "validation_error",
                f"Profile {target.profile_id!r} is a {kind} (context only), not an analysis target.",
                {"profile_id": target.profile_id, "kind": kind},
            )
        o2 = _fill_nominal(profile.get("oxygen_percent"), "oxygen_percent", flags)
        pr = _fill_nominal(profile.get("total_pressure_kpa"), "total_pressure_kpa", flags)
        prof = {**profile, "oxygen_percent": o2, "total_pressure_kpa": pr}
        spec = acq_targets.from_profile(prof)
        airflow = profile.get("airflow_cm_s")
        label, status, pid = spec.label, spec.status, target.profile_id
        sources = [dict(s) for s in profile.get("sources", [])]
    else:
        assert target.custom is not None
        c = target.custom
        o2n, pn = c.oxygen_percent.nominal, c.total_pressure_kpa.nominal
        assert o2n is not None and pn is not None
        if not 0 < o2n <= 100 or pn <= 0:
            raise ApiError(
                422, "validation_error", "Custom target needs 0 < O2 <= 100 % and pressure > 0 kPa."
            )
        o2 = c.oxygen_percent.model_dump()
        pr = c.total_pressure_kpa.model_dump()
        airflow = c.airflow_cm_s.model_dump() if c.airflow_cm_s else None
        if airflow and airflow.get("nominal") is not None and airflow.get("min") is None:
            airflow = {"nominal": airflow["nominal"], "min": airflow["nominal"], "max": airflow["nominal"]}
        if airflow and (airflow.get("min") is None) != (airflow.get("max") is None):
            raise ApiError(
                422,
                "validation_error",
                "Custom airflow needs both min and max (or a single nominal value); a one-sided range "
                "would be ignored.",
                {"airflow_cm_s": airflow},
            )
        spec = acq_targets.custom(
            CUSTOM_LABEL,
            o2n,
            pn,
            o2_min=o2.get("min"),
            o2_max=o2.get("max"),
            pressure_min_kpa=pr.get("min"),
            pressure_max_kpa=pr.get("max"),
        )
        label, status, pid = CUSTOM_LABEL, "user_hypothetical", None
        sources = []
    (lo, hi), source, note, vent_sources = _ventilation_band(airflow)
    if target.custom is not None and source == "profile":
        source = "custom"
    if hi < lo or lo < 0:
        raise ApiError(422, "validation_error", "Airflow band needs 0 <= min <= max.")
    spec = dataclasses.replace(spec, airflow_min_cm_s=lo, airflow_max_cm_s=hi, airflow_band_source=source)
    if source == "default_band":
        flags.append("default_band")
    payload = {
        "label": label,
        "profile_id": pid,
        "status": status,
        "kind": "operating_point",
        "oxygen_percent": _range_payload(spec.o2_nominal, o2.get("min"), o2.get("max")),
        "total_pressure_kpa": _range_payload(spec.pressure_nominal_kpa, pr.get("min"), pr.get("max")),
        "airflow_cm_s": _range_payload(None, lo, hi),
        "airflow_band_source": source,
        "airflow_band_note": note,
        "flags": flags,
        "sources": _dedupe_sources(sources + vent_sources),
    }
    return ResolvedSpec(spec, payload, flags)
