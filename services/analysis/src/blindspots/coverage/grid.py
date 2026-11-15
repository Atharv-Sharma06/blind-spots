"""Rectangular coverage grids with independent x/y resolution and axis ranges (used by the HTTP API).

Same coordinates and reference scales as ``coverage.coverage`` (CONTRACTS section 4); this module only adds
nx/ny and explicit axis ranges, which ``coverage_grid`` does not offer.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from blindspots.config import COVERAGE_SCALES, P_REF_KPA
from blindspots.coverage.coverage import (
    Plane,
    count_within,
    inside_hull,
    nn_distance,
    to_coords,
)

DEFAULT_SLICE = {"o2_flow": 101.3, "o2_pressure": 10.0}
SLICE_SCALE_KEY = {"o2_flow": "p", "o2_pressure": "flow"}


def slice_coordinate(plane: Plane, values: Any) -> np.ndarray:
    """Analysis-coordinate of the slice variable (z_p for o2_flow, z_flow for o2_pressure)."""
    v = np.asarray(values, dtype=float)
    if plane == "o2_flow":
        return np.log(v / P_REF_KPA)
    return np.log1p(v)


def coverage_grid_xy(
    obs_coords: np.ndarray,
    plane: Plane,
    slice_value: float,
    nx: int,
    ny: int,
    x_range: tuple[float, float],
    y_range: tuple[float, float],
) -> dict[str, Any]:
    xs = np.linspace(x_range[0], x_range[1], nx)
    if plane == "o2_flow":
        ys = np.geomspace(y_range[0], y_range[1], ny)
        gx, gy = np.meshgrid(xs, ys)
        pts = to_coords(gx.ravel(), slice_value, gy.ravel())
    elif plane == "o2_pressure":
        ys = np.linspace(y_range[0], y_range[1], ny)
        gx, gy = np.meshgrid(xs, ys)
        pts = to_coords(gx.ravel(), gy.ravel(), slice_value)
    else:
        raise ValueError(f"unknown plane {plane!r}")
    shape = gx.shape
    return {
        "x": xs,
        "y": ys,
        "nn_d": nn_distance(pts, obs_coords).reshape(shape),
        "counts": count_within(pts, obs_coords).reshape(shape),
        "inside_hull": inside_hull(pts, obs_coords).reshape(shape),
    }


def in_slice_mask(obs_coords: np.ndarray, plane: Plane, slice_value: float) -> np.ndarray:
    """Observations whose slice coordinate is within 1 reference-scale unit of the slice value."""
    if len(obs_coords) == 0:
        return np.zeros(0, dtype=bool)
    col = 2 if plane == "o2_flow" else 1
    target = float(slice_coordinate(plane, slice_value))
    scale = COVERAGE_SCALES[SLICE_SCALE_KEY[plane]]
    return np.asarray(np.abs(obs_coords[:, col] - target) / scale <= 1.0 + 1e-12)
