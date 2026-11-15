from __future__ import annotations

import numpy as np
import pytest

from blindspots.acquisition import candidates, targets
from blindspots.acquisition.batch import greedy_batch
from blindspots.acquisition.counterfactual import counterfactual
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
