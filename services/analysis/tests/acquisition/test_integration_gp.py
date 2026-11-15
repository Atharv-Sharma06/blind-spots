from __future__ import annotations

import numpy as np
import pytest

from blindspots.acquisition import candidates, targets
from blindspots.acquisition.batch import greedy_batch
from blindspots.acquisition.counterfactual import counterfactual
from blindspots.acquisition.evr import expected_variance_reduction, mean_curvature, predictive_probability
from blindspots.coverage.coverage import to_coords

try:
    from blindspots.models.gp_laplace import GPLaplaceClassifier
except ImportError as exc:  # pragma: no cover
    GPLaplaceClassifier = None
    _REASON = f"blindspots.models.gp_laplace not importable yet: {exc}"
else:
    _REASON = ""

pytestmark = pytest.mark.skipif(GPLaplaceClassifier is None, reason=_REASON or "n/a")


def test_pipeline_with_real_gp(obs_xy: tuple[np.ndarray, np.ndarray]) -> None:
    X, y = obs_xy
    m = GPLaplaceClassifier(length_scales=[4.0, 1.0, 0.2], n_restarts=1)  # type: ignore[misc]
    m.fit(X, y)
    spec = targets.custom("t", 21.0, 101.3, airflow_min_cm_s=2.0, airflow_max_cm_s=10.0)
    T, w = targets.target_points(spec, n_flow=4)
    cs = candidates.build_candidates(X, candidates.candidate_raw_grid()[::7])
    r = greedy_batch(m, T, cs, k=2, weights=w)
    assert isinstance(r, list) and r[0]["marginal_evr"] >= r[1]["marginal_evr"] - 1e-12
    cf = counterfactual(m, to_coords([24.0], 101.325, [3.0]), T, w)
    assert np.isclose(sum(s["probability"] for s in cf["scenarios"]), 1.0)


def test_evr_tracks_exact_laplace_refits(obs_xy: tuple[np.ndarray, np.ndarray]) -> None:
    """EVR approximates the outcome-probability-weighted variance reduction of exact Laplace refits.

    A refit also moves the modes of nearby training points, which no rank-1 update captures, so the
    check is: within 12 % for candidates with a material reduction, and never worse than the older
    prior-averaged-curvature approximation.
    """
    X, y = obs_xy
    m = GPLaplaceClassifier(length_scales=[4.0, 1.0, 0.2], n_restarts=1)  # type: ignore[misc]
    m.fit(X, y)
    spec = targets.custom("t", 22.0, 101.3, airflow_min_cm_s=1.0, airflow_max_cm_s=10.0)
    T, w = targets.target_points(spec, n_flow=4)
    C = to_coords([18.0, 22.0, 21.0], 101.325, [1.0, 5.0, 2.0])
    evr = expected_variance_reduction(m, T, C, w)
    before = float((w * m.latent(T)[1]).sum())
    mu_c, var_c = m.latent(C)
    p1 = predictive_probability(mu_c, var_c)
    wbar = mean_curvature(mu_c, var_c)
    old = (w[:, None] * m.latent_cov(T, C) ** 2).sum(axis=0) / (var_c + 1.0 / wbar)
    for j in range(len(C)):
        exact = 0.0
        for label, prob in ((1, p1[j]), (0, 1.0 - p1[j])):
            after = m.condition_on(C[j : j + 1], np.array([label]))
            exact += prob * (before - float((w * after.latent(T)[1]).sum()))
        assert exact > 0.05
        assert abs(evr[j] - exact) <= 0.12 * exact
        assert abs(evr[j] - exact) <= abs(old[j] - exact) + 1e-12
