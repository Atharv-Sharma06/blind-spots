from __future__ import annotations

import datetime as dt
from pathlib import Path

import pytest
from fixture_builders import build_bass2_workbook

from blindspots.config import REPO_ROOT
from blindspots.ingestion.bass2 import PSI25_MATRIX_FILE, read_bass2


@pytest.fixture
def tests_by_label(tmp_path: Path) -> dict[str, object]:
    path = build_bass2_workbook(tmp_path / "fixture_bass2.xlsx")
    return {t.test_label: t for t in read_bass2(path)}


def test_row_values(tests_by_label: dict[str, object]) -> None:
    t = tests_by_label["O1"]
    assert t.campaign_group == "BASS-II/Olson"  # type: ignore[attr-defined]
    assert t.test_date == dt.date(2014, 2, 18)  # type: ignore[attr-defined]
    assert (t.gmt_day, t.sample_id, t.flow_restrictor) == (49, "207", 2)  # type: ignore[attr-defined]
    assert t.fan_raw == "89,62,50,41" and t.air_raw == "20,10,5,2,1"  # type: ignore[attr-defined]
    assert (t.o2_initial, t.o2_final, t.co2_initial, t.co_final) == (22.2, 21.7, 0.44, 51.0)  # type: ignore[attr-defined]
    assert t.source_row == 2 and t.flags == []  # type: ignore[attr-defined]


def test_none_blank_and_over_range(tests_by_label: dict[str, object]) -> None:
    t = tests_by_label["O3a"]
    assert t.o2_final is None and t.co2_final is None and t.co_final is None  # type: ignore[attr-defined]
    assert "over_range" in t.flags  # type: ignore[attr-defined]
    assert t.fan_raw is None  # type: ignore[attr-defined]
    assert "over_range" in tests_by_label["O20"].flags  # type: ignore[attr-defined]


def test_date_year_mismatch(tests_by_label: dict[str, object]) -> None:
    assert "date_year_mismatch" in tests_by_label["O20"].flags  # type: ignore[attr-defined]
    assert "date_year_mismatch" not in tests_by_label["O1"].flags  # type: ignore[attr-defined]


@pytest.mark.skipif(not (REPO_ROOT / PSI25_MATRIX_FILE).is_file(), reason="raw PSI-25 file not present")
def test_real_matrix_counts_and_cells() -> None:
    tests = read_bass2(REPO_ROOT / PSI25_MATRIX_FILE)
    assert len(tests) == 129
    by = {t.test_label: t for t in tests}
    assert by["B1"].campaign_group == "BASS-II/Bhattacharjee"
    assert by["B1"].fan_raw == "62" and by["B1"].o2_initial == 22.2
    assert by["O1"].flow_restrictor == 2
    groups = {t.campaign_group for t in tests}
    assert groups == {
        f"BASS-II/{p}" for p in ("Bhattacharjee", "Ferkul", "Miller", "Olson", "Fernandez-Pello", "T'ien")
    }
