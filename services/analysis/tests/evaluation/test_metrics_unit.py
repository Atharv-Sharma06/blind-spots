from __future__ import annotations

import numpy as np
from sklearn import metrics as skm

from blindspots.evaluation.metrics import (
    brier,
    ece,
    group_bootstrap_ci,
    log_loss,
    reliability_curve,
    roc_auc,
)


def _yp(n: int = 200) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(0)
    p = rng.uniform(size=n)
    p[:5] = [0.0, 1.0, 0.5, 0.5, 1.0]
    return (rng.uniform(size=n) < p).astype(int), p


def test_agree_with_sklearn() -> None:
    y, p = _yp()
    assert abs(brier(y, p) - skm.brier_score_loss(y, p)) < 1e-12
    assert abs(log_loss(y, p) - skm.log_loss(y, np.clip(p, 1e-6, 1 - 1e-6), labels=[0, 1])) < 1e-10
    assert abs(roc_auc(y, np.round(p, 1)) - skm.roc_auc_score(y, np.round(p, 1))) < 1e-12  # ties
    assert roc_auc(np.ones(5), np.linspace(0, 1, 5)) is None


def test_ece_and_reliability() -> None:
    y, p = _yp()
    out = ece(y, p)
    assert out["counts"].sum() == len(y) and len(out["counts"]) == 10
    # independent computation
    bins = np.minimum((p * 10).astype(int), 9)
    exp = sum(
        (bins == b).sum() * abs(p[bins == b].mean() - y[bins == b].mean())
        for b in range(10)
        if (bins == b).any()
    ) / len(y)
    assert abs(out["ece"] - exp) < 1e-12
    cal = np.array([0.05, 0.05, 0.95, 0.95])
    r = reliability_curve([0, 0, 1, 1], cal)
    assert r["counts"][0] == 2 and r["counts"][9] == 2 and np.isnan(r["observed_frequency"][4])
    assert abs(ece([0, 0, 1, 1], cal)["ece"] - 0.05) < 1e-12


def test_group_bootstrap_ci() -> None:
    y, p = _yp(120)
    g = np.repeat(np.arange(40), 3)
    a = group_bootstrap_ci(brier, y, p, g, B=300, seed=1)
    b = group_bootstrap_ci(brier, y, p, g, B=300, seed=1)
    assert a == b and a["lo"] <= a["estimate"] <= a["hi"] and a["n_groups"] == 40
    auc = group_bootstrap_ci(roc_auc, y, p, g, B=200, seed=2)
    assert auc["n_boot_valid"] == 200
    one = group_bootstrap_ci(roc_auc, np.ones(6), np.linspace(0, 1, 6), np.arange(6), B=20)
    assert one["lo"] is None and one["n_boot_valid"] == 0
