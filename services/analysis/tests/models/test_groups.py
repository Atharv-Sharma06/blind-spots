"""Tests for analysis-group helpers (synthetic rows only)."""

from __future__ import annotations

import pandas as pd
import pytest

from blindspots.models.groups import (
    assign_group_ids,
    group_label,
    make_group_id,
    modelability,
    parse_group_id,
    summarize_groups,
)


def _fixture_observations() -> pd.DataFrame:
    rows = []
    for exp in range(7):
        for step, label in enumerate([1, 1, 0] if exp < 3 else [1, 1]):
            rows.append(
                {
                    "observation_id": f"fixture:{exp}#s{step}",
                    "experiment_id": f"fixture:{exp}",
                    "campaign_group": "FIXTURE/A" if exp < 4 else "FIXTURE/B",
                    "material_family": "pmma_rod",
                    "flame_configuration": "opposed",
                    "oxygen_percent": 15.0 + exp,
                    "airflow_cm_s": 10.0 / (step + 1),
                    "total_pressure_kpa": None,
                    "pressure_for_analysis_kpa": 101.3,
                    "label": label,
                    "included_in_training": True,
                }
            )
    rows.append(
        {**rows[0], "observation_id": "fixture:x#s0", "experiment_id": "fixture:x", "material_family": None}
    )
    return pd.DataFrame(rows)


def test_group_id_round_trip() -> None:
    gid = make_group_id("pmma_rod", "stagnation")
    assert gid == "pmma_rod__stagnation"
    assert parse_group_id(gid) == ("pmma_rod", "stagnation")
    with pytest.raises(ValueError):
        parse_group_id("pmma_rod")


def test_label_uses_readable_names() -> None:
    assert group_label("pmma_rod", "stagnation") == "PMMA rods · axial stagnation flow"


def test_assign_group_ids_handles_missing_family_and_configuration() -> None:
    frame = pd.DataFrame(
        [
            {"material_family": "sibal_fabric", "flame_configuration": "concurrent"},
            {"material_family": "sibal_fabric", "flame_configuration": None},
            {"material_family": None, "flame_configuration": "opposed"},
        ]
    )
    assert list(assign_group_ids(frame)) == ["sibal_fabric__concurrent", "sibal_fabric__unknown", None]


def test_modelability_rule() -> None:
    obs = _fixture_observations()
    train = obs[obs["material_family"].notna()]
    assert modelability(train).status == "modeled"
    few = train[train["experiment_id"].isin(["fixture:0", "fixture:1"])]
    verdict = modelability(few)
    assert verdict.status == "insufficient_data"
    assert verdict.reason is not None and "training experiments" in verdict.reason


def test_summarize_groups_counts_and_ranges() -> None:
    groups = summarize_groups(_fixture_observations())
    assert len(groups) == 1
    g = groups[0]
    assert g["group_id"] == "pmma_rod__opposed"
    assert g["n_experiments"] == 7
    assert g["label_counts"] == {"sustained": 14, "not_sustained": 3}
    assert g["oxygen_percent_range"] == [15.0, 21.0]
    assert g["campaigns"] == ["FIXTURE/A", "FIXTURE/B"]
    assert g["pressure_measured"] is False
    assert g["model_status"] == "modeled"
