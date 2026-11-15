from __future__ import annotations

import datetime as dt
from pathlib import Path

import pytest
from fixture_builders import build_bass_workbook

from blindspots.config import REPO_ROOT
from blindspots.ingestion.bass import (
    PSI26_MATRIX_FILE,
    parse_bass_date,
    read_bass,
)
from blindspots.processing.units import atm_to_kpa, mmhg_to_percent_vol


@pytest.fixture
def by_label(tmp_path: Path) -> dict[str, object]:
    path = build_bass_workbook(tmp_path / "fixture_bass.xlsx")
    return {t.test_label: t for t in read_bass(path)}


def test_only_integer_as_run_rows_are_tests(by_label: dict[str, object]) -> None:
    assert set(by_label) == {"1", "42", "85/117", "85/117a", "104"}


def test_units_and_formula(by_label: dict[str, object]) -> None:
    t = by_label["1"]
    assert t.o2_initial == pytest.approx(22.1)  # type: ignore[attr-defined]
    assert t.pressure_atm_raw == 0.97  # type: ignore[attr-defined]
    assert t.pressure_kpa == pytest.approx(atm_to_kpa(0.97))  # type: ignore[attr-defined]
    assert t.co2_mmhg_raw == 2.44  # type: ignore[attr-defined]
    assert t.co2_initial == pytest.approx(mmhg_to_percent_vol(2.44, 0.97))  # type: ignore[attr-defined]
    assert "co2_percent_from_mmhg_formula" in t.flags  # type: ignore[attr-defined]
    assert t.campaign_group == "BASS/2012"  # type: ignore[attr-defined]


def test_messy_date_and_continuation_rows(by_label: dict[str, object]) -> None:
    t = by_label["42"]
    assert t.test_date == dt.date(2012, 6, 29)  # type: ignore[attr-defined]
    assert "date_parsed_from_text" in t.flags  # type: ignore[attr-defined]
    assert t.notes_raw == (  # type: ignore[attr-defined]
        "long ignition, fully engulfed by the end\ncontinuation text directly below test 42"
    )
    assert "notes_include_continuation_rows" in t.flags  # type: ignore[attr-defined]
    # soot-cleaning row directly below the continuation must not be appended
    assert "soot" not in (t.notes_raw or "")  # type: ignore[attr-defined]


def test_duplicate_as_run_numbers_get_suffix(by_label: dict[str, object]) -> None:
    assert "duplicate_as_run_number" in by_label["85/117"].flags  # type: ignore[attr-defined]
    assert by_label["85/117a"].source_row == by_label["85/117"].source_row + 1  # type: ignore[attr-defined]


def test_implausible_year_is_not_guessed(by_label: dict[str, object]) -> None:
    t = by_label["104"]
    assert t.test_date is None  # type: ignore[attr-defined]
    assert "date_year_implausible" in t.flags  # type: ignore[attr-defined]
    assert t.campaign_group == "BASS/2013"  # type: ignore[attr-defined]
    assert "campaign_year_from_gmt_text" in t.flags  # type: ignore[attr-defined]
    assert t.co2_initial is None  # type: ignore[attr-defined]  # "?" stays missing


@pytest.mark.parametrize(
    ("raw", "date", "flag"),
    [
        ("8/9/12", dt.date(2012, 8, 9), "date_parsed_from_text"),
        ("6/29/`12", dt.date(2012, 6, 29), "date_parsed_from_text"),
        (dt.datetime(2013, 4, 4), dt.date(2013, 4, 4), None),
        ("garbage", None, "date_unparsed"),
    ],
)
def test_parse_bass_date(raw: object, date: dt.date | None, flag: str | None) -> None:
    got, flags = parse_bass_date(raw)
    assert got == date
    assert (flag in flags) if flag else flags == []


@pytest.mark.skipif(not (REPO_ROOT / PSI26_MATRIX_FILE).is_file(), reason="raw PSI-26 file not present")
def test_real_matrix_pins() -> None:
    tests = read_bass(REPO_ROOT / PSI26_MATRIX_FILE)
    labels = [t.test_label for t in tests]
    assert len(tests) == 121 and len(set(labels)) == 121
    assert {"24/12-R", "24/12-R2", "85/117", "85/117a", "89/26", "89/87"} <= set(labels)
    by = {t.test_label: t for t in tests}
    assert by["1"].o2_initial == pytest.approx(22.1)
    assert by["1"].source_row == 4
    assert by["42"].test_date == dt.date(2012, 6, 29)
