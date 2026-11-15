"""Validation study on a synthetic fixture group: leakage, determinism and API shape."""

from __future__ import annotations

import numpy as np
import pandas as pd

from blindspots.evaluation.cv import assert_no_leakage, grouped_kfold
from blindspots.evaluation.validation import (
    METRICS,
    MODEL_NAMES,
    bootstrap_models,
    choose_mean_function,
    validate_group,
)
from blindspots.models.registry import TrainConfig, group_frame, group_training_set

GROUP = "pmma_rod__opposed"


def _frames(n_exp: int = 14, seed: int = 11) -> tuple[pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(seed)
    rows, exps = [], []
    for e in range(n_exp):
        o2 = 15.0 + 7.0 * rng.random()
        exps.append({"experiment_id": f"fixture:{e}", "oxygen_percent_initial": o2})
        for s, flow in enumerate([20.0, 8.0, 3.0, 1.0, 0.4]):
            label = int(o2 + 1.5 * np.log1p(flow) + rng.normal(0, 0.8) > 19.0)
            rows.append(
                {
                    "observation_id": f"fixture:{e}#s{s}",
                    "experiment_id": f"fixture:{e}",
                    "campaign_group": "FIXTURE/A" if e % 2 == 0 else "FIXTURE/B",
                    "material_family": "pmma_rod",
                    "flame_configuration": "opposed",
                    "step_index": s,
                    "oxygen_percent": o2 - 0.1 * s,
                    "airflow_cm_s": flow,
                    "pressure_for_analysis_kpa": 101.3,
                    "label": label,
                    "included_in_training": True,
                    "exclusion_reason": None,
                    "confidence": "medium" if s % 2 else "high",
                    "quality_flags": ["flow_off_transient"] if (s == 4 and label == 0) else [],
                    "extinction_mode": None,
                }
            )
    return pd.DataFrame(rows), pd.DataFrame(exps)


def _cfg() -> TrainConfig:
    return TrainConfig(
        n_restarts=2, cv_repeats=2, cv_seeds=(0, 1), n_bootstrap=40, ensemble_members=8, n_permutations=60
    )


def test_cv_folds_never_share_experiments() -> None:
    obs, _ = _frames()
    ts = group_training_set(group_frame(obs, GROUP, _cfg()), GROUP)
    for seed in range(5):
        splits = grouped_kfold(ts.groups, 5, seed=seed)
        assert len(splits) == 5
        for tr, te in splits:
            assert_no_leakage(tr, te, ts.groups)
            assert set(ts.groups[tr]).isdisjoint(ts.groups[te])


def test_bootstrap_models_majority_auc_is_half() -> None:
    y = np.array([1, 1, 0, 1, 0, 1, 1, 1], dtype=float)
    groups = np.array(list("aabbccdd"))
    preds = {"gp": np.tile(np.linspace(0.2, 0.9, 8), (2, 1)), "majority_class": np.full((2, 8), 0.7)}
    out = bootstrap_models(y, preds, groups, B=30, seed=0)
    assert out["models"]["majority_class"]["auc"]["value"] == 0.5
    assert out["contrast"]["log_loss"]["ci95"] is not None


def test_mean_selection_keeps_constant_unless_clearly_better() -> None:
    obs, _ = _frames()
    ts = group_training_set(group_frame(obs, GROUP, _cfg()), GROUP)
    sel = choose_mean_function(ts, _cfg())
    assert sel["chosen"] in ("constant", "linear_o2")
    ci = sel["diff_ci95"]
    assert (sel["chosen"] == "linear_o2") == (ci is not None and ci[1] < 0)


def test_validation_output_matches_api_shape_and_is_deterministic() -> None:
    obs, exp = _frames()
    meta = {"group_id": GROUP, "mean_function": "constant", "label": "fixture"}
    a = validate_group(obs, exp, meta, _cfg())
    b = validate_group(obs, exp, meta, _cfg())
    for key in ("group_id", "n_experiments", "n_observations", "cv", "logo", "reliability",
                "error_distribution", "subgroups", "sensitivity", "blindspot_test"):  # fmt: skip
        assert key in a
    assert a["n_experiments"] == 14 and a["n_observations"] == 70
    assert {m["name"] for m in a["cv"]["models"]} == set(MODEL_NAMES)
    for m in a["cv"]["models"]:
        for k in METRICS:
            assert set(m[k]) == {"value", "ci95"}
    assert a["cv"]["scheme"] == "grouped 5-fold by experiment x 2 repeats"
    assert a["logo"]["applicable"] and {f["held_out"] for f in a["logo"]["folds"]} == {
        "FIXTURE/A",
        "FIXTURE/B",
    }
    for f in a["logo"]["folds"]:
        assert {"held_out", "n", "brier", "log_loss", "auc"} <= set(f)
    assert all(
        {"lo", "hi", "count", "mean_predicted", "observed_frequency"} <= set(r)
        for r in a["reliability"]["bins"]
    )
    assert len(a["error_distribution"]["bins"]) == len(a["error_distribution"]["counts"]) + 1
    assert all({"name", "n", "brier", "log_loss"} <= set(s) for s in a["subgroups"])
    names = {s["variant"] for s in a["sensitivity"]}
    assert "drop flow_off_transient rows" in names and "add low-confidence rows" in names
    assert all({"variant", "n_training", "brier", "log_loss", "auc", "delta_vs_primary"} <= set(s)
               for s in a["sensitivity"])  # fmt: skip
    bt = a["blindspot_test"]
    assert bt["verdict"] in ("supported", "not_supported", "inconclusive") and bt["interpretation"]
    assert set(bt["point_level"]) >= {"n", "spearman_rho", "p_value", "auroc_error_detection"}
    assert set(bt["group_level"]) >= {"n_groups", "spearman_rho", "p_value", "pairs"}
    assert {"experiment_id", "pre_reveal_uncertainty", "error"} <= set(bt["group_level"]["pairs"][0])
    a.pop("runtime_s"), b.pop("runtime_s")
    a["blindspot_test"]["group_level"].pop("runtime_s")
    b["blindspot_test"]["group_level"].pop("runtime_s")
    assert a == b
