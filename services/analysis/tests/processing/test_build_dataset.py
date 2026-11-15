from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from fixture_builders import build_fixture_repo

from blindspots.config import REPO_ROOT
from blindspots.pipeline.build_dataset import build


@pytest.fixture
def report_and_rows(
    tmp_path: Path,
) -> tuple[dict[str, Any], dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    root = build_fixture_repo(tmp_path / "repo")
    out = tmp_path / "out"
    report = build(root, out)
    exps = {e["test_label"]: e for e in json.loads((out / "experiments.json").read_text())}
    obs = {o["observation_id"]: o for o in json.loads((out / "observations.json").read_text())}
    return report, exps, obs


def test_counts_and_chunks(report_and_rows: Any) -> None:
    report, _exps, obs = report_and_rows
    assert report["errors"] == []
    assert report["chunks_found"] == {"tests": ["fixture_chunk"], "steps": ["fixture_chunk"]}
    assert report["counts"]["experiments"] == 4 and len(obs) == 9
    assert report["counts"]["experiments_by_campaign"] == {"BASS-II/Olson": 4}


def test_labels_and_exclusion_reasons(report_and_rows: Any) -> None:
    report, _, obs = report_and_rows
    o = lambda t, i: obs[f"PSI-25:{t}#s{i}"]  # noqa: E731
    assert [o("O1", i)["label"] for i in range(4)] == [1, 1, 1, 0]
    assert o("O1", 0)["included_in_training"] and o("O1", 0)["airflow_basis"] == "air_display"
    assert o("O1", 0)["airflow_cm_s"] == pytest.approx(1.0066 * 20)
    assert o("O2", 1)["exclusion_reason"] == "not_ignited" and o("O2", 1)["label"] is None
    assert o("O3a", 0)["exclusion_reason"] == "low_confidence"  # step confidence low, row kept
    assert o("O3a", 1)["label"] == 0 and "no_sustained_propagation" in o("O3a", 1)["quality_flags"]
    reasons = report["exclusions"]["observations_by_reason"]
    assert reasons["not_ignited"] == 1 and reasons["low_confidence"] == 1


def test_provenance_failure_is_flagged_and_excluded(report_and_rows: Any) -> None:
    report, _exps, obs = report_and_rows
    bad = obs["PSI-25:O20#s0"]
    assert "provenance_mismatch" in bad["quality_flags"]
    assert bad["included_in_training"] is False and bad["exclusion_reason"] == "provenance_mismatch"
    assert report["provenance_failures"]["observations"] == ["PSI-25:O20#s0"]


def test_pot_conversion_and_oxygen(report_and_rows: Any) -> None:
    _, _exps, obs = report_and_rows
    o = obs["PSI-25:O2#s0"]  # pot 0.54, restrictor 2, GMT 49: pot calibration of day 49 / 190
    assert o["airflow_basis"] == "pot_calibration" and o["flow_calibration_ref"] is not None
    assert o["airflow_cm_s"] is not None
    # O1 has 4 steps, O2 22.2 -> 21.7: oxygen interpolated linearly
    assert [obs[f"PSI-25:O1#s{i}"]["oxygen_percent"] for i in (0, 3)] == [22.2, 21.7]
    assert obs["PSI-25:O1#s1"]["oxygen_percent"] == pytest.approx(22.2 + (21.7 - 22.2) / 3)
    assert "o2_interpolated" in obs["PSI-25:O1#s1"]["quality_flags"]


def test_pressure_is_assumed_never_measured(report_and_rows: Any) -> None:
    report, exps, obs = report_and_rows
    e = exps["O1"]
    assert e["total_pressure_kpa"] is None and e["total_pressure_atm_raw"] is None
    assert e["pressure_assumed_kpa"] == 101.325
    assert e["pressure_assumption_source"] == "standard atmosphere placeholder pending sourced ISS profile"
    assert {"pressure_assumed", "pressure_assumption_unsourced"} <= set(e["quality_flags"])
    o = obs["PSI-25:O1#s0"]
    assert o["total_pressure_kpa"] is None and o["pressure_for_analysis_kpa"] == 101.325
    assert report["pressure_assumption_sourced"] is False


def test_experiment_exclusions(report_and_rows: Any) -> None:
    _, exps, _ = report_and_rows
    assert exps["O1"]["included_in_training"] is True and exps["O1"]["exclusion_reason"] is None
    assert exps["O20"]["exclusion_reason"] == "provenance_mismatch"
    assert exps["O20"]["flow_restrictor"] == 1
    assert "date_year_mismatch" in exps["O20"]["quality_flags"]


def test_missing_values_stay_missing(report_and_rows: Any) -> None:
    _, exps, _ = report_and_rows
    assert exps["O3a"]["oxygen_percent_final"] is None  # source cell "none"
    assert exps["O3a"]["co_ppm_final"] is None and "over_range" in exps["O3a"]["quality_flags"]


def test_missing_chunks_are_reported(tmp_path: Path) -> None:
    root = build_fixture_repo(tmp_path / "repo")
    for p in (root / "data" / "curation").rglob("*.csv"):
        p.unlink()
    report = build(root, tmp_path / "out")
    assert report["chunks_found"] == {"tests": [], "steps": []}
    assert report["counts"]["observations"] == 0
    assert report["exclusions"]["experiments_by_reason"] == {"no_curation_record": 4}


def test_determinism_two_builds_same_version(tmp_path: Path) -> None:
    root = build_fixture_repo(tmp_path / "repo")
    v1 = build(root, tmp_path / "a")["dataset_version"]
    v2 = build(root, tmp_path / "b")["dataset_version"]
    assert v1 == v2 and len(v1) == 12
    for name in ("experiments.csv", "observations.json", "dataset_report.json"):
        assert (tmp_path / "a" / name).read_bytes() == (tmp_path / "b" / name).read_bytes()


@pytest.mark.skipif(not (REPO_ROOT / "data" / "curation" / "steps").is_dir(), reason="no repo data")
def test_real_repo_builds_twice_identically(tmp_path: Path) -> None:
    r1 = build(REPO_ROOT, tmp_path / "a")
    r2 = build(REPO_ROOT, tmp_path / "b")
    assert r1["dataset_version"] == r2["dataset_version"]
    assert r1["errors"] == []
    assert r1["provenance_failures"]["observations"] == []
