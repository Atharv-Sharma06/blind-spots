"""Grouped cross-validation with per-fold hyperparameter refitting and leakage checks."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Any, Protocol

import numpy as np
from numpy.typing import ArrayLike, NDArray

from blindspots.evaluation.metrics import brier, ece_value, log_loss, roc_auc
from blindspots.models.features import TrainingSet

IntArray = NDArray[np.int64]
FloatArray = NDArray[np.float64]
Split = tuple[IntArray, IntArray]


class _Model(Protocol):
    def fit(self, X: Any, y: Any, *args: Any, **kwargs: Any) -> Any: ...
    def predict_proba(self, X: Any) -> FloatArray: ...


def grouped_kfold(groups: ArrayLike, k: int, seed: int = 0) -> list[Split]:
    """Deterministic grouped K-fold: whole groups go to one test fold, folds balanced by row count."""
    ga = np.asarray(groups).ravel()
    uniq, inverse, sizes = np.unique(ga, return_inverse=True, return_counts=True)
    if k < 2 or k > uniq.size:
        raise ValueError(f"k must be in [2, n_groups={uniq.size}]")
    rng = np.random.default_rng(seed)
    tiebreak = rng.permutation(uniq.size)
    order = sorted(range(uniq.size), key=lambda i: (-int(sizes[i]), int(tiebreak[i])))
    fold_size = np.zeros(k, dtype=int)
    fold_n_groups = np.zeros(k, dtype=int)
    fold_of_group = np.zeros(uniq.size, dtype=int)
    for gi in order:
        f = min(range(k), key=lambda j: (int(fold_size[j]), int(fold_n_groups[j]), j))
        fold_of_group[gi] = f
        fold_size[f] += sizes[gi]
        fold_n_groups[f] += 1
    row_fold = fold_of_group[inverse]
    return [(np.flatnonzero(row_fold != f), np.flatnonzero(row_fold == f)) for f in range(k)]


def leave_one_group_out(campaigns: ArrayLike) -> list[Split]:
    """One split per distinct value (sorted), holding out all rows of that value."""
    ga = np.asarray(campaigns).ravel()
    uniq = np.unique(ga)
    if uniq.size < 2:
        raise ValueError("need at least two groups")
    return [(np.flatnonzero(ga != g), np.flatnonzero(ga == g)) for g in uniq]


def assert_no_leakage(train_idx: ArrayLike, test_idx: ArrayLike, groups: ArrayLike) -> None:
    """Raise AssertionError if train and test share a row or a group."""
    tr = np.asarray(train_idx, dtype=int)
    te = np.asarray(test_idx, dtype=int)
    ga = np.asarray(groups).ravel()
    if np.intersect1d(tr, te).size:
        raise AssertionError("train and test share row indices")
    shared = np.intersect1d(ga[tr], ga[te])
    if shared.size:
        raise AssertionError(f"groups appear in both train and test: {shared[:5].tolist()}")


@dataclass
class CVResult:
    oof: dict[str, FloatArray]  # p_mean + uncertainty arrays (NaN where not predicted/available)
    fold_id: IntArray  # fold index of each row (-1: never in a test fold)
    fold_metrics: list[dict[str, Any]]
    metrics: dict[str, float | None]  # pooled out-of-fold metrics
    hyperparameters: list[dict[str, float]] = field(default_factory=list)


def _metrics(y: FloatArray, p: FloatArray) -> dict[str, float | None]:
    return {
        "brier": brier(y, p),
        "log_loss": log_loss(y, p),
        "roc_auc": roc_auc(y, p),
        "ece": ece_value(y, p),
    }


def cross_validate(
    model_factory: Callable[[], _Model],
    training_set: TrainingSet,
    splitter: Sequence[Split] | Callable[[TrainingSet], Sequence[Split]],
) -> CVResult:
    """Fit a fresh model (hyperparameters refit) on each training fold only; predict the held-out fold.

    `splitter` is a list of (train_idx, test_idx) pairs (e.g. from grouped_kfold) or a callable taking
    the TrainingSet. Leakage by experiment_id is asserted for every split.
    """
    ts = training_set
    splits = splitter(ts) if callable(splitter) else splitter
    n = ts.n
    oof: dict[str, FloatArray] = {}
    fold_id = np.full(n, -1, dtype=np.int64)
    fold_metrics: list[dict[str, Any]] = []
    hypers: list[dict[str, float]] = []
    y = ts.y.astype(float)
    for fi, (tr, te) in enumerate(splits):
        assert_no_leakage(tr, te, ts.groups)
        model = model_factory()
        if getattr(model, "accepts_groups", False):
            model.fit(ts.X[tr], ts.y[tr], groups=ts.groups[tr])
        else:
            model.fit(ts.X[tr], ts.y[tr])
        pred: dict[str, FloatArray] = {}
        unc = getattr(model, "uncertainty", None)
        if callable(unc):
            pred = {k: np.asarray(v, dtype=float) for k, v in unc(ts.X[te]).items()}
        if "p_mean" not in pred:
            pred["p_mean"] = np.asarray(model.predict_proba(ts.X[te]), dtype=float)
        for key, val in pred.items():
            if key not in oof:
                oof[key] = np.full(n, np.nan)
            oof[key][te] = val
        fold_id[te] = fi
        fm: dict[str, Any] = {
            "fold": fi,
            "n_train": len(tr),
            "n_test": len(te),
            "held_out_groups": sorted(set(ts.groups[te].tolist())),
            **_metrics(y[te], pred["p_mean"]),
        }
        fold_metrics.append(fm)
        hp = getattr(model, "hyperparameters", None)
        if callable(hp):
            hypers.append(hp())
    covered = fold_id >= 0
    pooled = _metrics(y[covered], oof["p_mean"][covered]) if covered.any() else {}
    return CVResult(
        oof=oof, fold_id=fold_id, fold_metrics=fold_metrics, metrics=pooled, hyperparameters=hypers
    )
