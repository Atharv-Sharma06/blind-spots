# ruff: noqa: E501, RUF028
"""Builders for tiny fixture workbooks and repos (tests only).

Cell values copy real cells of the NASA PSI files where noted ("real cell"); everything else is
clearly a fixture value. Nothing here is imported by application code.
"""

from __future__ import annotations

import csv
import datetime as dt
from pathlib import Path
from typing import Any

import openpyxl

BASS2_HEADERS = [
    "Actual Date  (for Video Display Date, add 1 for Leap Year)",
    "GMT 2014- (except last 3 tests from 2016)",
    "Test no.",
    "Sample no.",
    "Material",
    "Flow restrictor",
    "Fan display",
    "Air display",
    "Radiometer gain   (1000, 250, 50, 10)",
    "total frames shot",
    "calibrated  initial O2 % by vol ",
    "calibrated final O2 % by vol",
    "Initial CO2 % by vol",
    "Final CO2 % by vol",
    "Initial CO (ppm)",
    "Final CO (ppm)",
]
BASS_HEADERS = [
    "Actual Date  (for SPICE Display Date, add 1 for Leap Year)",
    "Approx Start Time ( with GMT)",
    "As run test no.",
    "Test no.",
    "Sample no.",
    "material",
    "Igniter",
    "Flow restrictor",
    "Sample distance",
    "Fan display",
    "Air display",
    "Radiometer gain ( 1000, 250, 50, 10)",
    "Radiometer display",
    "GN2 Pot",
    "GN2 display",
    "Filter y/n",
    "Release Mode (CH/CL)",
    "Exposure Mode (M/A)",
    "Exposure compensation   (-#EV)",
    "Bracket frames and exposure bracket (#F/ 1.0)",
    "shutter speed (1/s)",
    "F stop",
    "ISO",
    "shutter hold s /cont",
    "SD card S/N",
    "total frames shot",
    "O2 % by volume",
    "pressure, atm",
    "CO2, mm Hg",
    "Test Observations and Anomalies (ignited, spread, extinguished, burn time, color, etc.) ",
]
D = dt.datetime
BASS2_ROWS_OLSON: list[list[Any]] = [
    # real cells: PSI-25 Olson rows 2 and 3
    [
        D(2014, 2, 18),
        49,
        "O1",
        207,
        '1/4" clear rod',
        2,
        "89,62,50,41",
        "20,10,5,2,1",
        50,
        62,
        22.2,
        21.7,
        0.44,
        0.85,
        -1,
        51,
    ],
    [
        D(2014, 2, 18),
        49,
        "O2",
        204,
        '1/4" clear rod',
        2,
        ".54 pot, 0.45 pot",
        0,
        50,
        287,
        22.2,
        21.9,
        0.44,
        0.59,
        -1,
        23,
    ],
    # fixture rows: over-range CO, "none" O2 final, a 2016 date under the 2014 header
    [
        D(2014, 6, 13),
        164,
        "O3a",
        "205M",
        '1/4" clear rod',
        2,
        None,
        "5,3",
        1000,
        85,
        18,
        "none",
        0.25,
        None,
        16,
        "OR",
    ],
    [
        D(2016, 3, 1),
        70,
        "O20",
        "300",
        '1/4" clear rod',
        1,
        "70",
        "9",
        50,
        10,
        16.5,
        15.9,
        0.3,
        0.4,
        1,
        "over",
    ],
]


def _blank_row(n: int) -> list[Any]:
    return [None] * n


def build_bass2_workbook(path: Path) -> Path:
    wb = openpyxl.Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "Olson"
    ws.append(BASS2_HEADERS)
    for row in BASS2_ROWS_OLSON:
        ws.append(row)
    wb.save(path)
    return path


def _bass_row(**kw: Any) -> list[Any]:
    row = _blank_row(len(BASS_HEADERS))
    idx = {
        "date": 0, "time": 1, "asrun": 2, "test": 3, "sample": 4, "material": 5, "restrictor": 7,
        "fan": 9, "air": 10, "o2": 26, "p": 27, "co2": 28, "obs": 29,
    }  # fmt: skip
    for k, v in kw.items():
        row[idx[k]] = v
    return row


