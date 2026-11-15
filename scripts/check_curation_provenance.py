"""Verify curation CSVs against the original spreadsheets.

For every row of a steps CSV, checks that `raw_token` is an exact substring of the cell at
(`token_row`, column whose normalized header == `raw_column`) in `source_file`/`source_sheet`.
A steps row whose `raw_column` is exactly "TM Appendix A observation" is instead checked against
`data/curation/evidence/bass2_tm_appendix_a.csv`: `raw_token` must be a substring of that test's
`observation_text` (matched on `test_label`, and on `source_sheet` when it names a PSI-25 sheet).
For tests CSVs, checks that `source_row` holds the cited `test_label` in its test-number column.

Usage (repo root):
    python scripts/check_curation_provenance.py data/curation/steps/<chunk>.csv [...]
    python scripts/check_curation_provenance.py data/curation/tests/<chunk>.csv [...]
Exit code 1 if any row fails. Requires openpyxl.
"""

from __future__ import annotations

import csv
import datetime as dt
import sys
from functools import lru_cache
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
HEADER_ROW = {"as run matrix": 3}  # every BASS-II sheet uses row 1
TM_COLUMN = "TM Appendix A observation"
TM_EVIDENCE = "data/curation/evidence/bass2_tm_appendix_a.csv"


def norm(text: object) -> str:
    return " ".join(str(text or "").split())


def cell_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, dt.datetime):
        return value.date().isoformat() if value.time() == dt.time(0) else value.isoformat()
    return str(value)


@lru_cache(maxsize=None)
def sheet(path: str, name: str):
    wb = openpyxl.load_workbook(ROOT / path, data_only=True)
    return wb[name]


@lru_cache(maxsize=None)
def header_map(path: str, name: str) -> dict[str, int]:
    ws = sheet(path, name)
    hr = HEADER_ROW.get(name, 1)
    return {norm(ws.cell(hr, c).value): c for c in range(1, ws.max_column + 1) if norm(ws.cell(hr, c).value)}


@lru_cache(maxsize=None)
def tm_observations() -> dict[str, list[tuple[str, str]]]:
    """test_label -> [(pi_sheet, observation_text)] from the TM Appendix A evidence CSV."""
    out: dict[str, list[tuple[str, str]]] = {}
    with open(ROOT / TM_EVIDENCE, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            out.setdefault(row["test_label"], []).append((row["pi_sheet"], row["observation_text"]))
    return out


def check_tm_row(i: int, r: dict[str, str]) -> str | None:
    token = r["raw_token"]
    try:
        cands = tm_observations().get(r["test_label"], [])
    except FileNotFoundError:
        return f"line {i}: {TM_EVIDENCE} not found"
    same_sheet = [t for sh, t in cands if sh == r["source_sheet"]]
    texts = same_sheet or [t for _, t in cands]
    if not texts:
        return f"line {i}: {r['test_label']}: no TM Appendix A row in {TM_EVIDENCE}"
    if token == "" or not any(token in t for t in texts):
        return f"line {i}: {r['test_label']}: raw_token {token!r} not found in TM Appendix A observation {texts[0]!r}"
    return None


def check_steps(rows: list[dict[str, str]]) -> list[str]:
    errors = []
    for i, r in enumerate(rows, start=2):
        if norm(r["raw_column"]) == TM_COLUMN:
            err = check_tm_row(i, r)
            if err:
                errors.append(err)
            continue
        path, name = r["source_file"], r["source_sheet"]
        hmap = header_map(path, name)
        col = hmap.get(norm(r["raw_column"]))
        if col is None:
            errors.append(f"line {i}: unknown raw_column {r['raw_column']!r} (sheet {name!r})")
            continue
        token_row = int(r.get("token_row") or r["source_row"])
        text = cell_text(sheet(path, name).cell(token_row, col).value)
        if r["raw_token"] == "" or r["raw_token"] not in text:
            errors.append(
                f"line {i}: {r['test_label']} step {r['step_index']}: raw_token {r['raw_token']!r} "
                f"not found in row {token_row} [{r['raw_column']}] = {text!r}"
            )
    return errors


def check_tests(rows: list[dict[str, str]]) -> list[str]:
    errors = []
    for i, r in enumerate(rows, start=2):
        path, name = r["source_file"], r["source_sheet"]
        hmap = header_map(path, name)
        label_col = hmap.get("As run test no.") if name == "as run matrix" else hmap.get("Test no.")
        if label_col is None:
            errors.append(f"line {i}: cannot find test-number column in {name!r}")
            continue
        cell = norm(cell_text(sheet(path, name).cell(int(r["source_row"]), label_col).value))
        first = r["test_label"].split("/")[0]
        if cell != first:
            errors.append(f"line {i}: test_label {r['test_label']!r} but row {r['source_row']} holds {cell!r}")
    return errors


def main(paths: list[str]) -> int:
    failed = 0
    for p in paths:
        with open(p, newline="", encoding="utf-8") as fh:
            rows = list(csv.DictReader(fh))
        kind = "steps" if rows and "raw_token" in rows[0] else "tests"
        errors = check_steps(rows) if kind == "steps" else check_tests(rows)
        print(f"{p}: {len(rows)} {kind} rows, {len(errors)} provenance errors")
        for e in errors:
            print("  " + e)
        failed += bool(errors)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
