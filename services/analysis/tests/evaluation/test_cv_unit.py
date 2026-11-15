from __future__ import annotations

import numpy as np
import pytest

from blindspots.evaluation.cv import assert_no_leakage, cross_validate, grouped_kfold, leave_one_group_out
from blindspots.models.baselines import LogisticO2
from blindspots.models.features import TrainingSet
from blindspots.models.gp_laplace import GPLaplaceClassifier


def synthetic_training_set(n_exp: int = 16, per: int = 3, seed: int = 0) -> TrainingSet:
    rng = np.random.default_rng(seed)
    n = n_exp * per
    o2 = rng.uniform(15, 35, n)
    X = np.column_stack([o2, np.log1p(rng.uniform(0, 20, n)), np.zeros(n)])
    y = (rng.uniform(size=n) < 1 / (1 + np.exp(-(o2 - 25) / 2))).astype(np.int64)
    groups = np.repeat([f"E:{i}" for i in range(n_exp)], per)
    camp = np.repeat(["A" if i < 8 else "B" for i in range(n_exp)], per)
    return TrainingSet(X, y, groups, camp, np.array([f"o{i}" for i in range(n)]), "synthetic_family")


def test_grouped_kfold_properties() -> None:
    ts = synthetic_training_set()
    folds = grouped_kfold(ts.groups, 4, seed=3)
    again = grouped_kfold(ts.groups, 4, seed=3)
    assert all(
        np.array_equal(a[0], b[0]) and np.array_equal(a[1], b[1]) for a, b in zip(folds, again, strict=True)
    )
    all_test = np.concatenate([te for _, te in folds])
    assert sorted(all_test.tolist()) == list(range(ts.n))  # partition
    for tr, te in folds:
        assert_no_leakage(tr, te, ts.groups)
        assert len(tr) + len(te) == ts.n
    assert {len(te) for _, te in folds} == {12}
    other = grouped_kfold(ts.groups, 4, seed=4)
    assert any(not np.array_equal(a[1], b[1]) for a, b in zip(folds, other, strict=True))
    with pytest.raises(ValueError):
        grouped_kfold(ts.groups, 99)


def test_logo_and_leakage_detection() -> None:
    ts = synthetic_training_set()
    splits = leave_one_group_out(ts.campaign_group)
    assert len(splits) == 2
    for tr, te in splits:
        assert_no_leakage(tr, te, ts.groups)
        assert len(set(ts.campaign_group[tr]) & set(ts.campaign_group[te])) == 0
    with pytest.raises(AssertionError):
        assert_no_leakage(np.array([0, 1, 2]), np.array([3, 4]), np.array(["a", "b", "c", "a", "d"]))
    with pytest.raises(AssertionError):
        assert_no_leakage(np.array([0, 1]), np.array([1]), np.array(["a", "b"]))


def test_cross_validate_refits_per_fold_and_returns_oof() -> None:
    ts = synthetic_training_set()
    fitted_sizes: list[int] = []
    seen_groups: list[set[str]] = []

    class Spy(GPLaplaceClassifier):
        def fit(self, X, y):  # type: ignore[no-untyped-def]
            fitted_sizes.append(len(y))
            return super().fit(X, y)

    folds = grouped_kfold(ts.groups, 4, seed=0)

    def factory() -> GPLaplaceClassifier:
        return Spy([3.0, 1.0, 0.3], 4.0, fixed=["l_p", "l_flow"], n_restarts=1)

    res = cross_validate(factory, ts, folds)
    assert fitted_sizes == [len(tr) for tr, _ in folds]
    assert len(res.hyperparameters) == 4
    assert np.all(res.fold_id >= 0) and np.all(np.isfinite(res.oof["p_mean"]))
    assert {"epistemic", "total", "aleatoric"} <= set(res.oof)
    assert len(res.fold_metrics) == 4 and {"brier", "log_loss", "roc_auc", "ece"} <= set(res.metrics)
    for fm, (_, te) in zip(res.fold_metrics, folds, strict=True):
        seen_groups.append(set(fm["held_out_groups"]))
        assert fm["n_test"] == len(te)
    assert set.union(*seen_groups) == set(ts.groups)
    # hyperparameters can differ between folds (refit) and no fold used test data: same data, same result
    res2 = cross_validate(factory, ts, lambda t: grouped_kfold(t.groups, 4, seed=0))
    np.testing.assert_array_equal(res.oof["p_mean"], res2.oof["p_mean"])


def test_cross_validate_with_baseline_and_leaky_split() -> None:
    ts = synthetic_training_set()
    res = cross_validate(LogisticO2, ts, leave_one_group_out(ts.campaign_group))
    assert "epistemic" not in res.oof and res.metrics["brier"] is not None
    bad = [(np.arange(0, ts.n - 1), np.array([ts.n - 1]))]
    with pytest.raises(AssertionError):
        cross_validate(LogisticO2, ts, bad)
