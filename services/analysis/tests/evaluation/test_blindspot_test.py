"""Blind-spot test helpers on synthetic arrays and a synthetic fixture group."""

from __future__ import annotations

import numpy as np
import pytest
from scipy.stats import spearmanr

from blindspots.evaluation.blindspot_test import (
    interpretation,
    partial_spearman,
    pointwise_log_loss,
    spearman_permutation,
    verdict_from,
)


def test_spearman_permutation_monotone_and_null() -> None:
    x = np.arange(30, dtype=float)
    rho, p = spearman_permutation(x, x**2, n_perm=200, seed=1)
    assert rho == 1.0 and p is not None and p < 0.02
    rng = np.random.default_rng(0)
    u, v = rng.random(40), rng.random(40)
    rho2, p2 = spearman_permutation(u, v, n_perm=2000, seed=1)
    ref = spearmanr(u, v)
    assert rho2 == pytest.approx(ref.statistic)
    assert p2 == pytest.approx(ref.pvalue / 2 if ref.statistic > 0 else 1 - ref.pvalue / 2, abs=0.02)
    assert spearman_permutation(np.ones(10), np.arange(10.0))[0] is None


def test_spearman_permutation_is_seeded() -> None:
    rng = np.random.default_rng(5)
    a, b = rng.random(25), rng.random(25)
    assert spearman_permutation(a, b, 100, 7) == spearman_permutation(a, b, 100, 7)


def test_partial_spearman_removes_common_driver() -> None:
    rng = np.random.default_rng(2)
    z = rng.random(200)
    x, y = z + 0.01 * rng.random(200), z + 0.01 * rng.random(200)
    assert partial_spearman(x, y, z) is not None
    assert abs(partial_spearman(x, y, z) or 0.0) < 0.5


def test_verdict_rules() -> None:
    pos = {"spearman_rho": 0.5, "p_value": 0.01}
    weak = {"spearman_rho": 0.2, "p_value": 0.2}
    neg = {"spearman_rho": -0.1, "p_value": 0.8}
    assert verdict_from(pos, pos) == "supported"
    assert verdict_from(neg, {"spearman_rho": 0.0, "p_value": 0.5}) == "not_supported"
    assert verdict_from(pos, weak) == "inconclusive"
    assert verdict_from(pos, neg) == "inconclusive"


def test_interpretation_is_generated_from_numbers() -> None:
    pt = {"n": 50, "spearman_rho": 0.4, "p_value": 0.0005, "n_misclassified": 4, "auroc_error_detection": 0.7}
    gr = {"n_groups": 12, "spearman_rho": 0.1, "p_value": 0.4}
    text = interpretation("inconclusive", pt, gr, {"rho_aleatoric_point": 0.8})
    assert "n=50" in text and "rho=0.40" in text and "aleatoric" in text and "<0.001" in text


def test_pointwise_log_loss_clips() -> None:
    ll = pointwise_log_loss(np.array([1.0, 0.0]), np.array([0.0, 1.0]))
    assert np.all(np.isfinite(ll)) and ll[0] > 10
