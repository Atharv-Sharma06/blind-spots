"""Unit conversions and tolerant cell parsing shared by the ingestion code (CONTRACTS section 2.4)."""

from __future__ import annotations

import datetime as dt
import re
from typing import Any

ATM_TO_KPA = 101.325
INCH_TO_MM = 25.4
MMHG_PER_ATM = 760.0
AIR_TO_U_FACTOR = 1.0066  # "*U = 1.0066(AIR)" note in PSI-25_Reference Data_Fan calibration data.xlsx

_NUMBER_RE = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$")
_MISSING_WORDS = {"", "none", "n/a", "na", "nan", "-", "?", "tbd", "null"}
_OVER_RANGE_WORDS = {"or", "over", "o.r.", "o/r", "over range", "overrange", "ovr"}


def atm_to_kpa(atm: float) -> float:
    """Standard atmospheres to kilopascals (x 101.325)."""
    return atm * ATM_TO_KPA


def inch_to_mm(inch: float) -> float:
    return inch * INCH_TO_MM


def fraction_to_percent(fraction: float) -> float:
    return fraction * 100.0


def mmhg_to_percent_vol(mmhg: float, p_atm: float) -> float:
    """Partial pressure (mm Hg) to % by volume of a total pressure given in atm.

    percent = mmHg / (P_atm * 760) * 100.
    """
    return mmhg / (p_atm * MMHG_PER_ATM) * 100.0


def air_display_to_u_cm_s(air: float) -> float:
    """Air-display reading to duct speed U in cm/s (U = 1.0066 x AIR)."""
    return AIR_TO_U_FACTOR * air


def cell_text(value: Any) -> str:
    """Cell text as the provenance checker sees it (dates as ISO strings)."""
    if value is None:
        return ""
    if isinstance(value, dt.datetime):
        return value.date().isoformat() if value.time() == dt.time(0) else value.isoformat()
    if isinstance(value, dt.date):
        return value.isoformat()
    return str(value)


def norm_text(value: Any) -> str:
    """Whitespace-normalised text (header matching)."""
    return " ".join(str(value if value is not None else "").split())


def parse_number(value: Any) -> tuple[float | None, str]:
    """Parse a numeric cell. Returns (value, status).

    status is one of ``ok``, ``missing`` (blank/none/n/a/?), ``over_range`` (OR/over) or
    ``unparsed`` (text that is not a plain number; value stays None, never guessed).
    """
    if value is None:
        return None, "missing"
    if isinstance(value, bool):
        return None, "unparsed"
    if isinstance(value, (int, float)):
        return float(value), "ok"
    text = str(value).strip()
    low = text.lower()
    if low in _MISSING_WORDS:
        return None, "missing"
    if low in _OVER_RANGE_WORDS:
        return None, "over_range"
    if _NUMBER_RE.match(text):
        return float(text), "ok"
    return None, "unparsed"
