"""Expected variance reduction of the target latent function from one hypothetical new observation."""

from __future__ import annotations

from typing import Any

import numpy as np
from scipy.special import expit

_GH_X, _GH_W = np.polynomial.hermite_e.hermegauss(24)
_GH_W = _GH_W / np.sqrt(2.0 * np.pi)


def normalize_weights(weights: np.ndarray | None, n: int) -> np.ndarray:
    if weights is None:
        return np.full(n, 1.0 / n)
    w = np.asarray(weights, dtype=float)
    return w / w.sum()


def mean_curvature(mu: np.ndarray, var: np.ndarray) -> np.ndarray:
    """wbar = E[sigmoid(f)(1 - sigmoid(f))], f ~ N(mu, var), by Gauss-Hermite."""
    f = mu[:, None] + np.sqrt(np.maximum(var, 0.0))[:, None] * _GH_X[None, :]
    s = expit(f)
    return np.asarray((s * (1.0 - s)) @ _GH_W)


def epistemic_mi(mu: np.ndarray, var: np.ndarray) -> np.ndarray:
    """Mutual information (nats) between the label and f: H[E s] - E[H(s)]; mu, var broadcast together."""
    mu, var = np.broadcast_arrays(np.asarray(mu, dtype=float), np.asarray(var, dtype=float))
    f = mu[..., None] + np.sqrt(np.maximum(var, 0.0))[..., None] * _GH_X
    s = np.clip(expit(f), 1e-12, 1 - 1e-12)
    h = -(s * np.log(s) + (1 - s) * np.log(1 - s))
    p = np.clip(np.clip(s, 0, 1) @ _GH_W, 1e-12, 1 - 1e-12)
    return np.asarray(np.maximum(-(p * np.log(p) + (1 - p) * np.log(1 - p)) - h @ _GH_W, 0.0))


def expected_variance_reduction(
    model: Any, target_X: np.ndarray, cand_X: np.ndarray, weights: np.ndarray | None = None
) -> np.ndarray:
    """EVR(c) = sum_t w_t Sigma(t,c)^2 / (Sigma(c,c) + 1/wbar_c). Shape (n_cand,)."""
    t = np.atleast_2d(target_X)
    c = np.atleast_2d(cand_X)
    w = normalize_weights(weights, len(t))
    mu_c, var_c = model.latent(c)
    wbar = mean_curvature(np.asarray(mu_c), np.asarray(var_c))
    cross = np.asarray(model.latent_cov(t, c))
    return np.asarray((w[:, None] * cross**2).sum(axis=0) / (np.asarray(var_c) + 1.0 / wbar))


def total_target_variance(model: Any, target_X: np.ndarray, weights: np.ndarray | None = None) -> float:
    t = np.atleast_2d(target_X)
    w = normalize_weights(weights, len(t))
    return float((w * np.asarray(model.latent(t)[1])).sum())


def evr_fraction(
    model: Any, target_X: np.ndarray, cand_X: np.ndarray, weights: np.ndarray | None = None
) -> np.ndarray:
    """EVR as a fraction of the current weighted target latent variance."""
    total = total_target_variance(model, target_X, weights)
    return expected_variance_reduction(model, target_X, cand_X, weights) / total


def expected_target_mi_reduction(
    model: Any, target_X: np.ndarray, cand_X: np.ndarray, weights: np.ndarray | None = None
) -> dict[str, Any]:
    """Weighted target epistemic MI before vs after each candidate, latent means unchanged.

    The updated variance is var_t - Sigma(t,c)^2 / (Sigma(c,c) + 1/wbar_c).
    """
    t = np.atleast_2d(target_X)
    c = np.atleast_2d(cand_X)
    w = normalize_weights(weights, len(t))
    mu_t, var_t = (np.asarray(a) for a in model.latent(t))
    mu_c, var_c = (np.asarray(a) for a in model.latent(c))
    cross = np.asarray(model.latent_cov(t, c))
    denom = var_c + 1.0 / mean_curvature(mu_c, var_c)
    var_after = np.maximum(var_t[:, None] - cross**2 / denom[None, :], 1e-12)
    before = float((w * epistemic_mi(mu_t, var_t)).sum())
    after = (w[:, None] * epistemic_mi(mu_t[:, None], var_after)).sum(axis=0)
    return {"mi_before": before, "mi_after": after, "reduction": before - after}
