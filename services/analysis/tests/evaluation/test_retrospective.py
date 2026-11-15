from __future__ import annotations

import numpy as np

from blindspots.evaluation import retrospective as r
from blindspots.models.features import TrainingSet


def synthetic_ts(n_exp: int = 16, per: int = 3, seed: int = 0) -> TrainingSet:
    rng = np.random.default_rng(seed)
    n = n_exp * per
    o2 = rng.uniform(15, 25, n)
    flow = rng.uniform(0.5, 20, n)
    X = np.column_stack([o2, np.log1p(flow), np.zeros(n)])
    y = (rng.uniform(size=n) < 1 / (1 + np.exp(-(o2 - 18)))).astype(np.int64)
    y[:2] = (0, 1)
    groups = np.repeat([f"E:{i}" for i in range(n_exp)], per)
    camp = np.repeat(["A" if i < 8 else "B" for i in range(n_exp)], per)
    return TrainingSet(X, y, groups, camp, np.array([f"o{i}" for i in range(n)]), "synthetic_family")


def test_scenarios_and_target_never_in_training() -> None:
    ts = synthetic_ts()
    scens, _ = r.define_scenarios(ts)
    assert scens
    s = scens[0]
    res = r.run_seed(ts, s.target_experiments, seed=1, n_rounds=3)
    assert res is not None
    pool_ok = set(np.unique(ts.groups).tolist()) - set(s.target_experiments)
    for strat in r.STRATEGIES:
        have = set(res[strat]["training_experiments"])
        assert have <= pool_ok  # target never trained on, picks only from the pool
        assert not have & set(s.target_experiments)
        assert set(res[strat]["picks"]) <= pool_ok
        assert len(set(res[strat]["picks"])) == len(res[strat]["picks"])
        assert len(res[strat]["log_loss"]) == 4


def test_determinism() -> None:
    ts = synthetic_ts()
    s = r.define_scenarios(ts)[0][0]
    a = r.run_seed(ts, s.target_experiments, seed=2, n_rounds=2)
    b = r.run_seed(ts, s.target_experiments, seed=2, n_rounds=2)
    assert a == b


def test_aggregate_schema() -> None:
    ts = synthetic_ts()
    s = r.define_scenarios(ts)[0][0]
    results = [x for x in (r.run_seed(ts, s.target_experiments, k, n_rounds=2) for k in range(3)) if x]
    out = r.aggregate_scenario(s, "synthetic_family__x", ts, results, 3)
    for key in ("name", "group_id", "target_definition", "n_seeds", "n_rounds", "metric", "curves"):
        assert key in out
    assert set(out["curves"]) == set(r.STRATEGIES)
    assert set(out["curves"]["evr"][0]) == {"n_acquired", "mean", "ci95"}
    assert out["metric"] == "target log loss"
    assert "evr_minus_random" in out["paired_differences"]
    assert "evr_minus_uncertainty_sampling" in out["paired_differences"]
    assert set(out["area_under_curve"]) == set(r.STRATEGIES)
    assert isinstance(out["interpretation"], str)
