"""Model-independent evidence coverage in standardized analysis coordinates (CONTRACTS section 4).

Coordinates are columns ``[z_o2, z_flow, z_p]`` with ``z_o2 = O2 %``, ``z_flow = ln(1 + airflow cm/s)``
and ``z_p = ln(p_kPa / 101.325)``. Distances use the reference scales in ``config.COVERAGE_SCALES``.
"""

from __future__ import annotations

from typing import Any, Literal

import numpy as np
from scipy.spatial import Delaunay, QhullError
from scipy.spatial.distance import cdist

from blindspots.config import COVERAGE_SCALES, P_REF_KPA

SCALES: np.ndarray = np.array([COVERAGE_SCALES["o2"], COVERAGE_SCALES["flow"], COVERAGE_SCALES["p"]])
DEGENERATE_SPREAD = 1e-9

Plane = Literal["o2_flow", "o2_pressure"]


def to_coords(o2_percent: Any, pressure_kpa: Any, airflow_cm_s: Any) -> np.ndarray:
    """Raw physical values to analysis coordinates, shape (n, 3)."""
    o2 = np.atleast_1d(np.asarray(o2_percent, dtype=float))
    p = np.atleast_1d(np.asarray(pressure_kpa, dtype=float))
    u = np.atleast_1d(np.asarray(airflow_cm_s, dtype=float))
    o2, p, u = np.broadcast_arrays(o2, p, u)
    return np.column_stack([o2, np.log1p(u), np.log(p / P_REF_KPA)])


def from_coords(x: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Analysis coordinates back to (o2_percent, pressure_kpa, airflow_cm_s)."""
    x = np.atleast_2d(x)
    return x[:, 0], P_REF_KPA * np.exp(x[:, 2]), np.expm1(x[:, 1])


def _as2d(a: np.ndarray) -> np.ndarray:
    return np.atleast_2d(np.asarray(a, dtype=float))


def standardized_distances(points: np.ndarray, obs: np.ndarray) -> np.ndarray:
    """Pairwise standardized distances, shape (n_points, n_obs)."""
    return np.asarray(cdist(_as2d(points) / SCALES, _as2d(obs) / SCALES))


def nn_distance(points: np.ndarray, obs: np.ndarray) -> np.ndarray:
    """Standardized distance to the nearest observation (inf when there are no observations)."""
    pts = _as2d(points)
    if len(obs) == 0:
        return np.full(len(pts), np.inf)
    return np.asarray(standardized_distances(pts, obs).min(axis=1))


def count_within(points: np.ndarray, obs: np.ndarray, r: float = 1.0) -> np.ndarray:
    """Number of observations within standardized distance r (inclusive) of each point."""
    pts = _as2d(points)
    if len(obs) == 0:
        return np.zeros(len(pts), dtype=int)
    return np.asarray((standardized_distances(pts, obs) <= r + 1e-12).sum(axis=1), dtype=int)


def inside_hull(points: np.ndarray, obs: np.ndarray) -> np.ndarray:
    """Whether each point lies in the convex hull of the observations.

    The hull is taken over the varying dimensions only. A dimension whose observed spread is smaller
    than its coverage scale (e.g. BASS pressures 98-102 kPa, a spread of ~0.04 in ln units versus
    s_p = 0.1) is treated as degenerate and checked separately: the point must lie within the observed
    range padded by one scale. Collinear or otherwise degenerate hulls return False (conservative).
    """
    pts = _as2d(points)
    if len(obs) == 0:
        return np.zeros(len(pts), dtype=bool)
    o = _as2d(obs)
    spread = o.max(axis=0) - o.min(axis=0)
    varying = spread >= np.asarray(SCALES, dtype=float)
    ok = np.ones(len(pts), dtype=bool)
    for j in np.flatnonzero(~varying):
        lo_j, hi_j = o[:, j].min() - SCALES[j], o[:, j].max() + SCALES[j]
        ok &= (pts[:, j] >= lo_j - 1e-12) & (pts[:, j] <= hi_j + 1e-12)
    vdims = np.flatnonzero(varying)
    if len(vdims) == 0:
        return ok
    if len(vdims) == 1:
        j = vdims[0]
        return ok & (pts[:, j] >= o[:, j].min() - 1e-12) & (pts[:, j] <= o[:, j].max() + 1e-12)
    try:
        tri = Delaunay(o[:, vdims])
    except (QhullError, ValueError):
        return np.zeros(len(pts), dtype=bool)
    return ok & (tri.find_simplex(pts[:, vdims], tol=1e-12) >= 0)


def coverage_grid(
    obs_coords: np.ndarray,
    plane: Plane,
    slice_value: float | None = None,
    resolution: int = 40,
    o2_range: tuple[float, float] = (12.0, 40.0),
    flow_range: tuple[float, float] = (0.5, 45.0),
    pressure_range: tuple[float, float] = (50.0, 103.0),
) -> dict[str, Any]:
    """Coverage on a 2-D slice.

    ``o2_flow``: x = O2 %, y = airflow cm/s (log-spaced); ``slice_value`` is pressure kPa (default 101.325).
    ``o2_pressure``: x = O2 %, y = pressure kPa; ``slice_value`` is airflow in cm/s (default 5).
    Returns raw-unit axes, and arrays shaped (len(y), len(x)).
    """
    xs = np.linspace(*o2_range, resolution)
    if plane == "o2_flow":
        sv = P_REF_KPA if slice_value is None else float(slice_value)
        ys = np.geomspace(*flow_range, resolution)
        gx, gy = np.meshgrid(xs, ys)
        pts = to_coords(gx.ravel(), sv, gy.ravel())
    elif plane == "o2_pressure":
        sv = 5.0 if slice_value is None else float(slice_value)
        ys = np.linspace(*pressure_range, resolution)
        gx, gy = np.meshgrid(xs, ys)
        pts = to_coords(gx.ravel(), gy.ravel(), sv)
    else:
        raise ValueError(f"unknown plane {plane!r}")
    shape = gx.shape
    return {
        "plane": plane,
        "slice_value": sv,
        "x_axis": xs,
        "y_axis": ys,
        "nn_d": nn_distance(pts, obs_coords).reshape(shape),
        "counts": count_within(pts, obs_coords).reshape(shape),
        "inside_hull": inside_hull(pts, obs_coords).reshape(shape),
    }


def target_coverage(target_points: np.ndarray, obs: np.ndarray) -> dict[str, Any]:
    """Summary of evidence near a set of target points."""
    pts = _as2d(target_points)
    nn = nn_distance(pts, obs)
    counts = count_within(pts, obs)
    finite = np.isfinite(nn)
    return {
        "n_target_points": len(pts),
        "comparable_count_per_point": counts.tolist(),
        "comparable_count_total": int(counts.sum()),
        "min_nn_d": float(nn.min()) if finite.any() else None,
        "median_nn_d": float(np.median(nn)) if finite.all() else None,
        "fraction_inside_hull": float(inside_hull(pts, obs).mean()) if len(pts) else 0.0,
        "fraction_with_comparable": float((counts > 0).mean()) if len(pts) else 0.0,
    }
