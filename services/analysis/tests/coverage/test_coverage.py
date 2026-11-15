from __future__ import annotations

import numpy as np

from blindspots.coverage.coverage import (
    count_within,
    coverage_grid,
    inside_hull,
    nn_distance,
    target_coverage,
    to_coords,
)


def test_nn_and_count_known_geometry() -> None:
    obs = np.array([[20.0, 1.0, 0.0], [24.0, 1.0, 0.0]])
    pts = np.array([[21.0, 1.0, 0.0], [30.0, 1.0, 0.0], [20.0, 1.25, 0.05]])
    nn = nn_distance(pts, obs)
    assert np.allclose(nn[0], 0.5)  # 1 % O2 = 0.5 scale units
    assert np.allclose(nn[1], 3.0)
    assert np.allclose(nn[2], np.sqrt(0.5**2 + 0.5**2))
    assert count_within(pts, obs).tolist() == [1, 0, 1]
    assert np.isinf(nn_distance(pts, np.zeros((0, 3)))).all()


def test_hull_2d_with_degenerate_pressure() -> None:
    obs = np.array([[20, 1, 0], [30, 1, 0], [20, 3, 0], [30, 3, 0]], dtype=float)
    pts = np.array([[25, 2, 0.0], [25, 2, 0.09], [25, 2, 0.2], [35, 2, 0.0], [25, 4, 0.0]])
    assert inside_hull(pts, obs).tolist() == [True, True, False, False, False]


def test_hull_1d_and_empty() -> None:
    obs = np.array([[20.0, 1, 0], [30.0, 1, 0]])
    assert inside_hull(np.array([[25.0, 1, 0], [31.0, 1, 0]]), obs).tolist() == [True, False]
    assert not inside_hull(np.array([[25.0, 1, 0]]), np.zeros((0, 3))).any()


def test_target_coverage_and_grid() -> None:
    obs = to_coords([20, 22, 24, 26], 101.325, [2, 5, 2, 5])
    tgt = to_coords([23, 35], 101.325, [3, 3])
    s = target_coverage(tgt, obs)
    assert s["n_target_points"] == 2
    assert s["fraction_inside_hull"] == 0.5
    assert s["min_nn_d"] < s["median_nn_d"]
    g = coverage_grid(obs, "o2_flow", 101.325, resolution=10)
    assert g["nn_d"].shape == (10, 10) and g["inside_hull"].any()
    g2 = coverage_grid(obs, "o2_pressure", 3.0, resolution=6)
    assert g2["counts"].shape == (6, 6)
