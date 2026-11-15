"""BASS (PSI-26) as-run test matrix: sheet "as run matrix", header in row 3."""

from __future__ import annotations

import datetime as dt
import re
from collections import Counter
from pathlib import Path
from typing import Any

import openpyxl

from blindspots.ingestion.bass2 import RawTest, _header_map, _opt_text, find_column
from blindspots.processing.units import (
    atm_to_kpa,
    cell_text,
    fraction_to_percent,
    mmhg_to_percent_vol,
    parse_number,
)

PSI26_MATRIX_FILE = "data/raw/psi/PSI-26/PSI-26_Science Documents_As Run_Test Matrix.xlsx"
SHEET = "as run matrix"
HEADER_ROW = 3
PLAUSIBLE_YEARS = (2012, 2013)

_SLASH_DATE_RE = re.compile(r"^\s*(\d{1,2})/(\d{1,2})/\D*(\d{2,4})\s*$")
_GMT_YEAR_RES = (re.compile(r"GMT\s*-?\s*(\d{2})(?!\d)"), re.compile(r"^\s*(\d{2})-\s*\d{2,3}"))


def parse_bass_date(raw: Any) -> tuple[dt.date | None, list[str]]:
    """Parse a BASS date cell (datetime, or messy text such as ``8/9/12`` / ``6/29/`12``)."""
    flags: list[str] = []
    date: dt.date | None = None
    if isinstance(raw, dt.datetime):
        date = raw.date()
    elif isinstance(raw, dt.date):
        date = raw
    elif raw is not None and str(raw).strip():
        m = _SLASH_DATE_RE.match(str(raw))
        if m:
            month, day, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if year < 100:
                year += 2000
            try:
                date = dt.date(year, month, day)
                flags.append("date_parsed_from_text")
            except ValueError:
                flags.append("date_unparsed")
        else:
            flags.append("date_unparsed")
    if date is not None and date.year not in PLAUSIBLE_YEARS:
        flags.append("date_year_implausible")
        date = None
    return date, flags


