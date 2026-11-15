from __future__ import annotations

import numpy as np

from blindspots.coverage.coverage import to_coords
from blindspots.uncertainty.explanations import INSUFFICIENT_SENTENCE, explain_point

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
