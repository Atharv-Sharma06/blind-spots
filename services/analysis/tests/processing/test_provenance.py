from __future__ import annotations

from pathlib import Path

import pytest
from fixture_builders import BASS2_REL, build_bass2_workbook

from blindspots.processing.provenance import SourceCells, check_step, check_test


@pytest.fixture
def cells(tmp_path: Path) -> SourceCells:
    path = tmp_path / BASS2_REL
    path.parent.mkdir(parents=True)
    build_bass2_workbook(path)
    return SourceCells(tmp_path)


def test_step_token_present(cells: SourceCells) -> None:
    # raw_token ".54 pot" is a substring of the Fan display cell ".54 pot, 0.45 pot" (row 3)
    assert check_step(cells, BASS2_REL, "Olson", 3, 3, "Fan display", ".54 pot") is None
    assert check_step(cells, BASS2_REL, "Olson", 2, None, "Air display", "20,10") is None


def test_step_token_absent_or_empty(cells: SourceCells) -> None:
    err = check_step(cells, BASS2_REL, "Olson", 3, 3, "Fan display", "0.9 pot")
    assert err is not None and "not found" in err
    assert check_step(cells, BASS2_REL, "Olson", 3, 3, "Fan display", "") is not None


def test_step_wrong_row_or_column(cells: SourceCells) -> None:
    assert check_step(cells, BASS2_REL, "Olson", 3, 2, "Fan display", ".54 pot") is not None
    assert "unknown raw_column" in (check_step(cells, BASS2_REL, "Olson", 2, 2, "No such column", "20") or "")


def test_step_missing_file(cells: SourceCells) -> None:
    assert "cannot open source" in (check_step(cells, "nope.xlsx", "Olson", 2, 2, "Air display", "20") or "")


def test_test_row_label(cells: SourceCells) -> None:
    assert check_test(cells, BASS2_REL, "Olson", 2, "O1") is None
    assert "holds" in (check_test(cells, BASS2_REL, "Olson", 3, "O1") or "")
