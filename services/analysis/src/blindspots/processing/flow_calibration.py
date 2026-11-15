"""Fan calibration (PSI-25 reference data) and flow conversion (CONTRACTS section 2.4).

Layout of ``PSI-25_Reference Data_Fan calibration data.xlsx`` (verified against the sheet):

* Row 3 holds ``DATE`` / the date and row 4 ``GMT`` / ``2014-<day>[-note]`` for each calibration
  day. The first day block occupies columns A-E (Pot, Fan Display, Air Display, Fan V, ``U cm/s*``);
  every later day block is 4 columns wide starting at column G (Pot, Fan Display, Air Display, spacer).
* Below the header each block holds three sections stacked vertically. They are separated by
  ``decr`` / ``Air`` / ``Fan V`` header rows. The first block labels them in column D:
  ``no restrictor`` (row 4), ``1 restrictor`` (row 14) and ``2 resrictor`` (row 23). Section order
  is therefore 0, 1, 2 restrictors for every block; sections without Air readings stay empty.
* The note ``*U =1.0066(AIR)`` gives the duct speed: U = 1.0066 x AIR.
* A row belongs to a section when its Pot cell is numeric and its Fan Display or Air Display cell is
  numeric. Some rows have an empty Fan Display cell but a real Air reading (2014-202, 2 restrictors,
  cells CA32/CC32: pot 0.5 -> air 3); they are kept for pot conversions and skipped for fan-display ones.
"""

from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

import numpy as np
import openpyxl

from blindspots.processing.units import AIR_TO_U_FACTOR

CALIBRATION_FILE = "data/raw/psi/PSI-25/PSI-25_Reference Data_Fan calibration data.xlsx"
_GMT_RE = re.compile(r"^\s*(\d{4})-(\d{1,3})")
FIRST_DATA_ROW = 7
Kind = Literal["fan_display", "pot"]
#: fan display at pot 10 (fan "max"), from the calibration table (pot 10 <-> fan display 122)
FAN_MAX_DISPLAY = 122.0
#: fan display with the fan off (calibration rows "pot 0 | fan 38 | air 0")
FAN_OFF_DISPLAY = 38.0


@dataclass(frozen=True)
class CalPoint:
    pot: float
    fan_display: float | None
    air_display: float | None


@dataclass
class CalBlock:
    """One calibration day column block."""

    year: int
    gmt_day: int
    label: str
    date: dt.date | None
    sections: dict[int, list[CalPoint]] = field(default_factory=dict)

    @property
    def ordinal(self) -> int:
        return dt.date(self.year, 1, 1).toordinal() + self.gmt_day - 1


@dataclass(frozen=True)
class FlowResult:
    """Result of converting one fan/pot reading to a duct speed."""

    u_cm_s: float
    uncertainty_cm_s: float | None
    calibration_ref: str
    flags: tuple[str, ...]


def _parse_gmt(text: Any) -> tuple[int, int] | None:
    m = _GMT_RE.match(str(text or ""))
    return (int(m.group(1)), int(m.group(2))) if m else None


def _num(v: Any) -> float | None:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def parse_calibration_sheet(ws: Any) -> list[CalBlock]:
    """Parse all day blocks of the calibration sheet."""
    starts = [1, *range(7, ws.max_column + 1, 4)]
    blocks: list[CalBlock] = []
    for s in starts:
        if str(ws.cell(3, s).value or "").strip().upper() != "DATE":
            continue
        gmt_cell = ws.cell(4, s + 1).value
        parsed = _parse_gmt(gmt_cell)
        if parsed is None:
            continue
        date_cell = ws.cell(3, s + 1).value
        date = date_cell.date() if isinstance(date_cell, dt.datetime) else None
        block = CalBlock(year=parsed[0], gmt_day=parsed[1], label=str(gmt_cell).strip(), date=date)
        section = -1
        in_run = False
        for r in range(FIRST_DATA_ROW, ws.max_row + 1):
            pot, fan = _num(ws.cell(r, s).value), _num(ws.cell(r, s + 1).value)
            air = _num(ws.cell(r, s + 2).value)
            if pot is None:
                in_run = False
                continue
            if fan is None and air is None:
                continue  # pot setting with neither reading (e.g. 2014-195 row 32): no data, same section
            if not in_run:
                section += 1
                in_run = True
            idx = min(section, 2)  # stray trailing rows (e.g. the pot 0 row) belong to the last section
            block.sections.setdefault(idx, []).append(CalPoint(pot, fan, air))
        blocks.append(block)
    return blocks


