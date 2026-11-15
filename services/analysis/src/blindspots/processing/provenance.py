"""Provenance verification of curation rows against the original spreadsheets.

Same rule as ``scripts/check_curation_provenance.py``: a step's ``raw_token`` must be an exact substring
of the cell at (``token_row``, column whose normalised header equals ``raw_column``); a test's
``source_row`` must hold the cited ``test_label`` in its test-number column.
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

import openpyxl

from blindspots.processing.units import cell_text, norm_text

HEADER_ROW_BY_SHEET = {"as run matrix": 3}
FLAG = "provenance_mismatch"
TM_COLUMN = "TM Appendix A observation"
TM_EVIDENCE_REL = "data/curation/evidence/bass2_tm_appendix_a.csv"


class SourceCells:
    """Lazy cache of data_only workbooks opened from repo-relative paths."""

    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root
        self._wb: dict[str, Any] = {}
        self._hmap: dict[tuple[str, str], dict[str, int]] = {}

    def sheet(self, path: str, name: str) -> Any:
        if path not in self._wb:
            self._wb[path] = openpyxl.load_workbook(self.repo_root / path, data_only=True)
        wb = self._wb[path]
        if name not in wb.sheetnames:
            raise KeyError(f"sheet {name!r} not found in {path}")
        return wb[name]

    def headers(self, path: str, name: str) -> dict[str, int]:
        key = (path, name)
        if key not in self._hmap:
            ws = self.sheet(path, name)
            hr = HEADER_ROW_BY_SHEET.get(name, 1)
            out: dict[str, int] = {}
            for c in range(1, ws.max_column + 1):
                h = norm_text(ws.cell(hr, c).value)
                if h and h not in out:
                    out[h] = c
            self._hmap[key] = out
        return self._hmap[key]

    def text(self, path: str, name: str, row: int, column_header: str) -> str | None:
        """Cell text at ``row`` under ``column_header``; None when the header is unknown."""
        col = self.headers(path, name).get(norm_text(column_header))
        if col is None:
            return None
        return cell_text(self.sheet(path, name).cell(row, col).value)


def check_step(
    cells: SourceCells,
    source_file: str,
    source_sheet: str,
    source_row: int,
    token_row: int | None,
    raw_column: str,
    raw_token: str,
) -> str | None:
    """Return an error message when the step's token is not found, else None."""
    row = token_row if token_row is not None else source_row
    try:
        text = cells.text(source_file, source_sheet, row, raw_column)
    except (OSError, KeyError) as exc:
        return f"cannot open source: {exc}"
    if text is None:
        return f"unknown raw_column {raw_column!r}"
    if raw_token == "" or raw_token not in text:
        return f"raw_token {raw_token!r} not found in row {row} [{raw_column}] = {text!r}"
    return None


def check_test(
    cells: SourceCells, source_file: str, source_sheet: str, source_row: int, test_label: str
) -> str | None:
    """Return an error message when the cited row does not hold the test label, else None."""
    header = "As run test no." if source_sheet == "as run matrix" else "Test no."
    try:
        text = cells.text(source_file, source_sheet, source_row, header)
    except (OSError, KeyError) as exc:
        return f"cannot open source: {exc}"
    if text is None:
        return f"cannot find test-number column {header!r}"
    if norm_text(text) != test_label.split("/")[0]:
        return f"test_label {test_label!r} but row {source_row} holds {norm_text(text)!r}"
    return None


class TmEvidence:
    """NASA/TM-20210011385 Appendix A rows (``bass2_tm_appendix_a.csv``), keyed by test label."""

    def __init__(self, rows: list[dict[str, str]] | None = None) -> None:
        self.rows: list[dict[str, str]] = rows or []
        self.by_label: dict[str, list[dict[str, str]]] = {}
        for r in self.rows:
            self.by_label.setdefault(r["test_label"], []).append(r)

    @classmethod
    def load(cls, repo_root: Path) -> TmEvidence:
        path = repo_root / TM_EVIDENCE_REL
        if not path.is_file():
            return cls()
        with path.open(newline="", encoding="utf-8") as fh:
            return cls(list(csv.DictReader(fh)))

    def row_for(self, test_label: str, sheet: str | None) -> dict[str, str] | None:
        """The Appendix A row of a test: same sheet if one matches, else the only row with that label."""
        cands = self.by_label.get(test_label, [])
        same = [r for r in cands if r["pi_sheet"] == sheet]
        if same:
            return same[0]
        return cands[0] if len(cands) == 1 and sheet is None else None

    def check_step(self, test_label: str, sheet: str | None, raw_token: str) -> str | None:
        """Same rule as scripts/check_curation_provenance.py: the token must be a substring of the
        test's Appendix A observation text (sheet preferred, any sheet otherwise)."""
        cands = self.by_label.get(test_label, [])
        texts = [r["observation_text"] for r in cands if r["pi_sheet"] == sheet] or [
            r["observation_text"] for r in cands
        ]
        if not texts:
            return f"{test_label}: no TM Appendix A row in {TM_EVIDENCE_REL}"
        if raw_token == "" or not any(raw_token in t for t in texts):
            return (
                f"{test_label}: raw_token {raw_token!r} not found in TM Appendix A observation {texts[0]!r}"
            )
        return None


def is_tm_column(raw_column: str) -> bool:
    return norm_text(raw_column) == TM_COLUMN
