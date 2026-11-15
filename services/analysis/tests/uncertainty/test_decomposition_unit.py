from __future__ import annotations

import numpy as np

from blindspots.uncertainty.decomposition import (
    binary_entropy,
    binary_entropy_from_logit,
    decompose_ensemble,
    decompose_latent,
    gauss_hermite_probability,
    sigmoid,
)


def test_entropy_values() -> None:
    assert binary_entropy(np.array([0.5]))[0] == np.log(2)
    assert binary_entropy(np.array([0.0, 1.0])).max() < 1e-9
    f = np.array([-3.0, 0.0, 2.0])
    np.testing.assert_allclose(binary_entropy_from_logit(f), binary_entropy(sigmoid(f)), atol=1e-9)


def test_gauss_hermite_against_monte_carlo() -> None:
    mu, var = np.array([0.7]), np.array([2.0])
    z = np.random.default_rng(0).normal(size=400_000)
    f = mu + np.sqrt(var) * z
    p, a = gauss_hermite_probability(mu, var, 48)
    assert abs(p[0] - sigmoid(f).mean()) < 3e-3
    assert abs(a[0] - binary_entropy(sigmoid(f)).mean()) < 3e-3


def test_decomposition_identities() -> None:
    mu = np.linspace(-4, 4, 9)
    d0 = decompose_latent(mu, np.zeros(9))
    assert np.allclose(d0["epistemic"], 0, atol=1e-9)
    d = decompose_latent(mu, np.full(9, 4.0))
    np.testing.assert_allclose(d["total"], d["aleatoric"] + d["epistemic"], atol=1e-12)
    assert np.all(d["epistemic"] > 0)
    e = decompose_ensemble(np.array([[0.1, 0.5], [0.9, 0.5]]))
    assert e["epistemic"][0] > 0.3 and abs(e["epistemic"][1]) < 1e-9
