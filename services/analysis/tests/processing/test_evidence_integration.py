"""TM Appendix A evidence rules and context records (fixture data only, never real NASA values)."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

import pytest
from fixture_builders import BASS2_REL, STEPS_HEADER, build_fixture_repo

from blindspots.ingestion.context import (
    CONTEXT_COLUMNS,
    geometry_for,
    load_context,
    material_family_for,
    outcome_for,
)
from blindspots.pipeline.build_dataset import build
from blindspots.processing.labels import load_curation
from blindspots.processing.provenance import TM_COLUMN, TmEvidence

EVIDENCE_HEADER = [
    "test_label", "pi_sheet", "configuration_label", "observation_text", "printed_page", "pdf_page",
    "table", "source_url", "extraction_note",
]  # fmt: skip
FIXTURE_OBS = "fixture_text: flame spread slowly then self extinguished"
EV = "nasa_tm_20210011385_appendix_a"
EXTRA = ["evidence_source", "evidence_page", "evidence_quote"]


def _write_evidence(root: Path) -> None:
    d = root / "data" / "curation" / "evidence"
    d.mkdir(parents=True, exist_ok=True)
    with (d / "bass2_tm_appendix_a.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(EVIDENCE_HEADER)
        w.writerow(["O1", "Olson", "Stagnation", FIXTURE_OBS, "118", "126", "Table A.5", "", ""])


def _write_tm_steps(root: Path) -> None:
    sdir = root / "data" / "curation" / "steps"
    with (sdir / "fixture_tm.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow([*STEPS_HEADER, *EXTRA])
        base = ["PSI-25", "O1", BASS2_REL, "Olson", 2]
        # good token (substring of the observation), then a token that is not in the text
        w.writerow([*base, 4, "", "none", "", "extinguished", "at_constant_flow", "self extinguished",
                    TM_COLUMN, 2, "medium", "", EV, "118 (pdf 126)", "self extinguished"])  # fmt: skip
        w.writerow([*base, 5, "", "none", "", "extinguished", "at_constant_flow", "not in the text",
                    TM_COLUMN, 2, "medium", "", EV, "118 (pdf 126)", "x"])  # fmt: skip


@pytest.fixture
def tm_repo(tmp_path: Path) -> Path:
    root = build_fixture_repo(tmp_path / "repo")
    _write_evidence(root)
    _write_tm_steps(root)
    return root


@pytest.fixture
def built(tm_repo: Path, tmp_path: Path) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    out = tmp_path / "out"
    report = build(tm_repo, out)
    exps = {e["test_label"]: e for e in json.loads((out / "experiments.json").read_text())}
    obs = {o["observation_id"]: o for o in json.loads((out / "observations.json").read_text())}
    return report, exps, obs


def test_optional_evidence_columns_load_without_problems(tm_repo: Path) -> None:
    data = load_curation(tm_repo / "data" / "curation")
    assert data.problems == []
    steps = {s.row["step_index"]: s.row for s in data.steps[("PSI-25", "O1")]}
    assert steps["4"]["evidence_source"] == "nasa_tm_20210011385_appendix_a"
    assert "evidence_source" not in steps["0"]  # chunk without the optional columns


def test_tm_evidence_check_rule(tm_repo: Path) -> None:
    tm = TmEvidence.load(tm_repo)
    assert tm.check_step("O1", "Olson", "self extinguished") is None
    assert "not found" in (tm.check_step("O1", "Olson", "nope") or "")
    assert tm.check_step("O1", "Olson", "") is not None
    assert "no TM Appendix A row" in (tm.check_step("O9", "Olson", "x") or "")
    assert TmEvidence.load(tm_repo / "missing").check_step("O1", "Olson", "x") is not None


def test_tm_rows_verified_flagged_and_mismatch(built: Any) -> None:
    _, _, obs = built
    good, bad = obs["PSI-25:O1#s4"], obs["PSI-25:O1#s5"]
    assert "provenance_mismatch" not in good["quality_flags"]
    assert "outcome_evidence_nasa_tm_20210011385" in good["quality_flags"]
    assert good["confidence"] == "medium"  # kept from the CSV
    assert good["raw_column"] == TM_COLUMN
    assert "provenance_mismatch" in bad["quality_flags"]
    assert bad["included_in_training"] is False and bad["exclusion_reason"] == "provenance_mismatch"
    assert "outcome_evidence_nasa_tm_20210011385" not in obs["PSI-25:O1#s0"]["quality_flags"]


def test_notes_and_method_from_tm(built: Any) -> None:
    report, exps, _ = built
    e = exps["O1"]
    assert e["notes_raw"] == FIXTURE_OBS
    assert "notes_from_nasa_tm_20210011385" in e["quality_flags"]
    assert "NASA/TM-20210011385 Appendix A" in e["measurement_method"] and "p.118" in e["measurement_method"]
    assert (
        exps["O2"]["notes_raw"] is None
        and "notes_from_nasa_tm_20210011385" not in exps["O2"]["quality_flags"]
    )
    ev = report["evidence"]
    assert ev["steps_with_tm_evidence"] == 2 and ev["experiments_with_tm_notes"] == 1


def test_configuration_changes_vs_previous_build(tm_repo: Path, tmp_path: Path) -> None:
    prev = tm_repo / "data" / "normalized"
    prev.mkdir(parents=True)
    old = [{"experiment_id": "PSI-25:O1", "flame_configuration": "concurrent"}]
    (prev / "experiments.json").write_text(json.dumps(old))
    report = build(tm_repo, tmp_path / "out")
    ch = report["evidence"]["configuration_changes_vs_previous_labels"]
    assert ch["n_changed"] == 1 and ch["by_transition"] == {"concurrent -> stagnation": 1}
    assert build(tm_repo, tmp_path / "o2")["evidence"]["n_context_records"] == 0


def _write_context(root: Path, rows: list[dict[str, str]], name: str = "fixture_src.csv") -> Path:
    d = root / "data" / "curation" / "context_microgravity"
    d.mkdir(parents=True, exist_ok=True)
    path = d / name
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=CONTEXT_COLUMNS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    return path


def _ctx_row(cid: str, **kw: str) -> dict[str, str]:
    row = dict.fromkeys(CONTEXT_COLUMNS, "")
    row.update(
        context_id=cid, investigation_short="FixtureCtx", investigation_name="Fixture context study",
        platform="fixture rig", gravity_environment="microgravity (fixture drop)", material="Black PMMA",
        specimen_geometry="slab", flame_configuration="opposed", oxygen_percent="35",
        total_pressure_kpa="101.325", total_pressure_raw="1 atmosphere", airflow_cm_s="5",
        airflow_raw="5 cm/s", outcome_text="Extinguished", source_title="Fixture source title",
        source_url="https://example.invalid/fixture", ntrs_id="00000001", page="1", table="Table 1",
        raw_text="1A | 35 | 5 | Extinguished",
    )  # fmt: skip
    row.update(kw)
    return row


def test_context_records_and_investigations(tm_repo: Path, tmp_path: Path) -> None:
    _write_context(
        tm_repo,
        [
            _ctx_row("FX:A1"),
            _ctx_row("FX:A2", outcome_text="Measured spread rate, cm/s: 0.02", total_pressure_kpa="",
                     total_pressure_raw="", material="Cotton Jersey", specimen_geometry="fabric (printed: x)",
                     flame_configuration="sideways"),
            _ctx_row("FX:A1"),  # duplicate id: skipped and reported
        ],
    )  # fmt: skip
    out = tmp_path / "out"
    report = build(tm_repo, out)
    exps = {e["experiment_id"]: e for e in json.loads((out / "experiments.json").read_text())}
    a1, a2 = exps["FixtureCtx:A1"], exps["FixtureCtx:A2"]
    assert a1["investigation_id"] == "NTRS-00000001" and a1["campaign_group"] == "FixtureCtx"
    assert a1["total_pressure_kpa"] == 101.325 and a1["pressure_assumed_kpa"] is None
    assert a1["airflow_cm_s"] == 5 and a1["observed_outcome"] == "extinguished"
    assert a1["material_family"] == "pmma_slab" and a1["specimen_geometry"] == "slab"
    assert a1["notes_raw"] == "Extinguished | 1A | 35 | 5 | Extinguished"
    assert a1["source_url"] == "https://example.invalid/fixture" and a1["source_doi"] is None
    assert a1["extraction_method"] == "manually_transcribed" and a1["n_observations"] == 0
    assert a1["included_in_training"] is False
    assert a1["exclusion_reason"] == "context only: different apparatus or test duration"
    assert a1["quality_flags"] == ["context_record"]
    # nothing assumed: missing pressure stays missing, unknown config/outcome/material stay unknown/other
    assert a2["total_pressure_kpa"] is None and a2["pressure_assumed_kpa"] is None
    assert "pressure_missing" in a2["quality_flags"]
    assert a2["observed_outcome"] == "unknown" and a2["flame_configuration"] == "unknown"
    assert a2["material_family"] == "other" and a2["specimen_geometry"] == "fabric_strip"
    invs = {i["investigation_id"]: i for i in json.loads((out / "investigations.json").read_text())}
    inv = invs["NTRS-00000001"]
    assert inv["role"] == "integrated_context" and inv["landing_url"] == "https://example.invalid/fixture"
    assert inv["license"] == "NASA Technical Reports Server document; see source" and inv["doi"] is None
    assert inv["n_experiments"] == 2 and inv["n_observations"] == 0
    assert inv["platform"] == "fixture rig" and inv["gravity_environment"] == "microgravity (fixture drop)"
    assert report["evidence"]["context_records_by_source"] == {"NTRS-00000001 (FixtureCtx)": 2}
    assert any("FX:A1" in p for p in report["context_problems"])
    assert report["errors"] == []


def test_context_header_problem_skips_file(tmp_path: Path) -> None:
    d = tmp_path / "ctx"
    d.mkdir()
    (d / "fixture_bad.csv").write_text("context_id,foo\nx:1,2\n", encoding="utf-8")
    recs, invs, problems = load_context(d)
    assert recs == [] and invs == [] and "header differs" in problems[0]


def test_context_mapping_helpers() -> None:
    assert outcome_for("Burns") == "burns" and outcome_for("No Ignition") == "ignition_failed"
    assert outcome_for("") == "unknown" and outcome_for("burned briefly") == "unknown"
    assert material_family_for("SIBAL Cloth", "fabric") == "sibal_fabric"
    assert material_family_for("Structured PMMA", "structured PMMA with grooves") == "other"
    assert geometry_for("film") == "flat_sheet" and geometry_for("structured PMMA") is None


def test_build_out_dir_via_argv(tm_repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from blindspots.pipeline import build_dataset as bd

    monkeypatch.setattr(bd, "REPO_ROOT", tm_repo)
    monkeypatch.setattr(bd, "build", lambda out_dir=None: build(tm_repo, out_dir))
    out = tmp_path / "argv_out"
    bd.main(["--out", str(out)])
    assert (out / "experiments.json").is_file()
    env_out = tmp_path / "env_out"
    monkeypatch.setenv("BLINDSPOTS_NORMALIZED_OUT", str(env_out))
    bd.main([])
    assert (env_out / "experiments.json").is_file()
