"""Greedy batch selection by sequential rank-1 downdates of the joint target+candidate covariance."""

from __future__ import annotations

from typing import Any

import numpy as np

from blindspots.acquisition.candidates import STATUS_TEXT, CandidateSet
from blindspots.acquisition.evr import normalize_weights, update_factor

NO_CANDIDATES: dict[str, str] = {"status": "no_eligible_candidates"}


class JointPosterior:
    """Posterior covariance over [targets; candidates] with outcome-averaged Laplace rank-1 updates."""

    def __init__(self, model: Any, target_X: np.ndarray, cand_X: np.ndarray, weights: np.ndarray | None):
        self.t = np.atleast_2d(target_X)
        self.nt = len(self.t)
        self.w = normalize_weights(weights, self.nt)
        z = np.vstack([self.t, np.atleast_2d(cand_X)])
        self.S = np.array(model.latent_cov(z, z), dtype=float)
        self.mu = np.asarray(model.latent(z)[0], dtype=float)
        self.total0 = float((self.w * np.diag(self.S)[: self.nt]).sum())
        self.S0 = self.S.copy()

    def evr(self, idx: np.ndarray | None = None) -> np.ndarray:
        """EVR for candidate indices (all remaining when None) under the current covariance."""
        cols = np.arange(self.nt, len(self.S)) if idx is None else np.asarray(idx) + self.nt
        var = np.diag(self.S)[cols]
        factor = update_factor(self.mu[cols], var)
        num = (self.w[:, None] * self.S[: self.nt][:, cols] ** 2).sum(axis=0)
        return np.asarray(num * factor)

    def evr_initial(self, i: int) -> float:
        col = self.nt + i
        var = self.S0[col, col]
        factor = float(update_factor(self.mu[col : col + 1], np.array([var]))[0])
        return float((self.w * self.S0[: self.nt, col] ** 2).sum() * factor)

    def downdate(self, i: int) -> None:
        col = self.nt + i
        var = self.S[col, col]
        factor = float(update_factor(self.mu[col : col + 1], np.array([var]))[0])
        v = self.S[:, col].copy()
        self.S -= np.outer(v, v) * factor


def _record(
    jp: JointPosterior, cs: CandidateSet, i: int, rank: int, marginal: float, method: str
) -> dict[str, Any]:
    standalone = jp.evr_initial(i)
    cov_t = jp.S0[: jp.nt, jp.nt + i]
    return {
        "rank": rank,
        "method": method,
        "candidate_index": int(i),
        "o2": float(cs.raw[i, 0]),
        "pressure_kpa": float(cs.raw[i, 1]),
        "airflow_cm_s": float(cs.raw[i, 2]),
        "standalone_evr": standalone,
        "marginal_evr": float(marginal),
        "standalone_fraction": standalone / jp.total0 if jp.total0 > 0 else 0.0,
        "marginal_fraction": float(marginal) / jp.total0 if jp.total0 > 0 else 0.0,
        "feasibility_status": cs.status[i],
        "feasibility_note": STATUS_TEXT[cs.status[i]],
        "reasons": {
            "posterior_variance_at_candidate": float(jp.S0[jp.nt + i, jp.nt + i]),
            "weighted_abs_covariance_with_target": float((jp.w * np.abs(cov_t)).sum()),
            "coverage_nn_d": float(cs.nn_d[i]) if np.isfinite(cs.nn_d[i]) else None,
        },
    }


def records_for_indices(
    model: Any,
    targets: np.ndarray,
    cs: CandidateSet,
    order: list[int],
    weights: np.ndarray | None,
    method: str,
) -> list[dict[str, Any]]:
    """Records for candidates taken in the given order, with sequential marginal EVR."""
    jp = JointPosterior(model, targets, cs.X, weights)
    out = []
    for rank, i in enumerate(order, start=1):
        marginal = float(jp.evr(np.array([i]))[0])
        out.append(_record(jp, cs, i, rank, marginal, method))
        jp.downdate(i)
    return out


def greedy_batch(
    model: Any,
    targets: np.ndarray,
    candidates: CandidateSet,
    k: int = 3,
    weights: np.ndarray | None = None,
) -> list[dict[str, Any]] | dict[str, str]:
    """Pick k candidates sequentially, each maximizing marginal EVR given earlier picks."""
    if len(candidates) == 0 or k < 1:
        return dict(NO_CANDIDATES)
    jp = JointPosterior(model, targets, candidates.X, weights)
    remaining = np.arange(len(candidates))
    out: list[dict[str, Any]] = []
    for rank in range(1, min(k, len(candidates)) + 1):
        gains = jp.evr(remaining)
        j = int(np.argmax(gains))  # ties -> lowest index (deterministic)
        i = int(remaining[j])
        out.append(_record(jp, candidates, i, rank, float(gains[j]), "greedy_evr"))
        jp.downdate(i)
        remaining = np.delete(remaining, j)
    return out
