from __future__ import annotations

import pytest

from blindspots.processing.units import (
    air_display_to_u_cm_s,
    atm_to_kpa,
    fraction_to_percent,
    inch_to_mm,
    mmhg_to_percent_vol,
    parse_number,
)


def test_atm_to_kpa() -> None:
    assert atm_to_kpa(1.0) == pytest.approx(101.325)
    assert atm_to_kpa(0.97) == pytest.approx(98.28525)


def test_inch_to_mm() -> None:
    assert inch_to_mm(0.25) == pytest.approx(6.35)


def test_fraction_to_percent() -> None:
    assert fraction_to_percent(0.221) == pytest.approx(22.1)


def test_mmhg_to_percent_vol() -> None:
    # real cells of the BASS as-run matrix row 4: 2.44 mm Hg CO2 at 0.97 atm
    assert mmhg_to_percent_vol(2.44, 0.97) == pytest.approx(2.44 / (0.97 * 760) * 100)
    assert mmhg_to_percent_vol(760.0, 1.0) == pytest.approx(100.0)


def test_air_display_to_u() -> None:
    assert air_display_to_u_cm_s(29) == pytest.approx(29.1914)  # calibration sheet "U cm/s*" cell


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (22.2, (22.2, "ok")),
        ("0.44", (0.44, "ok")),
        (None, (None, "missing")),
        ("none", (None, "missing")),
        (" ", (None, "missing")),
        ("?", (None, "missing")),
        ("OR", (None, "over_range")),
        ("over", (None, "over_range")),
        ("saturated", (None, "unparsed")),
    ],
)
def test_parse_number(raw: object, expected: tuple[float | None, str]) -> None:
    assert parse_number(raw) == expected