def build_bass_workbook(path: Path) -> Path:
    wb = openpyxl.Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "as run matrix"
    ws.append(["BASS   Test  Matrix as Run"])
    ws.append(_blank_row(len(BASS_HEADERS)))
    ws.append(BASS_HEADERS)
    rows = [
        # real cells: as-run matrix row 4
        _bass_row(
            date=D(2012, 3, 30),
            time="90 - 11:10",
            asrun=1,
            test=1,
            sample=4,
            material="SIBAL 2 cm",
            restrictor=2,
            fan="66 > 52",
            air="10, 5",
            o2=0.221,
            p=0.97,
            co2=2.44,
            obs="Nice symmetric burn, some soot at 10 cm/s.",
        ),  # fmt: skip
        # real cell: messy text date in row 46
        _bass_row(
            date="6/29/`12",
            time="181:9:55",
            asrun=42,
            test=35,
            sample=16,
            material="1 cm sphere",
            restrictor=2,
            fan="41",
            air="0",
            o2=0.21894414078122915,
            p=0.9869736842105263,
            co2=2.5,
            obs="long ignition, fully engulfed by the end",
        ),  # fmt: skip
        # continuation row (fixture): only the observation cell is filled
        _bass_row(obs="continuation text directly below test 42"),
        # soot row, SETUP row and a dilution row are not tests (real labels)
        _bass_row(date="8/3/12", time="216", material="SOOT Cleaning", obs="soot cleaning done"),
        _bass_row(date=D(2012, 8, 24), asrun="STOW"),
        _bass_row(date=D(2013, 4, 4), time="13-94:  15:45", asrun="SETUP", obs="Hardware install"),
        _bass_row(date=D(2013, 4, 5), time="13-95 ", asrun="Dilution test with CSA-CP", obs="dilution"),
        # repeated as-run number 85 (real: rows 94 and 95)
        _bass_row(
            date=D(2013, 4, 9),
            time="GMT 13-099  10:39",
            asrun="85",
            test="117",
            sample="25",
            material="pmma 2 cm",
            restrictor="2",
            fan="62, 0.4, 0.38, 0.32 pot",
            air="8, <1 flow",
            o2=0.211,
            p=0.982,
            co2=2.9,
            obs="wake ign",
        ),  # fmt: skip
        _bass_row(
            date=D(2013, 4, 9),
            time="GMT 13-099   11:03",
            asrun="85",
            test="117a",
            sample="25",
            material="pmma 2 cm",
            restrictor="2",
            fan="62,  98, 62, 42, off",
            air="8, 20, 8, 1, 0",
            o2=0.211,
            p=0.982,
            co2=2.9,
            obs="increased flow to 20 cm/s",
        ),  # fmt: skip
        # implausible year (real: row 117 holds 2103-05-15), fixture-only values otherwise
        _bass_row(
            date=D(2103, 5, 15),
            time="GMT-13 135    MSG 11:4",
            asrun=104,
            test=50,
            sample=26,
            material="2 cm pmma sphere",
            restrictor=2,
            fan="52",
            air="5",
            o2=0.172,
            p=0.977,
            co2="?",
            obs="new sphere",
        ),  # fmt: skip
    ]
    for r in rows:
        ws.append(r)
    wb.save(path)
    return path