def suspect_duplicate_sections(
    by_day: dict[tuple[int, int, int], list[CalPoint]], min_points: int = 3
) -> set[tuple[int, int, int]]:
    """Restrictor sections of one calibration day whose (pot, air) readings are identical to another section.

    A restrictor changes the duct flow at a given pot setting (on every day with two sections the
    readings differ), so two sections that agree at every shared pot setting (at least ``min_points``
    non-zero readings) of one day cannot both be measurements: one is a copy and
    the sheet does not say which. Both are treated as suspect and skipped (CONTRACTS 2.4). Example: day
    2014-210 "no restrictor" rows 7-12 repeat its "2 restrictor" rows 26-31 (20, 15, 10, 7, 3, 0).
    """
    out: set[tuple[int, int, int]] = set()
    days = sorted({(y, d) for (y, d, _n) in by_day})
    for y, d in days:
        readings = {
            n: {p.pot: p.air_display for p in by_day.get((y, d, n), []) if p.air_display is not None}
            for n in (0, 1, 2)
        }
        for n1 in (0, 1, 2):
            for n2 in range(n1 + 1, 3):
                shared = sorted(set(readings[n1]) & set(readings[n2]))
                nonzero = [x for x in shared if readings[n1][x] > 0]
                if len(nonzero) >= min_points and all(readings[n1][x] == readings[n2][x] for x in shared):
                    out.update({(y, d, n1), (y, d, n2)})
    return out


