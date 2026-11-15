"""Baseline classifiers sharing a fit / predict_proba API on (n, 3) analysis coordinates."""

from __future__ import annotations

from typing import Self

import numpy as np
from numpy.typing import ArrayLike, NDArray
from sklearn.linear_model import LogisticRegression

from blindspots.uncertainty.decomposition import decompose_ensemble

FloatArray = NDArray[np.float64]


def _as_xy(X: ArrayLike, y: ArrayLike) -> tuple[FloatArray, NDArray[np.int64]]:
    Xa = np.atleast_2d(np.asarray(X, dtype=float))
    ya = np.asarray(y, dtype=float).ravel().astype(np.int64)
    if Xa.shape[0] != ya.shape[0]:
        raise ValueError("X and y have different lengths")
    return Xa, ya


def _smoothed_rate(y: NDArray[np.int64]) -> float:
    return float((y.sum() + 1.0) / (y.size + 2.0))


class MajorityClass:
    """Predicts the Laplace-smoothed training prevalence everywhere; `predict` gives the majority label."""

    def __init__(self) -> None:
        self.p_: float | None = None

    def fit(self, X: ArrayLike, y: ArrayLike, groups: ArrayLike | None = None) -> MajorityClass:
        _, ya = _as_xy(X, y)
        self.p_ = _smoothed_rate(ya)
        return self

    def predict_proba(self, X: ArrayLike) -> FloatArray:
        if self.p_ is None:
            raise RuntimeError("model is not fitted")
        return np.full(np.atleast_2d(np.asarray(X)).shape[0], self.p_, dtype=float)

    def predict(self, X: ArrayLike) -> NDArray[np.int64]:
        return (self.predict_proba(X) >= 0.5).astype(np.int64)


class _StandardisedLogistic:
    """L2 logistic regression on standardised features; degrades to a constant when one class."""

    def __init__(self, C: float = 1.0) -> None:
        self.C = C
        self.mu_: FloatArray | None = None
        self.sd_: FloatArray | None = None
        self.clf_: LogisticRegression | None = None
        self.const_: float | None = None

    def _features(self, X: FloatArray) -> FloatArray:  # pragma: no cover - overridden
        raise NotImplementedError

    def fit(self, X: ArrayLike, y: ArrayLike, groups: ArrayLike | None = None) -> Self:
        Xa, ya = _as_xy(X, y)
        F = self._features(Xa)
        self.mu_ = F.mean(axis=0)
        sd = F.std(axis=0)
        self.sd_ = np.where(sd > 1e-12, sd, 1.0)
        if np.unique(ya).size < 2:
            self.const_, self.clf_ = _smoothed_rate(ya), None
        else:
            self.const_ = None
            self.clf_ = LogisticRegression(C=self.C, solver="lbfgs", max_iter=1000)
            self.clf_.fit((F - self.mu_) / self.sd_, ya)
        return self

    def predict_proba(self, X: ArrayLike) -> FloatArray:
        if self.mu_ is None or self.sd_ is None:
            raise RuntimeError("model is not fitted")
        Xa = np.atleast_2d(np.asarray(X, dtype=float))
        if self.clf_ is None:
            return np.full(Xa.shape[0], float(self.const_ or 0.5), dtype=float)
        p = self.clf_.predict_proba((self._features(Xa) - self.mu_) / self.sd_)[:, 1]
        return np.asarray(p, dtype=float)


class LogisticO2(_StandardisedLogistic):
    """L2 logistic regression on z_o2 only."""

    def _features(self, X: FloatArray) -> FloatArray:
        return X[:, [0]]


class LogisticO2Flow(_StandardisedLogistic):
    """L2 logistic regression on [z_o2, z_flow, z_flow^2], standardised."""

    def _features(self, X: FloatArray) -> FloatArray:
        return np.column_stack([X[:, 0], X[:, 1], X[:, 1] ** 2])


class BootstrapLogisticEnsemble:
    """B bootstrap-resampled LogisticO2Flow models; resamples whole experiments when groups are given.

    predict_proba returns the ensemble mean; uncertainty() returns p_mean/total/aleatoric/epistemic
    where epistemic is the ensemble mutual information (H(mean p) - mean H(p_b)).
    """

    accepts_groups = True

    def __init__(self, n_boot: int = 200, seed: int = 0, C: float = 1.0) -> None:
        self.n_boot = n_boot
        self.seed = seed
        self.C = C
        self.members_: list[LogisticO2Flow] = []

    def fit(self, X: ArrayLike, y: ArrayLike, groups: ArrayLike | None = None) -> BootstrapLogisticEnsemble:
        Xa, ya = _as_xy(X, y)
        n = ya.size
        rng = np.random.default_rng(self.seed)
        if groups is None:
            unit_rows: list[NDArray[np.int64]] = [np.array([i]) for i in range(n)]
        else:
            ga = np.asarray(groups).ravel()
            unit_rows = [np.flatnonzero(ga == g) for g in np.unique(ga)]
        self.members_ = []
        for _ in range(self.n_boot):
            pick = rng.integers(0, len(unit_rows), size=len(unit_rows))
            idx = np.concatenate([unit_rows[i] for i in pick])
            self.members_.append(LogisticO2Flow(self.C).fit(Xa[idx], ya[idx]))
        return self

    def _member_probs(self, X: ArrayLike) -> FloatArray:
        if not self.members_:
            raise RuntimeError("model is not fitted")
        return np.vstack([m.predict_proba(X) for m in self.members_])

    def predict_proba(self, X: ArrayLike) -> FloatArray:
        return np.asarray(self._member_probs(X).mean(axis=0), dtype=float)

    def uncertainty(self, X: ArrayLike) -> dict[str, FloatArray]:
        P = self._member_probs(X)
        out = decompose_ensemble(P)
        out["member_std"] = P.std(axis=0)
        return out


__all__ = ["BootstrapLogisticEnsemble", "LogisticO2", "LogisticO2Flow", "MajorityClass"]
