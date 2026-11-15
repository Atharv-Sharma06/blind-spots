from __future__ import annotations

from pathlib import Path

import pytest
from fixture_builders import write_curation

from blindspots.processing.labels import (
    label_step,
    load_curation,
    oxygen_for_step,
    training_exclusion,
)


@pytest.mark.parametrize(
    ("state", "mode", "label", "flags", "reason"),
    [
        ("sustained", "", 1, [], None),
        ("extinguished", "quench_low_flow", 0, [], None),
        ("extinguished", "blowoff_high_flow", 0, [], None),
        ("extinguished", "at_constant_flow", 0, [], None),
        ("extinguished", "flow_turned_off", 0, ["flow_off_transient"], None),
        ("brief_flame_no_sustain", "", 0, ["no_sustained_propagation"], None),
        ("not_ignited", "", None, [], "not_ignited"),
        ("extinguished", "n2_suppression", None, [], "n2_suppression"),
        ("extinguished", "", None, [], "extinction_mode_missing"),
    ],
)
def test_label_rule(state: str, mode: str, label: int | None, flags: list[str], reason: str | None) -> None:
    assert label_step(state, mode) == (label, flags, reason)


def test_oxygen_interpolation() -> None:
    assert oxygen_for_step(22.0, 20.0, 0, 3, False) == (22.0, ["o2_interpolated"])
    o2, flags = oxygen_for_step(22.0, 20.0, 1, 3, False)
    assert o2 == pytest.approx(21.0) and flags == ["o2_interpolated"]
    assert oxygen_for_step(22.0, 20.0, 2, 3, False)[0] == pytest.approx(20.0)


def test_oxygen_falls_back_to_initial() -> None:
    assert oxygen_for_step(22.0, None, 1, 3, False) == (22.0, ["o2_initial_only"])
    assert oxygen_for_step(22.0, 0.6, 1, 3, True) == (22.0, ["o2_initial_only"])  # anomaly
    assert oxygen_for_step(22.0, 20.0, 0, 1, False) == (22.0, ["o2_initial_only"])  # single step
    assert oxygen_for_step(None, 20.0, 0, 2, False) == (None, ["o2_missing"])


_OK = dict(
    label=1,
    label_reason=None,
    airflow=5.0,
    provenance_ok=True,
    confidence="high",
    material_family="pmma_rod",
    oxygen=21.0,
)


def test_training_filter_includes_valid_row() -> None:
    assert training_exclusion(**_OK) is None  # type: ignore[arg-type]
    assert training_exclusion(**{**_OK, "confidence": "medium"}) is None  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("change", "reason"),
    [
        ({"label": None, "label_reason": "not_ignited"}, "not_ignited"),
        ({"airflow": None}, "no_numeric_airflow"),
        ({"provenance_ok": False}, "provenance_mismatch"),
        ({"confidence": "low"}, "low_confidence"),
        ({"material_family": None}, "no_material_family"),
        ({"oxygen": None}, "no_oxygen"),
    ],
)
def test_training_filter_reasons(change: dict[str, object], reason: str) -> None:
    assert training_exclusion(**{**_OK, **change}) == reason  # type: ignore[arg-type]


def test_load_curation_reads_chunks_and_reports_problems(tmp_path: Path) -> None:
    write_curation(tmp_path)
    data = load_curation(tmp_path / "data" / "curation")
    assert data.test_chunks == ["fixture_chunk"] and data.step_chunks == ["fixture_chunk"]
    assert ("PSI-25", "O1") in data.tests
    assert [s.row["step_index"] for s in data.steps[("PSI-25", "O1")]] == ["0", "1", "2", "3"]
    assert data.problems == []
    # a duplicate test row is reported and the first kept
    tests = tmp_path / "data" / "curation" / "tests" / "fixture_chunk.csv"
    lines = tests.read_text(encoding="utf-8").splitlines()
    tests.write_text("\n".join([*lines, lines[1]]) + "\n", encoding="utf-8")
    data = load_curation(tmp_path / "data" / "curation")
    assert any("duplicate test row" in p for p in data.problems)


def test_load_curation_with_no_chunks(tmp_path: Path) -> None:
    data = load_curation(tmp_path)
    assert data.tests == {} and data.test_chunks == [] and data.step_chunks == []
