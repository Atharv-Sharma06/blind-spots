"""Write cell-level text dumps of the BASS / BASS-II spreadsheets.

The dumps are review aids for curation: every non-empty cell is printed with its
Excel row number, column letter, column header and exact text (Python repr), so a
curated row can cite the exact cell its interpretation came from. The pipeline
re-reads the original .xlsx files; it never reads these dumps.

Usage (from the repo root):
    python scripts/dump_source_cells.py
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

import openpyxl
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "curation" / "_source_dumps"

BASS2 = ROOT / "data/raw/psi/PSI-25/PSI-25_Science Documents_BASS-II_Test.Matrices.xlsx"
BASS1 = ROOT / "data/raw/psi/PSI-26/PSI-26_Science Documents_As Run_Test Matrix.xlsx"

# chunk name -> (file, sheet, header_row, first_data_row, last_data_row or None)
CHUNKS: dict[str, tuple[Path, str, int, int, int | None]] = {
    "bass2_bhattacharjee": (BASS2, "Bhattacharjee", 1, 2, None),
    "bass2_ferkul": (BASS2, "Ferkul", 1, 2, None),
    "bass2_miller": (BASS2, "Miller", 1, 2, None),
    "bass2_olson": (BASS2, "Olson", 1, 2, None),
    "bass2_fernandez_pello": (BASS2, "Fernandez-Pello", 1, 2, None),
    "bass2_tien": (BASS2, "T'ien", 1, 2, None),
    "bass1_2012a": (BASS1, "as run matrix", 3, 4, 46),
    "bass1_2012b": (BASS1, "as run matrix", 3, 47, 90),
    "bass1_2013": (BASS1, "as run matrix", 3, 91, 140),
}


def cell_text(value: object) -> str:
    if isinstance(value, dt.datetime):
        return value.date().isoformat() if value.time() == dt.time(0) else value.isoformat()
    return str(value)


def dump(name: str, path: Path, sheet: str, header_row: int, first: int, last: int | None) -> str:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[sheet]
    headers = {
        c: " ".join(cell_text(ws.cell(header_row, c).value or "").split())
        for c in range(1, ws.max_column + 1)
    }
    last = min(last or ws.max_row, ws.max_row)
    lines = [
        f"# SOURCE DUMP: {name}",
        f"# file: {path.relative_to(ROOT)}",
        f"# sheet: {sheet!r}   header row: {header_row}   data rows: {first}-{last}",
        "# Each cell: ROW <excel row> | <col letter> [<header>] = <python repr of exact cell text>",
        "",
    ]
    for r in range(first, last + 1):
        cells = []
        for c in range(1, ws.max_column + 1):
            v = ws.cell(r, c).value
            if v is None or (isinstance(v, str) and not v.strip()):
                continue
            cells.append(f"  {get_column_letter(c)} [{headers.get(c, '')}] = {cell_text(v)!r}")
        if cells:
            lines.append(f"ROW {r}")
            lines.extend(cells)
            lines.append("")
    return "\n".join(lines)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (path, sheet, header_row, first, last) in CHUNKS.items():
        text = dump(name, path, sheet, header_row, first, last)
        (OUT / f"{name}.txt").write_text(text, encoding="utf-8")
        print(f"wrote {name}.txt ({text.count(chr(10)+'ROW ')} rows)")


if __name__ == "__main__":
    main()
