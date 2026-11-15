"""Test double implementing the GPLaplaceClassifier interface with exact GP regression (fixtures only)."""

from __future__ import annotations

import numpy as np
import pytest
from scipy.special import expit

_GH_X, _GH_W = np.polynomial.hermite_e.hermegauss(24)
_GH_W = _GH_W / np.sqrt(2 * np.pi)
SCALES = np.array([2.0, 0.5, 0.1])


class FixtureGP:
    """Exact GP regression on +-3 targets; ARD RBF kernel in coordinates scaled by `ls`."""

    def __init__(self, X: np.ndarray, y: np.ndarray, ls: np.ndarray | None = None, noise: float = 4.0):
        self.X = np.atleast_2d(X)
        self.y = np.asarray(y, dtype=float)
        self.ls = SCALES * 2.0 if ls is None else ls
        self.noise = noise
        K = self._k(self.X, self.X) + noise * np.eye(len(self.X))
        self.Kinv = np.linalg.inv(K)
        self.alpha = self.Kinv @ (3.0 * (2 * self.y - 1))

    def _k(self, A: np.ndarray, B: np.ndarray) -> np.ndarray:
        d = (A[:, None, :] - B[None, :, :]) / self.ls
        return np.exp(-0.5 * (d**2).sum(-1))

    def prior_var(self) -> float:
        return 1.0

    def latent(self, Xs):
        Xs = np.atleast_2d(Xs)
        ks = self._k(Xs, self.X)
        return ks @ self.alpha, np.diag(self.latent_cov(Xs, Xs))

    def latent_cov(self, A, B):
        A, B = np.atleast_2d(A), np.atleast_2d(B)
        return self._k(A, B) - self._k(A, self.X) @ self.Kinv @ self._k(self.X, B)

    def predict_proba(self, Xs):
        mu, var = self.latent(Xs)
        f = mu[:, None] + np.sqrt(var)[:, None] * _GH_X
        return expit(f) @ _GH_W

    def uncertainty(self, Xs):
        mu, var = self.latent(Xs)
        f = mu[:, None] + np.sqrt(var)[:, None] * _GH_X
        s = np.clip(expit(f), 1e-12, 1 - 1e-12)
        h = -(s * np.log(s) + (1 - s) * np.log(1 - s)) @ _GH_W
        p = np.clip(s @ _GH_W, 1e-12, 1 - 1e-12)
        total = -(p * np.log(p) + (1 - p) * np.log(1 - p))
        sd = np.sqrt(var)
        return {
            "total": total,
            "aleatoric": h,
            "epistemic": np.maximum(total - h, 0),
            "latent_std": sd,
            "latent_std_ratio": sd / np.sqrt(self.prior_var()),
        }

    def condition_on(self, X_new, y_new):
        return FixtureGP(
            np.vstack([self.X, np.atleast_2d(X_new)]),
            np.concatenate([self.y, np.atleast_1d(y_new)]),
            self.ls,
            self.noise,
        )


def make_obs() -> tuple[np.ndarray, np.ndarray]:
    """Synthetic observations in analysis coordinates (o2, ln(1+u), ln(p/p0))."""
    rng = np.random.default_rng(1)
    o2 = rng.uniform(18, 30, 24)
    z = np.log1p(rng.uniform(1, 20, 24))
    X = np.column_stack([o2, z, np.zeros(24)])
    y = (o2 + 2 * z + rng.normal(0, 1.5, 24) > 28).astype(float)
    return X, y


@pytest.fixture
def gp() -> FixtureGP:
    X, y = make_obs()
    return FixtureGP(X, y)


@pytest.fixture
def obs_xy() -> tuple[np.ndarray, np.ndarray]:
    return make_obs()


@pytest.fixture
def obs_coords() -> np.ndarray:
    return make_obs()[0]