class FlowCalibration:
    """Calibration tables and conversions fan display / pot -> duct speed U (cm/s)."""

    def __init__(self, blocks: list[CalBlock]) -> None:
        self.blocks = blocks
        self.tables: dict[tuple[int, int], list[tuple[float, float | None, float | None]]] = {}
        # per (year, gmt_day, n) -> points, kept separate from the pooled public tables
        self._by_day: dict[tuple[int, int, int], list[CalPoint]] = {}
        for b in blocks:
            for n, pts in b.sections.items():
                self.tables.setdefault((b.gmt_day, n), []).extend(
                    (p.pot, p.fan_display, p.air_display) for p in pts
                )
                self._by_day.setdefault((b.year, b.gmt_day, n), []).extend(pts)
        self.suspect_duplicates: set[tuple[int, int, int]] = suspect_duplicate_sections(self._by_day)

    @classmethod
    def from_workbook(cls, path: Path) -> FlowCalibration:
        wb = openpyxl.load_workbook(path, data_only=True)
        return cls(parse_calibration_sheet(wb.worksheets[0]))

    # ------------------------------------------------------------------ selection
    def usable_days(self, n_restrictors: int, skip_suspect: bool = True) -> list[tuple[int, int]]:
        """(year, gmt_day) pairs with at least two non-zero air readings for this restrictor count.

        Sections flagged by :func:`suspect_duplicate_sections` are skipped unless ``skip_suspect`` is False.
        """
        out = []
        for (year, day, n), pts in sorted(self._by_day.items()):
            nonzero = {p.pot for p in pts if p.air_display and p.air_display > 0}
            if skip_suspect and (year, day, n) in self.suspect_duplicates:
                continue
            if n == n_restrictors and len(nonzero) >= 2:  # a single point cannot define a curve
                out.append((year, day))
        return out

    @staticmethod
    def _distance(year: int | None, day: int, cy: int, cd: int) -> int:
        """Distance in days between a query day and a calibration day (day of year when year is None)."""
        if year is None:
            return abs(cd - day)
        return abs(dt.date(cy, 1, 1).toordinal() + cd - dt.date(year, 1, 1).toordinal() - day)

    # ------------------------------------------------------------------ interpolation
    @staticmethod
    def _curve(points: list[CalPoint], kind: Kind) -> list[tuple[float, float]]:
        """(x, air) pairs with non-zero air, duplicates at the same x averaged, sorted by x."""
        acc: dict[float, list[float]] = {}
        for p in points:
            if p.air_display is None or p.air_display <= 0:
                continue
            x = p.pot if kind == "pot" else p.fan_display
            if x is None:  # no fan display recorded for this row: usable for pot conversions only
                continue
            acc.setdefault(x, []).append(p.air_display)
        return sorted((x, float(np.mean(v))) for x, v in acc.items())

    def convert(
        self,
        kind: Kind,
        value: float,
        n_restrictors: int,
        year: int | None,
        gmt_day: int | None,
    ) -> FlowResult | None:
        """Duct speed for a fan-display or pot reading, or None when no calibration exists.

        ``year=None`` means the test is not from the calibration campaign (BASS 2012-13): the nearest
        calibration day by day of year is used and the caller must add ``calibration_borrowed_from_bass2``.
        When skipping a suspected duplicate section changed the chosen day, the result carries the flag
        ``calibration_block_suspect_duplicate``.
        """
        res = self._convert(kind, value, n_restrictors, year, gmt_day, skip_suspect=True)
        if res is None or not any(n == n_restrictors for (_y, _d, n) in self.suspect_duplicates):
            return res
        unfiltered = self._convert(kind, value, n_restrictors, year, gmt_day, skip_suspect=False)
        if unfiltered is not None and unfiltered.calibration_ref != res.calibration_ref:
            flags = (*res.flags, "calibration_block_suspect_duplicate")
            return FlowResult(res.u_cm_s, res.uncertainty_cm_s, res.calibration_ref, flags)
        return res

    def _convert(
        self,
        kind: Kind,
        value: float,
        n_restrictors: int,
        year: int | None,
        gmt_day: int | None,
        skip_suspect: bool,
    ) -> FlowResult | None:
        days = self.usable_days(n_restrictors, skip_suspect)
        if not days or gmt_day is None:
            return None
        curves = {d: self._curve(self._by_day[(d[0], d[1], n_restrictors)], kind) for d in days}
        dist = {d: self._distance(year, gmt_day, d[0], d[1]) for d in days}
        same = (year, gmt_day) if year is not None and (year, gmt_day) in curves else None
        covering = [d for d in days if curves[d] and curves[d][0][0] <= value]
        flags: list[str] = []
        chosen: tuple[int, int]
        if same is not None and same in covering:
            chosen = same
        elif covering:
            chosen = min(covering, key=lambda d: (dist[d], d))
            if same is not None:
                flags.append("calibration_same_day_not_covering_value")
        else:
            # no day reaches down to this value: take the day with the lowest calibrated point
            with_points = [d for d in days if curves[d]]
            if not with_points:
                return None
            chosen = min(with_points, key=lambda d: (curves[d][0][0], dist[d], d))
        cy, cd = chosen
        curve = curves[chosen]
        if chosen != same:
            flags.append("calibration_nearest_day")
            if year is not None and dist[chosen] > 30:
                flags.append("calibration_day_gap_over_30_days")
        ref = f"{cy}-{cd:03d}/{n_restrictors} restrictors"
        xs = [c[0] for c in curve]
        airs = [c[1] for c in curve]
        if value < xs[0]:
            # Below the lowest calibrated non-zero point (CONTRACTS 2.4): interpolate linearly between the
            # calibration sheet's fan-off row (pot 0 / fan display 38 -> air 0) and the lowest calibrated
            # point. Order-preserving bounded assumption; the true low-flow curve is unknown (the fan stops
            # at a finite voltage above 3.8 V and the anemometer under-reads below ~2 cm/s).
            lowest_u = AIR_TO_U_FACTOR * airs[0]
            uncertainty = max(0.5, lowest_u / 2.0)
            flags.extend(["below_calibration_range", "flow_interpolated_to_fan_off"])
            zero_x = 0.0 if kind == "pot" else FAN_OFF_DISPLAY
            if value <= zero_x or xs[0] <= zero_x:
                return FlowResult(0.0, uncertainty, ref, tuple(flags))
            frac = (value - zero_x) / (xs[0] - zero_x)
            return FlowResult(lowest_u * frac, uncertainty, ref, tuple(flags))
        if value > xs[-1]:
            flags.append("above_calibration_range")
            return FlowResult(AIR_TO_U_FACTOR * airs[-1], None, ref, tuple(flags))
        air = float(np.interp(value, xs, airs))
        return FlowResult(AIR_TO_U_FACTOR * air, None, ref, tuple(flags))


def load_default(repo_root: Path) -> FlowCalibration | None:
    path = repo_root / CALIBRATION_FILE
    return FlowCalibration.from_workbook(path) if path.is_file() else None
