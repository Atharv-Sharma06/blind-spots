from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from blindspots.models.baselines import BootstrapLogisticEnsemble, LogisticO2, LogisticO2Flow, MajorityClass
from blindspots.models.features import (
    build_training_set,
    from_coords,
    to_coords,
)


def synthetic_observations() -> pd.DataFrame:
    rows = []
    rng = np.random.default_rng(0)
    for e in range(12):
        for s in range(3):
            rows.append(
                {
                    "observation_id": f"E:{e}#s{s}",
                    "experiment_id": f"E:{e}",
                    "step_index": s,
                    "campaign_group": "C1" if e < 6 else "C2",
                    "material_family": "pmma_slab" if e < 10 else "other",
                    "flame_configuration": "opposed" if e % 2 == 0 else "concurrent",
                    "oxygen_percent": 18.0 + e,
                    "airflow_cm_s": float(rng.uniform(0.5, 20)),
                    "pressure_for_analysis_kpa": 101.325 if s else 70.0,
                    "label": (s % 2) if e != 3 else None,
                    "included_in_training": e != 4,
                }
            )
    df = pd.DataFrame(rows)
    df.loc[0, "airflow_cm_s"] = np.nan
    return df


def test_coords_round_trip_and_values() -> None:
    Z = to_coords([21.0, 30.0], [0.0, np.e - 1], [101.325, 50.0])
    assert Z.shape == (2, 3)
    np.testing.assert_allclose(Z[0], [21.0, 0.0, 0.0], atol=1e-12)
    np.testing.assert_allclose(Z[1, 1], 1.0)
    o2, flow, p = from_coords(Z)
    np.testing.assert_allclose([o2[1], flow[1], p[1]], [30.0, np.e - 1, 50.0])


def test_build_training_set_filters() -> None:
    df = synthetic_observations()
    ts = build_training_set(df, "pmma_slab")
    assert set(ts.groups) <= {f"E:{e}" for e in range(10)}
    assert "E:4" not in set(ts.groups) and "E:3" not in set(ts.groups)
    assert ts.n_dropped_missing_coords == 1 and ts.X.shape == (ts.n, 3) and set(ts.y) <= {0, 1}
    assert ts.n == 3 * 8 - 1
    only = build_training_set(df, "pmma_slab", "opposed")
    assert only.n < ts.n and only.configuration == "opposed"
    # pressure uses the analysis column
    assert np.isclose(only.X[:, 2].min(), np.log(70.0 / 101.325))
    with pytest.raises(KeyError):
        build_training_set(df.drop(columns=["label"]), "pmma_slab")
    sub = ts.subset([0, 2])
    assert sub.n == 2 and sub.family == "pmma_slab"


def _data(n: int = 60) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    rng = np.random.default_rng(3)
    o2 = rng.uniform(15, 35, n)
    z = np.log1p(rng.uniform(0, 20, n))
    X = np.column_stack([o2, z, np.zeros(n)])
    y = (rng.uniform(size=n) < 1 / (1 + np.exp(-(o2 - 25) / 3))).astype(int)
    return X, y, np.repeat(np.arange(n // 3), 3)


def test_baselines_api() -> None:
    X, y, _g = _data()
    for model in (MajorityClass(), LogisticO2(), LogisticO2Flow()):
        p = model.fit(X, y).predict_proba(X)
        assert p.shape == (len(y),) and np.all((p > 0) & (p < 1))
    p1 = LogisticO2().fit(X, y).predict_proba(X)
    assert np.corrcoef(p1, X[:, 0])[0, 1] > 0.9  # monotone in O2
    assert MajorityClass().fit(X, y).p_ == pytest.approx((y.sum() + 1) / (len(y) + 2))
    # one-class training data does not crash
    assert np.allclose(LogisticO2Flow().fit(X, np.ones(len(y))).predict_proba(X), (len(y) + 1) / (len(y) + 2))


def test_bootstrap_ensemble_uncertainty_and_determinism() -> None:
    X, y, g = _data()
    ens = BootstrapLogisticEnsemble(n_boot=40, seed=1).fit(X, y, groups=g)
    u = ens.uncertainty(X)
    np.testing.assert_allclose(u["total"], u["aleatoric"] + u["epistemic"], atol=1e-9)
    assert np.all(u["epistemic"] >= 0) and np.allclose(u["p_mean"], ens.predict_proba(X))
    ens2 = BootstrapLogisticEnsemble(n_boot=40, seed=1).fit(X, y, groups=g)
    np.testing.assert_array_equal(ens.predict_proba(X), ens2.predict_proba(X))
    assert BootstrapLogisticEnsemble().n_boot == 200
    assert u["epistemic"].max() > 0  # members disagree somewhere inside the data