def build_calibration_workbook(path: Path) -> Path:
    """Two day blocks with the real layout (3 sections per block, order 0/1/2 restrictors).

    Block 1 (GMT 2014-049): no restrictors empty, 1 restrictor empty, 2 restrictors = real cells of
    the 2014-49 block (pot 10..2 -> fan 122..55, air 31..7.5). Block 2 (GMT 2014-190) is fixture-only.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "Fan Calibration data"

    def put_block(
        start_col: int, date: dt.datetime, gmt: str, sections: list[list[tuple[float, float, float | None]]]
    ) -> None:
        ws.cell(3, start_col, "DATE")
        ws.cell(3, start_col + 1, date)
        ws.cell(4, start_col, "GMT")
        ws.cell(4, start_col + 1, gmt)
        row = 7
        for sec in sections:
            for pot, fan, air in sec:
                ws.cell(row, start_col, pot)
                ws.cell(row, start_col + 1, fan)
                if air is not None:
                    ws.cell(row, start_col + 2, air)
                row += 1
            row += 2  # header rows between sections

    zero = [(10, 122, None), (0, 38, 0)]
    put_block(
        1,
        D(2014, 2, 18),
        "2014-49 - post soot cleaning",
        [zero, zero, [(10, 122, 31), (8, 105, 26.5), (6, 89, 20), (4, 72, 13), (2, 55, 7.5), (0, 38, 0)]],
    )
    put_block(
        7,
        D(2014, 7, 9),
        "2014-190",
        [
            [(10, 122, 47), (6, 88.5, 30), (2, 55, 12), (1, 46.5, 6), (0, 38, 0)],
            zero,
            [(10, 122, 32), (6, 88.5, 20), (2, 55, 7), (1, 46.5, 4), (0.5, 42, 1), (0, 38, 0)],
        ],
    )
    wb.save(path)
    return path


FIXTURE_TESTS = [
    # real cells: PSI-25 Olson rows 2 and 3 (test labels O1/O2) and row 4 (O3a); O20 is fixture-only
    ("PSI-25", "O1", "Olson", 2, "pmma_rod", "rod", "", "6.35", "", "clear", "stagnation", "unknown", "", "medium"),
    ("PSI-25", "O2", "Olson", 3, "pmma_rod", "rod", "", "6.35", "", "clear", "stagnation", "unknown", "", "medium"),
    ("PSI-25", "O3a", "Olson", 4, "pmma_rod", "rod", "", "6.35", "", "clear", "stagnation", "unknown", "o2 final none", "low"),
    ("PSI-25", "O20", "Olson", 5, "", "rod", "", "6.35", "", "clear", "stagnation", "unknown", "", "high"),
]  # fmt: skip
FIXTURE_STEPS = [
    # (test, step, value, unit, qualifier, state, mode, token, column, token_row, confidence)
    ("O1", 0, "20", "air_cm_s", "", "sustained", "", "20", "Air display", 2, "medium"),
    ("O1", 1, "10", "air_cm_s", "", "sustained", "", "10", "Air display", 2, "medium"),
    ("O1", 2, "5", "air_cm_s", "", "sustained", "", "5", "Air display", 2, "medium"),
    ("O1", 3, "2", "air_cm_s", "", "extinguished", "quench_low_flow", "2", "Air display", 2, "medium"),
    ("O2", 0, "0.54", "pot", "", "sustained", "", ".54 pot", "Fan display", 3, "medium"),
    ("O2", 1, "0.45", "pot", "", "not_ignited", "", "0.45 pot", "Fan display", 3, "medium"),
    ("O3a", 0, "5", "air_cm_s", "", "sustained", "", "5", "Air display", 4, "low"),
    ("O3a", 1, "3", "air_cm_s", "", "brief_flame_no_sustain", "", "3", "Air display", 4, "medium"),
    ("O20", 0, "9", "air_cm_s", "", "sustained", "", "WRONGTOKEN", "Air display", 5, "high"),
]
TESTS_HEADER = [
    "investigation_id",
    "test_label",
    "source_file",
    "source_sheet",
    "source_row",
    "material_family",
    "specimen_geometry",
    "thickness_mm",
    "diameter_mm",
    "width_mm",
    "sides_burning",
    "pmma_color",
    "flame_configuration",
    "configuration_evidence",
    "terminal_event",
    "o2_anomaly",
    "confidence",
    "note",
]
STEPS_HEADER = [
    "investigation_id",
    "test_label",
    "source_file",
    "source_sheet",
    "source_row",
    "step_index",
    "flow_value",
    "flow_unit",
    "flow_qualifier",
    "flame_state",
    "extinction_mode",
    "raw_token",
    "raw_column",
    "token_row",
    "confidence",
    "note",
]
BASS2_REL = "data/raw/psi/PSI-25/PSI-25_Science Documents_BASS-II_Test.Matrices.xlsx"
CAL_REL = "data/raw/psi/PSI-25/PSI-25_Reference Data_Fan calibration data.xlsx"


def write_curation(root: Path, chunk: str = "fixture_chunk") -> None:
    tdir = root / "data" / "curation" / "tests"
    sdir = root / "data" / "curation" / "steps"
    tdir.mkdir(parents=True, exist_ok=True)
    sdir.mkdir(parents=True, exist_ok=True)
    with (tdir / f"{chunk}.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(TESTS_HEADER)
        for (
            inv,
            label,
            sheet,
            row,
            fam,
            geom,
            thick,
            diam,
            width,
            color,
            conf_cfg,
            term,
            anomaly,
            conf,
        ) in FIXTURE_TESTS:
            w.writerow([inv, label, BASS2_REL, sheet, row, fam, geom, thick, diam, width, "", color, conf_cfg, "fixture", term, anomaly, conf, ""])  # fmt: skip
    with (sdir / f"{chunk}.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(STEPS_HEADER)
        for label, idx, val, unit, qual, state, mode, token, col, trow, conf in FIXTURE_STEPS:
            row = {"O1": 2, "O2": 3, "O3a": 4, "O20": 5}[label]
            w.writerow(["PSI-25", label, BASS2_REL, "Olson", row, idx, val, unit, qual, state, mode, token, col, trow, conf, ""])  # fmt: skip


def build_fixture_repo(root: Path, with_calibration: bool = True) -> Path:
    """A minimal repo layout: BASS-II matrix, optional calibration, one curation chunk, no profiles."""
    (root / "docs").mkdir(parents=True, exist_ok=True)
    (root / "docs" / "CONTRACTS.md").write_text("fixture\n", encoding="utf-8")
    inv = root / "data" / "raw" / "psi" / "PSI-25"
    inv.mkdir(parents=True, exist_ok=True)
    (inv / "inv_PSI-25.json").write_text(
        '{"doi": "10.0/fixture", "licenseIdentifier": "CC0-1.0", "investigationAcronym": "FX-II",'
        ' "title": "Fixture investigation", "added": []}',
        encoding="utf-8",
    )
    build_bass2_workbook(root / BASS2_REL)
    if with_calibration:
        build_calibration_workbook(root / CAL_REL)
    (root / "data" / "manifests").mkdir(parents=True, exist_ok=True)
    write_curation(root)
    return root
