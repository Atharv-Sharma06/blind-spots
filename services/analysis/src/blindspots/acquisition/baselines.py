"""Comparison strategies returning the same record shape as greedy_batch."""

from __future__ import annotations

from typing import Any

import numpy as np

from blindspots.acquisition.batch import NO_CANDIDATES, records_for_indices
from blindspots.acquisition.candidates import CandidateSet
from blindspots.coverage.coverage import SCALES


def random_candidate(
    model: Any,
    targets: np.ndarray,
    candidates: CandidateSet,
    seed: int = 0,
    k: int = 1,
    weights: np.ndarray | None = None,
) -> list[dict[str, Any]] | dict[str, str]:
    if len(candidates) == 0:
        return dict(NO_CANDIDATES)
    rng = np.random.default_rng(seed)
    order = [int(i) for i in rng.choice(len(candidates), size=min(k, len(candidates)), replace=False)]
    return records_for_indices(model, targets, candidates, order, weights, "random")


def uncertainty_sampling(
    model: Any,
    targets: np.ndarray,
    candidates: CandidateSet,
    k: int = 1,
    weights: np.ndarray | None = None,
) -> list[dict[str, Any]] | dict[str, str]:
    """Largest epistemic mutual information at the candidate itself; ignores the target."""
    if len(candidates) == 0:
        return dict(NO_CANDIDATES)
    mi = np.asarray(model.uncertainty(candidates.X)["epistemic"])
    order = [int(i) for i in np.argsort(-mi, kind="stable")[:k]]
    return records_for_indices(model, targets, candidates, order, weights, "uncertainty_sampling")


def nearest_gap(
    model: Any,
    targets: np.ndarray,
    candidates: CandidateSet,
    k: int = 1,
    weights: np.ndarray | None = None,
) -> list[dict[str, Any]] | dict[str, str]:
    """Candidate closest to the target centroid (standardized units) among those with nn_d > 1."""
    eligible = np.flatnonzero(candidates.nn_d > 1.0) if len(candidates) else np.zeros(0, dtype=int)
    if len(eligible) == 0:
        return dict(NO_CANDIDATES)
    centroid = np.atleast_2d(targets).mean(axis=0)
    d = np.linalg.norm((candidates.X[eligible] - centroid) / SCALES, axis=1)
    order = [int(eligible[i]) for i in np.argsort(d, kind="stable")[:k]]
    return records_for_indices(model, targets, candidates, order, weights, "nearest_gap")
