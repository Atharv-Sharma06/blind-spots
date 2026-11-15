from __future__ import annotations

import numpy as np

from blindspots.coverage.coverage import to_coords
from blindspots.uncertainty.explanations import (
    INSUFFICIENT_SENTENCE,
    aggregate_target,
    explain_point,
    explain_points,
    supported_probability,
)

OBS = to_coords([20, 24, 20, 24, 22], 101.325, [2, 2, 8, 8, 5])


def _codes(r) -> set[str]:
    return {x["code"] for x in r["reasons"]}


def test_supported() -> None:
    r = explain_point(to_coords([22], 101.325, [5]), OBS, latent_std_ratio=0.3)
    assert r["verdict"] == "supported" and "outside_hull" not in _codes(r)


def test_insufficient_exact_sentence() -> None:
    r = explain_point(to_coords([38], 60.0, [30]), OBS, latent_std_ratio=0.95)
    assert r["verdict"] == "insufficient_evidence" and r["sentence"] == INSUFFICIENT_SENTENCE
    assert {"sparse_observations", "outside_hull", "unobserved_pressure"} <= _codes(r)


def test_extrapolation_and_other_codes() -> None:
    r = explain_point(
        to_coords([38], 101.325, [5]),
        OBS,
        latent_std_ratio=0.7,
        fold_spread=0.4,
        other_family_obs=to_coords([38], 101.325, [5]),
    )
    assert r["verdict"] == "extrapolation"
    assert {"model_instability", "other_family_evidence_only"} <= _codes(r)


def test_outcome_variability() -> None:
    r = explain_point(to_coords([22], 101.325, [5]), OBS, latent_std_ratio=0.3, aleatoric=0.6, total=0.69)
    assert "outcome_variability" in _codes(r)
    r2 = explain_point(to_coords([22], 101.325, [5]), OBS, latent_std_ratio=0.3, aleatoric=0.2, total=0.69)
    assert "outcome_variability" not in _codes(r2)


def test_no_observations() -> None:
    r = explain_point(np.array([20.0, 1.0, 0.0]), np.zeros((0, 3)), latent_std_ratio=0.99)
    assert r["verdict"] == "insufficient_evidence" and r["metrics"]["nn_d"] is None


def test_not_supported_always_has_a_reason() -> None:
    # inside the observed region, but the latent std ratio fails
    r = explain_point(to_coords([22], 101.325, [5]), OBS, latent_std_ratio=0.7)
    assert r["verdict"] == "extrapolation"
    assert r["metrics"]["inside_hull"] and r["reasons"][-1]["code"] == "high_knowledge_uncertainty"
    assert "0.70" in r["reasons"][-1]["message"]


def test_reason_messages_use_canonical_terms() -> None:
    r = explain_point(to_coords([38], 60.0, [30]), OBS, latent_std_ratio=0.95)
    text = " ".join(x["message"] for x in r["reasons"])
    assert "No ISS tests nearby." in text
    assert "observation(s)" not in text and "ln-pressure" not in text and "factor of 1.69" in text


def test_vectorised_matches_single_point() -> None:
    pts = to_coords([22, 38, 22], [101.325, 60.0, 101.325], [5, 30, 5])
    ratio = np.array([0.3, 0.95, 0.7])
    ev = explain_points(pts, OBS, ratio)
    for i in range(3):
        one = explain_point(pts[i], OBS, latent_std_ratio=float(ratio[i]))
        assert ev["verdict"][i] == one["verdict"] and ev["reasons"][i] == one["reasons"]


def test_target_aggregation_d2() -> None:
    agg = aggregate_target(["supported"] * 3 + ["extrapolation"] * 3, [5] * 6, [[]] * 6)
    assert agg["verdict"] == "supported" and agg["points_supported"] == 3 and agg["n_target_points"] == 6
    agg = aggregate_target(["supported"] + ["extrapolation"] * 3, [1, 1, 0, 0], [[]] * 4)
    assert agg["verdict"] == "extrapolation" and agg["reasons"][0]["code"] == "target_points_not_supported"
    assert "not represented" not in agg["sentence"] and "1 of 4 points" in agg["sentence"]
    agg = aggregate_target(["insufficient_evidence"] * 2, [0, 0])
    assert (
        agg["verdict"] == "insufficient_evidence"
        and "not represented in the integrated records" in agg["sentence"]
    )
    assert agg["sentence"].startswith(INSUFFICIENT_SENTENCE)
    sp = supported_probability(
        np.array([0.2, 0.9, 0.5]), np.array([0.25, 0.25, 0.5]), ["supported", "x", "supported"]
    )
    assert sp["p_sustained_min"] == 0.2 and sp["p_sustained_max"] == 0.5
    assert abs((sp["p_sustained_mean"] or 0) - 0.4) < 1e-12
    assert (
        supported_probability(np.array([0.5]), np.array([1.0]), ["extrapolation"])["p_sustained_mean"] is None
    )
