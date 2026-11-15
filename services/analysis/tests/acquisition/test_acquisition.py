from __future__ import annotations

import re

import numpy as np

from blindspots.acquisition import baselines, candidates, targets
from blindspots.acquisition.batch import greedy_batch
from blindspots.acquisition.counterfactual import counterfactual
from blindspots.acquisition.evr import (
    evr_fraction,
    expected_target_mi_reduction,
    expected_variance_reduction,
    mean_curvature,
)
from blindspots.coverage.coverage import to_coords

FORBIDDEN = re.compile(r"\b(feasible|approved|safe|certified)\b", re.I)


def _targets(o2: float = 21.0):
    spec = targets.custom("t", o2, 101.3, airflow_min_cm_s=2.0, airflow_max_cm_s=10.0)
    return targets.target_points(spec, n_flow=4)


def test_target_points_shape_and_default_band() -> None:
    spec = targets.from_profile(
        {
            "name": "x",
            "status": "documented_nasa",
            "oxygen_percent": {"nominal": 21.0, "min": 20.9, "max": 23.5},
            "total_pressure_kpa": {"nominal": 101.3, "min": None, "max": None},
            "airflow_cm_s": None,
        }
    )
    assert spec.airflow_band_source == "default_band"
    assert (spec.airflow_min_cm_s, spec.airflow_max_cm_s) == (0.5, 20.3)
    x, w = targets.target_points(spec)
    assert x.shape == (5 * 1 * 9, 3) and np.isclose(w.sum(), 1)


def test_evr_matches_bruteforce_rank1(gp) -> None:
    T, w = _targets()
    C = to_coords([24.0, 28.0, 21.0], 101.325, [3.0, 8.0, 30.0])
    evr = expected_variance_reduction(gp, T, C, w)
    mu_c, var_c = gp.latent(C)
    for j in range(len(C)):
        # exact Gaussian update with pseudo-observation noise 1/wbar
        wbar = mean_curvature(mu_c[j : j + 1], var_c[j : j + 1])[0]
        S = gp.latent_cov(np.vstack([T, C[j : j + 1]]), np.vstack([T, C[j : j + 1]]))
        post = S[:-1, :-1] - np.outer(S[:-1, -1], S[:-1, -1]) / (S[-1, -1] + 1 / wbar)
        brute = (w * (np.diag(S)[:-1] - np.diag(post))).sum()
        assert np.isclose(evr[j], brute)
    frac = evr_fraction(gp, T, C, w)
    assert ((frac >= 0) & (frac <= 1)).all()


def test_mi_reduction_nonnegative(gp) -> None:
    T, w = _targets()
    C = to_coords([24.0, 40.0], 101.325, [3.0, 30.0])
    r = expected_target_mi_reduction(gp, T, C, w)
    assert r["mi_before"] >= r["mi_after"].max() - 1e-12 and (r["reduction"] >= -1e-12).all()


def _cs(obs: np.ndarray, raw: np.ndarray | None = None):
    return candidates.build_candidates(obs, raw)


def test_greedy_k1_equals_standalone_and_duplicates(gp, obs_coords) -> None:
    T, w = _targets()
    cs = _cs(obs_coords, np.array([[24.0, 101.325, 3.0], [35.0, 101.325, 30.0]]))
    r = greedy_batch(gp, T, cs, k=1, weights=w)
    assert isinstance(r, list) and np.isclose(r[0]["marginal_evr"], r[0]["standalone_evr"])
    dup = _cs(obs_coords, np.array([[24.0, 101.325, 3.0]] * 3))
    rd = greedy_batch(gp, T, dup, k=3, weights=w)
    assert isinstance(rd, list)
    gains = [x["marginal_evr"] for x in rd]
    assert gains[0] > gains[1] > gains[2] > 0
    assert all(np.isclose(x["standalone_evr"], gains[0]) for x in rd)


def test_greedy_matches_refit_variance(gp, obs_coords) -> None:
    """Sum of marginal gains equals brute-force joint variance reduction under the surrogate."""
    T, w = _targets()
    cs = _cs(obs_coords, np.array([[24.0, 101.325, 3.0], [26.0, 101.325, 6.0]]))
    r = greedy_batch(gp, T, cs, k=2, weights=w)
    assert isinstance(r, list)
    assert sum(x["marginal_evr"] for x in r) <= sum(x["standalone_evr"] for x in r) + 1e-12


def test_determinism_and_target_dependence(gp, obs_coords) -> None:
    cs = _cs(obs_coords)
    T1, w = _targets(21.0)
    a = greedy_batch(gp, T1, cs, k=3, weights=w)
    b = greedy_batch(gp, T1, cs, k=3, weights=w)
    assert a == b
    T2, _ = _targets(35.0)
    c = greedy_batch(gp, T2, cs, k=3, weights=w)
    assert isinstance(a, list) and isinstance(c, list)
    assert [x["candidate_index"] for x in a] != [x["candidate_index"] for x in c]


def test_empty_candidates(gp, obs_coords) -> None:
    T, w = _targets()
    empty = _cs(obs_coords, np.zeros((0, 3)))
    assert greedy_batch(gp, T, empty, 3, w) == {"status": "no_eligible_candidates"}
    assert baselines.random_candidate(gp, T, empty, 0) == {"status": "no_eligible_candidates"}
    assert baselines.uncertainty_sampling(gp, T, empty) == {"status": "no_eligible_candidates"}
    assert baselines.nearest_gap(gp, T, empty) == {"status": "no_eligible_candidates"}


def test_baselines_shape(gp, obs_coords) -> None:
    T, w = _targets()
    cs = _cs(obs_coords)
    keys = set(greedy_batch(gp, T, cs, 1, w)[0])  # type: ignore[arg-type,index]
    r1 = baselines.random_candidate(gp, T, cs, seed=3, weights=w)
    r2 = baselines.random_candidate(gp, T, cs, seed=3, weights=w)
    assert r1 == r2 and isinstance(r1, list) and set(r1[0]) == keys
    u = baselines.uncertainty_sampling(gp, T, cs, weights=w)
    g = baselines.nearest_gap(gp, T, cs, weights=w)
    assert isinstance(u, list) and isinstance(g, list) and set(u[0]) == keys == set(g[0])
    assert cs.nn_d[g[0]["candidate_index"]] > 1.0


def test_feasibility_text_and_status(obs_coords) -> None:
    cs = _cs(obs_coords)
    assert set(cs.status) == {candidates.WITHIN, candidates.OUTSIDE}
    for s in candidates.STATUS_TEXT.values():
        assert not FORBIDDEN.search(s)
    assert (
        candidates.STATUS_TEXT[candidates.OUTSIDE] == "Feasibility not verified; requires qualified review."
    )
    cs2 = _cs(obs_coords, np.array([[24.0, 101.325, 5.0], [40.0, 101.325, 5.0]]))
    assert cs2.status == [candidates.WITHIN, candidates.OUTSIDE]


def test_counterfactual(gp) -> None:
    T, w = _targets()
    x = to_coords([24.0], 101.325, [3.0])
    r = counterfactual(gp, x, T, w)
    s1, s0 = r["scenarios"]
    assert np.isclose(s1["probability"] + s0["probability"], 1.0)
    assert s1["label"] == "hypothetical outcome"
    assert s0["p_at_candidate"] <= r["p_sustained_at_candidate"] <= s1["p_at_candidate"]
    assert s1["target_latent_var"] <= r["current"]["target_latent_var"] + 1e-12
    assert r["expected_posterior_target_var"] <= r["current"]["target_latent_var"] + 1e-12
