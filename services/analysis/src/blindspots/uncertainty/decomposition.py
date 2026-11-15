"""Predictive uncertainty decomposition for binary classifiers (nats).

total      = H(E[p])            entropy of the mean predictive probability
aleatoric  = E[H(p)]            expected entropy (irreducible outcome noise under the model)
epistemic  = total - aleatoric  mutual information between outcome and the latent / ensemble member
"""

from __future__ import annotations

from functools import lru_cache

import numpy as np
from numpy.typing import NDArray

FloatArray = NDArray[np.float64]

N_NODES_DEFAULT = 48
_EPS = 1e-12


def sigmoid(x: FloatArray) -> FloatArray:
    """Numerically stable logistic function."""
    return np.asarray(0.5 * (1.0 + np.tanh(0.5 * np.asarray(x, dtype=float))), dtype=float)


def softplus(x: FloatArray) -> FloatArray:
    return np.asarray(np.logaddexp(0.0, x), dtype=float)


def binary_entropy(p: FloatArray) -> FloatArray:
    """Entropy (nats) of a Bernoulli(p); 0 log 0 = 0."""
    p = np.clip(np.asarray(p, dtype=float), _EPS, 1.0 - _EPS)
    return np.asarray(-(p * np.log(p) + (1.0 - p) * np.log1p(-p)), dtype=float)


def binary_entropy_from_logit(f: FloatArray) -> FloatArray:
    """H(sigmoid(f)) computed stably from the logit: softplus(f) - sigmoid(f) * f."""
    f = np.asarray(f, dtype=float)
    return np.maximum(softplus(f) - sigmoid(f) * f, 0.0)


@lru_cache(maxsize=8)
def gauss_hermite_nodes(n_nodes: int) -> tuple[FloatArray, FloatArray]:
    """Nodes/weights for E[g(z)], z ~ N(0, 1) (probabilists' Hermite, weights sum to 1)."""
    if n_nodes < 2:
        raise ValueError("n_nodes must be >= 2")
    nodes, weights = np.polynomial.hermite_e.hermegauss(n_nodes)
    return nodes.astype(float), (weights / np.sqrt(2.0 * np.pi)).astype(float)


def gauss_hermite_probability(
    mean: FloatArray, var: FloatArray, n_nodes: int = N_NODES_DEFAULT
) -> tuple[FloatArray, FloatArray]:
    """Return (E[sigmoid(f)], E[H(sigmoid(f))]) for f ~ N(mean, var), by Gauss-Hermite quadrature."""
    nodes, weights = gauss_hermite_nodes(n_nodes)
    mean = np.asarray(mean, dtype=float)
    std = np.sqrt(np.maximum(np.asarray(var, dtype=float), 0.0))
    f = mean[:, None] + std[:, None] * nodes[None, :]
    p_mean = sigmoid(f) @ weights
    aleatoric = binary_entropy_from_logit(f) @ weights
    return np.clip(p_mean, 0.0, 1.0), aleatoric


def decompose_latent(
    mean: FloatArray, var: FloatArray, n_nodes: int = N_NODES_DEFAULT
) -> dict[str, FloatArray]:
    """Decomposition for a Gaussian latent posterior pushed through the logistic link."""
    p_mean, aleatoric = gauss_hermite_probability(mean, var, n_nodes)
    total = binary_entropy(p_mean)
    epistemic = np.maximum(total - aleatoric, 0.0)
    return {"p_mean": p_mean, "total": total, "aleatoric": aleatoric, "epistemic": epistemic}


def decompose_ensemble(probs: FloatArray) -> dict[str, FloatArray]:
    """Decomposition for an ensemble; probs has shape (n_members, n_points)."""
    probs = np.asarray(probs, dtype=float)
    if probs.ndim != 2:
        raise ValueError("probs must have shape (n_members, n_points)")
    p_mean = probs.mean(axis=0)
    total = binary_entropy(p_mean)
    aleatoric = binary_entropy(probs).mean(axis=0)
    epistemic = np.maximum(total - aleatoric, 0.0)
    return {"p_mean": p_mean, "total": total, "aleatoric": aleatoric, "epistemic": epistemic}
