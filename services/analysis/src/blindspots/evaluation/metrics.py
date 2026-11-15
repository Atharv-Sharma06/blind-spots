"""Probabilistic-classification metrics, calibration data and group-bootstrap intervals."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import numpy as np
from numpy.typing import ArrayLike, NDArray
from scipy.stats import rankdata

FloatArray = NDArray[np.float64]
LOG_LOSS_CLIP = 1e-6
N_BINS = 10


def _yp(y: ArrayLike, p: ArrayLike) -> tuple[FloatArray, FloatArray]:
    ya = np.asarray(y, dtype=float).ravel()
    pa = np.asarray(p, dtype=float).ravel()
    if ya.shape != pa.shape:
        raise ValueError("y and p have different shapes")
    return ya, pa


def brier(y: ArrayLike, p: ArrayLike) -> float:
    ya, pa = _yp(y, p)
    return float(np.mean((pa - ya) ** 2))


def log_loss(y: ArrayLike, p: ArrayLike) -> float:
    ya, pa = _yp(y, p)
    pc = np.clip(pa, LOG_LOSS_CLIP, 1.0 - LOG_LOSS_CLIP)
    return float(-np.mean(ya * np.log(pc) + (1.0 - ya) * np.log1p(-pc)))


def roc_auc(y: ArrayLike, p: ArrayLike) -> float | None:
    """Area under the ROC curve (ties count one half); None when only one class is present."""
    ya, pa = _yp(y, p)
    n1 = int(np.sum(ya == 1))
    n0 = int(np.sum(ya == 0))
    if n1 == 0 or n0 == 0:
        return None
    ranks = rankdata(pa)
    return float((ranks[ya == 1].sum() - n1 * (n1 + 1) / 2.0) / (n1 * n0))


def reliability_curve(y: ArrayLike, p: ArrayLike, n_bins: int = N_BINS) -> dict[str, Any]:
    """Equal-width binning of p; empty bins have count 0 and NaN mean/observed values."""
    ya, pa = _yp(y, p)
    edges = np.linspace(0.0, 1.0, n_bins + 1)
    idx = np.clip(np.digitize(pa, edges[1:-1], right=False), 0, n_bins - 1)
    counts = np.bincount(idx, minlength=n_bins).astype(int)
    sum_p = np.bincount(idx, weights=pa, minlength=n_bins)
    sum_y = np.bincount(idx, weights=ya, minlength=n_bins)
    with np.errstate(invalid="ignore", divide="ignore"):
        mean_pred = np.where(counts > 0, sum_p / np.maximum(counts, 1), np.nan)
        obs = np.where(counts > 0, sum_y / np.maximum(counts, 1), np.nan)
    return {"bin_edges": edges, "counts": counts, "mean_predicted": mean_pred, "observed_frequency": obs}


def ece(y: ArrayLike, p: ArrayLike, n_bins: int = N_BINS) -> dict[str, Any]:
    """Expected calibration error with equal-width bins; also returns the per-bin reliability data."""
    curve = reliability_curve(y, p, n_bins)
    counts = curve["counts"]
    n = counts.sum()
    gap = np.where(counts > 0, np.abs(curve["mean_predicted"] - curve["observed_frequency"]), 0.0)
    value = float(np.sum(counts * gap) / n) if n > 0 else float("nan")
    return {"ece": value, **curve}


def ece_value(y: ArrayLike, p: ArrayLike, n_bins: int = N_BINS) -> float:
    return float(ece(y, p, n_bins)["ece"])


Metric = Callable[[ArrayLike, ArrayLike], "float | None"]


def group_bootstrap_ci(
    metric: Metric,
    y: ArrayLike,
    p: ArrayLike,
    groups: ArrayLike,
    B: int = 1000,
    seed: int = 0,
    alpha: float = 0.05,
) -> dict[str, Any]:
    """Percentile CI of metric(y, p) resampling whole groups (experiments) with replacement.

    Draws for which the metric is undefined (None/NaN, e.g. a single class) are skipped and counted.
    """
    ya, pa = _yp(y, p)
    ga = np.asarray(groups).ravel()
    if ga.shape != ya.shape:
        raise ValueError("groups must align with y")
    uniq = np.unique(ga)
    rows = [np.flatnonzero(ga == g) for g in uniq]
    rng = np.random.default_rng(seed)
    vals: list[float] = []
    for _ in range(B):
        pick = rng.integers(0, len(rows), size=len(rows))
        idx = np.concatenate([rows[i] for i in pick])
        v = metric(ya[idx], pa[idx])
        if v is not None and np.isfinite(v):
            vals.append(float(v))
    est = metric(ya, pa)
    if len(vals) == 0:
        lo = hi = None
    else:
        lo, hi = (float(q) for q in np.quantile(vals, [alpha / 2.0, 1.0 - alpha / 2.0]))
    return {
        "estimate": None if est is None else float(est),
        "lo": lo,
        "hi": hi,
        "n_boot_valid": len(vals),
        "n_boot": B,
        "n_groups": len(uniq),
    }
