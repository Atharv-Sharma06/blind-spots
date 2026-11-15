"""Target regions: a grid of atmosphere points built from a profile or a custom specification."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np

from blindspots.coverage.coverage import to_coords

DEFAULT_AIRFLOW_BAND = (0.5, 20.3)


@dataclass(frozen=True)
class TargetSpec:
    label: str
    status: str
    o2_nominal: float
    o2_min: float | None
    o2_max: float | None
    pressure_nominal_kpa: float
    pressure_min_kpa: float | None
    pressure_max_kpa: float | None
    airflow_min_cm_s: float
    airflow_max_cm_s: float
    airflow_band_source: str = "default_band"  # "profile" | "default_band" | "custom"
    sources: list[Any] = field(default_factory=list)


def _range(d: dict[str, Any] | None) -> tuple[float | None, float | None, float | None]:
    if not d:
        return None, None, None
    nom = d.get("nominal")
    return (None if nom is None else float(nom)), d.get("min"), d.get("max")


def from_profile(profile: dict[str, Any]) -> TargetSpec:
    o2n, o2lo, o2hi = _range(profile.get("oxygen_percent"))
    pn, plo, phi = _range(profile.get("total_pressure_kpa"))
    if o2n is None or pn is None:
        raise ValueError("profile needs oxygen_percent.nominal and total_pressure_kpa.nominal")
    flow = profile.get("airflow_cm_s")
    lo = flow.get("min") if flow else None
    hi = flow.get("max") if flow else None
    if lo is not None and hi is not None:
        band, src = (float(lo), float(hi)), "profile"
    else:
        band, src = DEFAULT_AIRFLOW_BAND, "default_band"
    return TargetSpec(
        label=str(profile.get("name") or profile.get("profile_id") or "target"),
        status=str(profile.get("status", "unknown")),
        o2_nominal=o2n,
        o2_min=None if o2lo is None else float(o2lo),
        o2_max=None if o2hi is None else float(o2hi),
        pressure_nominal_kpa=pn,
        pressure_min_kpa=None if plo is None else float(plo),
        pressure_max_kpa=None if phi is None else float(phi),
        airflow_min_cm_s=band[0],
        airflow_max_cm_s=band[1],
        airflow_band_source=src,
        sources=list(profile.get("sources") or []),
    )


def custom(
    label: str,
    o2_nominal: float,
    pressure_nominal_kpa: float,
    o2_min: float | None = None,
    o2_max: float | None = None,
    pressure_min_kpa: float | None = None,
    pressure_max_kpa: float | None = None,
    airflow_min_cm_s: float | None = None,
    airflow_max_cm_s: float | None = None,
) -> TargetSpec:
    given = airflow_min_cm_s is not None and airflow_max_cm_s is not None
    lo, hi = (airflow_min_cm_s, airflow_max_cm_s) if given else DEFAULT_AIRFLOW_BAND
    assert lo is not None and hi is not None
    return TargetSpec(
        label=label,
        status="user_hypothetical",
        o2_nominal=float(o2_nominal),
        o2_min=o2_min,
        o2_max=o2_max,
        pressure_nominal_kpa=float(pressure_nominal_kpa),
        pressure_min_kpa=pressure_min_kpa,
        pressure_max_kpa=pressure_max_kpa,
        airflow_min_cm_s=float(lo),
        airflow_max_cm_s=float(hi),
        airflow_band_source="custom" if given else "default_band",
    )


def _axis(nominal: float, lo: float | None, hi: float | None, n: int) -> np.ndarray:
    if lo is None or hi is None or hi <= lo:
        return np.array([nominal])
    return np.linspace(lo, hi, n)


def target_points(
    spec: TargetSpec, n_o2: int = 5, n_p: int = 3, n_flow: int = 9
) -> tuple[np.ndarray, np.ndarray]:
    """Grid of analysis coordinates (n, 3) and uniform weights summing to 1."""
    o2 = _axis(spec.o2_nominal, spec.o2_min, spec.o2_max, n_o2)
    p = _axis(spec.pressure_nominal_kpa, spec.pressure_min_kpa, spec.pressure_max_kpa, n_p)
    if spec.airflow_max_cm_s > spec.airflow_min_cm_s:
        u = np.geomspace(spec.airflow_min_cm_s, spec.airflow_max_cm_s, n_flow)
    else:
        u = np.array([spec.airflow_min_cm_s])
    go, gp, gu = np.meshgrid(o2, p, u, indexing="ij")
    x = to_coords(go.ravel(), gp.ravel(), gu.ravel())
    return x, np.full(len(x), 1.0 / len(x))