def _as_run_label(value: Any) -> str | None:
    """The as-run test number as text when the cell holds an integer, else None."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    text = str(value).strip()
    return text if text.isdigit() else None


def _year_from_gmt_text(text: str | None) -> int | None:
    if not text:
        return None
    for rx in _GMT_YEAR_RES:
        m = rx.search(text)
        if m and int(m.group(1)) in (12, 13):
            return 2000 + int(m.group(1))
    return None


def parse_as_run_sheet(
    ws: Any, source_file: str = PSI26_MATRIX_FILE, sheet_name: str = SHEET, header_row: int = HEADER_ROW
) -> list[RawTest]:
    """Parse the as-run matrix into test-level rows (see CONTRACTS section 2 for labels)."""
    hmap = _header_map(ws, header_row)
    c_date = find_column(hmap, "Actual Date")
    c_time = find_column(hmap, "Approx Start Time")
    c_asrun = find_column(hmap, "As run test no")
    c_test = find_column(hmap, "Test no")
    c_sample = find_column(hmap, "Sample no")
    c_mat = find_column(hmap, "material")
    c_res = find_column(hmap, "Flow restrictor")
    c_fan = find_column(hmap, "Fan display")
    c_air = find_column(hmap, "Air display")
    c_o2 = find_column(hmap, "O2 % by volume")
    c_p = find_column(hmap, "pressure, atm")
    c_co2 = find_column(hmap, "CO2, mm Hg")
    c_obs = find_column(hmap, "Test Observations")
    if c_asrun is None or c_obs is None:
        raise ValueError(f"sheet {ws.title!r}: cannot find the as-run test number / observation columns")

    def val(row: int, col: int | None) -> Any:
        return ws.cell(row, col).value if col is not None else None

    tests: list[RawTest] = []
    last_row_was_test = False
    for row in range(header_row + 1, ws.max_row + 1):
        label = _as_run_label(val(row, c_asrun))
        obs = val(row, c_obs)
        if label is None:
            # continuation: only the observation cell is filled, directly below a test row
            others = [
                c for c in range(1, ws.max_column + 1) if c != c_obs and ws.cell(row, c).value is not None
            ]
            is_cont = (
                last_row_was_test and tests and not others and obs is not None and cell_text(obs).strip()
            )
            if is_cont:
                tests[-1].notes_raw = (tests[-1].notes_raw or "") + "\n" + cell_text(obs)
                if "notes_include_continuation_rows" not in tests[-1].flags:
                    tests[-1].flags.append("notes_include_continuation_rows")
            else:
                last_row_was_test = False
            continue
        last_row_was_test = True
        flags: list[str] = []
        t = RawTest(
            investigation_id="PSI-26",
            campaign_group="BASS/unknown",
            source_file=source_file,
            source_sheet=sheet_name,
            source_row=row,
            test_label=label,
        )
        raw_date = val(row, c_date)
        t.test_date_raw = _opt_text(raw_date)
        t.test_date, date_flags = parse_bass_date(raw_date)
        flags.extend(date_flags)
        t.gmt_raw = _opt_text(val(row, c_time))
        year = t.test_date.year if t.test_date else None
        if year is None:
            year = _year_from_gmt_text(t.gmt_raw)
            if year is not None:
                flags.append("campaign_year_from_gmt_text")
        if year is not None:
            t.campaign_group = f"BASS/{year}"
        t.sample_id = _opt_text(val(row, c_sample))
        t.material_raw = _opt_text(val(row, c_mat))
        t.flow_restrictor_raw = _opt_text(val(row, c_res))
        res, status = parse_number(val(row, c_res))
        if res is not None and float(res).is_integer():
            t.flow_restrictor = int(res)
        elif status not in ("missing",):
            flags.append("flow_restrictor_unparsed")
        t.fan_raw = _opt_text(val(row, c_fan))
        t.air_raw = _opt_text(val(row, c_air))
        # O2: fraction -> percent
        o2, o2_status = parse_number(val(row, c_o2))
        t.o2_initial_raw = _opt_text(val(row, c_o2))
        if o2 is not None:
            if not 0.0 < o2 <= 1.0:
                flags.append("o2_fraction_out_of_range")
            t.o2_initial = fraction_to_percent(o2)
        elif o2_status == "unparsed":
            flags.append("o2_unparsed")
        # pressure: atm (kept raw) -> kPa
        p, p_status = parse_number(val(row, c_p))
        if p is not None:
            t.pressure_atm_raw = p
            t.pressure_kpa = atm_to_kpa(p)
        elif p_status == "unparsed":
            flags.append("pressure_unparsed")
        # CO2: mm Hg raw -> % vol via the measured total pressure
        co2, co2_status = parse_number(val(row, c_co2))
        if co2 is not None:
            t.co2_mmhg_raw = co2
            if p is not None and p > 0:
                t.co2_initial = mmhg_to_percent_vol(co2, p)
                flags.append("co2_percent_from_mmhg_formula")
            else:
                flags.append("co2_percent_not_computable")
        elif co2_status == "unparsed":
            flags.append("co2_unparsed")
        t.co2_unit = "percent_vol"
        obs_text = cell_text(obs) if obs is not None else ""
        t.notes_raw = obs_text if obs_text.strip() else None
        t.flags = flags
        tests.append(t)

    # duplicate as-run numbers get "<as run>/<Test no.>" labels
    counts = Counter(t.test_label for t in tests)
    for t in tests:
        if counts[t.test_label] > 1:
            test_no = cell_text(ws.cell(t.source_row, c_test).value).strip() if c_test else ""
            if test_no:
                t.test_label = f"{t.test_label}/{test_no}"
            t.flags.append("duplicate_as_run_number")
    return tests


def read_bass(path: Path, source_file: str = PSI26_MATRIX_FILE) -> list[RawTest]:
    wb = openpyxl.load_workbook(path, data_only=True)
    if SHEET not in wb.sheetnames:
        raise ValueError(f"{path}: sheet {SHEET!r} not found")
    return parse_as_run_sheet(wb[SHEET], source_file, SHEET, HEADER_ROW)
