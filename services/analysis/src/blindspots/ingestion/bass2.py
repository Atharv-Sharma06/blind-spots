"""BASS-II (PSI-25) test matrix: one sheet per principal investigator, header in row 1."""

from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import openpyxl

from blindspots.processing.units import cell_text, norm_text, parse_number

PSI25_MATRIX_FILE = "data/raw/psi/PSI-25/PSI-25_Science Documents_BASS-II_Test.Matrices.xlsx"

# sheet name -> campaign group suffix (PI names, CONTRACTS section 3 "BASS-II/<PI>")
PI_SHEETS: dict[str, str] = {
    "Bhattacharjee": "Bhattacharjee",
    "Ferkul": "Ferkul",
    "Miller": "Miller",
    "Olson": "Olson",
    "Fernandez-Pello": "Fernandez-Pello",
    "T'ien": "T'ien",
}
HEADER_ROW = 1
_YEAR_RE = re.compile(r"GMT\s+(\d{4})")
_INT_RE = re.compile(r"\d+")


@dataclass
class RawTest:
    """One test row of a source matrix with raw cell text kept alongside parsed values."""

    investigation_id: str
    campaign_group: str
    source_file: str
    source_sheet: str
    source_row: int
    test_label: str
    test_date: dt.date | None = None
    test_date_raw: str | None = None
    gmt_day: int | None = None
    gmt_raw: str | None = None
    sample_id: str | None = None
    material_raw: str | None = None
    flow_restrictor: int | None = None
    flow_restrictor_raw: str | None = None
    fan_raw: str | None = None
    air_raw: str | None = None
    o2_initial: float | None = None
    o2_final: float | None = None
    o2_initial_raw: str | None = None
    o2_final_raw: str | None = None
    co2_initial: float | None = None
    co2_final: float | None = None
    co2_unit: str = "percent_vol"
    co_initial: float | None = None
    co_final: float | None = None
    pressure_atm_raw: float | None = None
    pressure_kpa: float | None = None
    co2_mmhg_raw: float | None = None
    notes_raw: str | None = None
    flags: list[str] = field(default_factory=list)


def _opt_text(value: Any) -> str | None:
    text = cell_text(value).strip()
    return text or None


def _header_map(ws: Any, header_row: int) -> dict[str, int]:
    out: dict[str, int] = {}
    for c in range(1, ws.max_column + 1):
        h = norm_text(ws.cell(header_row, c).value)
        if h and h not in out:
            out[h] = c
    return out


def find_column(hmap: dict[str, int], *prefixes: str) -> int | None:
    """Column index whose normalised header starts with any prefix (case-insensitive)."""
    for prefix in prefixes:
        p = prefix.lower()
        for header, col in hmap.items():
            if header.lower().startswith(p):
                return col
    return None


def _number_field(value: Any, name: str, flags: list[str]) -> float | None:
    number, status = parse_number(value)
    if status == "over_range":
        flags.append(f"{name}_over_range")
        flags.append("over_range")
    elif status == "unparsed":
        flags.append(f"{name}_unparsed")
    return number


def _first_int(text: str | None) -> int | None:
    if not text:
        return None
    m = _INT_RE.search(text)
    return int(m.group()) if m else None


def parse_pi_sheet(
    ws: Any, pi: str, source_file: str = PSI25_MATRIX_FILE, sheet_name: str | None = None
) -> list[RawTest]:
    """Parse one PI sheet (header row 1) into test-level rows."""
    hmap = _header_map(ws, HEADER_ROW)
    c_date = find_column(hmap, "Actual Date")
    c_gmt = find_column(hmap, "GMT")
    c_test = find_column(hmap, "Test no")
    c_sample = find_column(hmap, "Sample no")
    c_mat = find_column(hmap, "Material")
    c_res = find_column(hmap, "Flow restrictor")
    c_fan = find_column(hmap, "Fan display")
    c_air = find_column(hmap, "Air display")
    c_o2i = find_column(hmap, "calibrated initial O2")
    c_o2f = find_column(hmap, "calibrated final O2")
    c_co2i = find_column(hmap, "Initial CO2")
    c_co2f = find_column(hmap, "Final CO2")
    c_coi = find_column(hmap, "Initial CO (ppm)")
    c_cof = find_column(hmap, "Final CO (ppm)")
    if c_test is None or c_date is None:
        raise ValueError(f"sheet {ws.title!r}: cannot find the date and test-number columns")
    header_year: int | None = None
    if c_gmt is not None:
        m = _YEAR_RE.search(norm_text(ws.cell(HEADER_ROW, c_gmt).value))
        header_year = int(m.group(1)) if m else None

    def val(row: int, col: int | None) -> Any:
        return ws.cell(row, col).value if col is not None else None

    tests: list[RawTest] = []
    for row in range(HEADER_ROW + 1, ws.max_row + 1):
        label = cell_text(val(row, c_test)).strip()
        if not label:
            continue
        flags: list[str] = []
        t = RawTest(
            investigation_id="PSI-25",
            campaign_group=f"BASS-II/{pi}",
            source_file=source_file,
            source_sheet=sheet_name or ws.title,
            source_row=row,
            test_label=label,
        )
        raw_date = val(row, c_date)
        t.test_date_raw = _opt_text(raw_date)
        if isinstance(raw_date, dt.datetime):
            t.test_date = raw_date.date()
        elif isinstance(raw_date, dt.date):
            t.test_date = raw_date
        elif raw_date is not None:
            flags.append("date_unparsed")
        t.gmt_raw = _opt_text(val(row, c_gmt))
        t.gmt_day = _first_int(t.gmt_raw)
        if t.gmt_raw is not None and t.gmt_day is None:
            flags.append("gmt_day_unparsed")
        if t.test_date and header_year and t.test_date.year != header_year:
            flags.append("date_year_mismatch")
        t.sample_id = _opt_text(val(row, c_sample))
        t.material_raw = _opt_text(val(row, c_mat))
        t.flow_restrictor_raw = _opt_text(val(row, c_res))
        res, status = parse_number(val(row, c_res))
        if res is not None and float(res).is_integer():
            t.flow_restrictor = int(res)
        elif status != "missing":
            flags.append("flow_restrictor_unparsed")
        t.fan_raw = _opt_text(val(row, c_fan))
        t.air_raw = _opt_text(val(row, c_air))
        t.o2_initial_raw = _opt_text(val(row, c_o2i))
        t.o2_final_raw = _opt_text(val(row, c_o2f))
        t.o2_initial = _number_field(val(row, c_o2i), "o2_initial", flags)
        t.o2_final = _number_field(val(row, c_o2f), "o2_final", flags)
        t.co2_initial = _number_field(val(row, c_co2i), "co2_initial", flags)
        t.co2_final = _number_field(val(row, c_co2f), "co2_final", flags)
        t.co_initial = _number_field(val(row, c_coi), "co_initial", flags)
        t.co_final = _number_field(val(row, c_cof), "co_final", flags)
        t.flags = list(dict.fromkeys(flags))
        tests.append(t)
    return tests


def read_bass2(path: Path, source_file: str = PSI25_MATRIX_FILE) -> list[RawTest]:
    """Read the six PI sheets of the BASS-II matrix workbook (sheets missing from the file are skipped)."""
    wb = openpyxl.load_workbook(path, data_only=True, read_only=False)
    tests: list[RawTest] = []
    for sheet, pi in PI_SHEETS.items():
        if sheet in wb.sheetnames:
            tests.extend(parse_pi_sheet(wb[sheet], pi, source_file, sheet))
    return tests
