from __future__ import annotations

from pathlib import Path

import pytest
from fixture_builders import build_calibration_workbook

from blindspots.config import REPO_ROOT
from blindspots.processing.flow_calibration import CALIBRATION_FILE, FlowCalibration

REAL = REPO_ROOT / CALIBRATION_FILE


@pytest.fixture
def cal(tmp_path: Path) -> FlowCalibration:
    return FlowCalibration.from_workbook(build_calibration_workbook(tmp_path / "fixture_cal.xlsx"))


def test_tables_structure(cal: FlowCalibration) -> None:
    assert cal.tables[(49, 2)][0] == (10.0, 122.0, 31.0)
    assert (190, 0) in cal.tables and (190, 1) in cal.tables


def test_interpolation_same_day(cal: FlowCalibration) -> None:
    # pot 5 lies between (4, air 13) and (6, air 20) of the 2014-49 2-restrictor block
    r = cal.convert("pot", 5.0, 2, 2014, 49)
    assert r is not None and r.u_cm_s == pytest.approx(1.0066 * 16.5)
    assert r.calibration_ref == "2014-049/2 restrictors" and r.flags == ()
    # fan display 89 is a calibrated point: air 20
    r = cal.convert("fan_display", 89.0, 2, 2014, 49)
    assert r is not None and r.u_cm_s == pytest.approx(1.0066 * 20)


def test_below_range_rule(cal: FlowCalibration) -> None:
    # pot 0.3 is below every calibrated non-zero point; the day with the lowest point is 2014-190
    # (pot 0.5 -> air 1). Linear interpolation to the fan-off row (pot 0 -> 0): 1.0066 x 1 x 0.3/0.5;
    # uncertainty = max(0.5, half the lowest calibrated flow).
    r = cal.convert("pot", 0.3, 2, 2014, 49)
    assert r is not None and r.calibration_ref == "2014-190/2 restrictors"
    assert r.u_cm_s == pytest.approx(1.0066 * 1.0 * 0.3 / 0.5)
    assert r.uncertainty_cm_s == pytest.approx(max(0.5, 1.0066 * 1.0 / 2))
    assert "below_calibration_range" in r.flags and "flow_interpolated_to_fan_off" in r.flags


def test_below_range_preserves_order(cal: FlowCalibration) -> None:
    # the near-quench steps (pots 0.36 > 0.305 > 0.275) must keep their order
    flows = [cal.convert("pot", p, 2, 2014, 190) for p in (0.36, 0.305, 0.275)]
    assert all(f is not None for f in flows)
    u = [f.u_cm_s for f in flows if f is not None]
    assert u[0] > u[1] > u[2] > 0
    off = cal.convert("fan_display", 38.0, 2, 2014, 190)
    assert off is not None and off.u_cm_s == 0.0


def test_same_day_below_lowest_point_falls_back_to_covering_day(cal: FlowCalibration) -> None:
    # day 49 2 restrictors bottoms out at pot 2 (air 7.5); day 190 has pot 1 -> air 4
    r = cal.convert("pot", 1.0, 2, 2014, 49)
    assert r is not None and r.calibration_ref == "2014-190/2 restrictors"
    assert r.u_cm_s == pytest.approx(1.0066 * 4)


def test_nearest_day_covering_the_value(cal: FlowCalibration) -> None:
    # pot 0.5 is below day 49's lowest point (pot 2) but covered by day 190 (pot 0.5, air 1): use day 190
    r = cal.convert("pot", 0.5, 2, 2014, 49)
    assert r is not None and r.calibration_ref == "2014-190/2 restrictors"
    assert r.u_cm_s == pytest.approx(1.0066 * 1.0)
    assert "calibration_nearest_day" in r.flags and "calibration_same_day_not_covering_value" in r.flags


def test_restrictor_count_without_air_readings_gives_none(cal: FlowCalibration) -> None:
    assert cal.convert("pot", 5.0, 1, 2014, 49) is None


def test_borrowed_year_uses_day_of_year(cal: FlowCalibration) -> None:
    r = cal.convert("fan_display", 62.0, 2, None, 60)
    assert r is not None and r.calibration_ref == "2014-049/2 restrictors"
    assert "calibration_nearest_day" in r.flags


def test_above_range_clamped(cal: FlowCalibration) -> None:
    r = cal.convert("fan_display", 130.0, 2, 2014, 49)
    assert r is not None and "above_calibration_range" in r.flags
    assert r.u_cm_s == pytest.approx(1.0066 * 31)


def test_missing_day_returns_none(cal: FlowCalibration) -> None:
    assert cal.convert("pot", 5.0, 0, 2014, None) is None


@pytest.mark.skipif(not REAL.is_file(), reason="raw calibration file not present")
class TestRealSheet:
    @pytest.fixture
    def real(self) -> FlowCalibration:
        return FlowCalibration.from_workbook(REAL)

    def test_pinned_cells(self, real: FlowCalibration) -> None:
        assert len(real.blocks) == 27
        # real cells, block 2014-49, 2 restrictors: pot 10/8/6/4/2 -> air 31/26.5/20/13/7.5
        assert [p[2] for p in real.tables[(49, 2)][:5]] == [31, 26.5, 20, 13, 7.5]
        assert [p[1] for p in real.tables[(49, 2)][:5]] == [122, 105, 89, 72, 55]
        # real cells, block 2014-50, no restrictors: pot 10 -> fan 122, air 59
        assert real.tables[(50, 0)][0] == (10, 122, 59)
        # real cells, block 2014-212 (p.m.) 1 restrictor: pot 10 -> air 40 and pot 0.5 -> 2
        assert (10, 122, 40) in real.tables[(212, 1)]
        # first block (GMT 2014-043), U column "U = 1.0066(AIR)": air 29 -> 29.1914
        assert real.tables[(43, 0)][0] == (10, 122, 29)

    def test_matrix_example_O1_fan_89_is_air_20(self, real: FlowCalibration) -> None:
        # matrix test O1 (restrictor 2, GMT 49): fan 89 recorded with air display 20
        r = real.convert("fan_display", 89.0, 2, 2014, 49)
        assert r is not None and r.u_cm_s == pytest.approx(1.0066 * 20)

    def test_row_without_fan_display_is_kept(self, real: FlowCalibration) -> None:
        # real cells, block 2014-202, 2 restrictors (columns CA-CC, rows 31-33): pot 1 | fan 47 | air 5,
        # pot 0.5 | (empty) | air 3, pot 0 | fan 38 | air 0. The empty fan cell must not drop the reading.
        pts = [(p.pot, p.fan_display, p.air_display) for p in real._by_day[(2014, 202, 2)]]
        assert pts[-3:] == [(1, 47, 5), (0.5, None, 3), (0, 38, 0)]
        r = real.convert("pot", 0.5, 2, 2014, 202)
        assert r is not None and r.calibration_ref == "2014-202/2 restrictors" and r.flags == ()
        assert r.u_cm_s == pytest.approx(1.0066 * 3)
        # below the lowest point the same day now applies: pot 0.27 -> 1.0066 x 3 x 0.27/0.5
        r = real.convert("pot", 0.27, 2, 2014, 202)
        assert r is not None and r.calibration_ref == "2014-202/2 restrictors"
        assert r.u_cm_s == pytest.approx(1.0066 * 3 * 0.27 / 0.5)
        assert r.uncertainty_cm_s == pytest.approx(1.0066 * 3 / 2)
        # the row has no fan display, so fan-display conversions on that day cannot use it
        r = real.convert("fan_display", 47.0, 2, 2014, 202)
        assert r is not None and r.u_cm_s == pytest.approx(1.0066 * 5)

    def test_below_range_real(self, real: FlowCalibration) -> None:
        r = real.convert("pot", 0.35, 2, 2014, 190)
        # lowest non-zero point of the real 2014-190 2-restrictor block is pot 0.5 -> air 0.5
        assert r is not None and "below_calibration_range" in r.flags
        assert r.u_cm_s == pytest.approx(1.0066 * 0.5 * 0.35 / 0.5)


def test_suspect_duplicate_sections_are_skipped() -> None:
    """Two restrictor sections of one day with identical readings are both skipped (CONTRACTS 2.4)."""
    from blindspots.processing.flow_calibration import CalBlock, CalPoint

    fixture_dup = [CalPoint(10, 122, 20), CalPoint(6, 88.5, 10), CalPoint(2, 55, 3), CalPoint(0, 38, 0)]
    fixture_ok0 = [CalPoint(10, 122, 50), CalPoint(6, 88.5, 35), CalPoint(2, 55, 15)]
    fixture_ok2 = [CalPoint(10, 122, 22), CalPoint(6, 88.5, 12), CalPoint(2, 55, 4)]
    blocks = [
        CalBlock(2014, 200, "2014-200", None, {0: fixture_ok0, 2: fixture_ok2}),
        CalBlock(2014, 210, "2014-210", None, {0: list(fixture_dup), 2: list(fixture_dup[:3])}),
    ]
    cal = FlowCalibration(blocks)
    assert cal.suspect_duplicates == {(2014, 210, 0), (2014, 210, 2)}
    assert cal.usable_days(0) == [(2014, 200)]
    res = cal.convert("pot", 6.0, 0, 2014, 210)
    assert res is not None
    assert res.calibration_ref == "2014-200/0 restrictors"
    assert "calibration_block_suspect_duplicate" in res.flags
    assert res.u_cm_s == pytest.approx(1.0066 * 35)


def test_real_sheet_day_210_no_restrictor_block_is_suspect() -> None:
    path = REPO_ROOT / CALIBRATION_FILE
    if not path.is_file():
        pytest.skip("calibration workbook not present")
    cal = FlowCalibration.from_workbook(path)
    assert (2014, 210, 0) in cal.suspect_duplicates
    res = cal.convert("pot", 5.0, 0, 2016, 57)
    assert res is not None and not res.calibration_ref.startswith("2014-210")


def test_parser_keeps_pot_air_row_with_empty_fan_cell() -> None:
    """A pot -> air row with an empty Fan Display cell stays in its section; a pot-only row is skipped."""
    import openpyxl

    from blindspots.processing.flow_calibration import CalPoint, parse_calibration_sheet

    wb = openpyxl.Workbook()
    ws = wb.active
    assert ws is not None
    ws.cell(3, 1, "DATE")
    ws.cell(4, 1, "GMT")
    ws.cell(4, 2, "2014-202")
    rows = [(2, 55, 8), (1, 47, 5), (0.5, None, 3), (0.4, None, None), (0, 38, 0)]
    for i, (pot, fan, air) in enumerate(rows):
        ws.cell(7 + i, 1, pot)
        ws.cell(7 + i, 2, fan)
        ws.cell(7 + i, 3, air)
    (block,) = parse_calibration_sheet(ws)
    assert block.sections == {
        0: [CalPoint(2, 55, 8), CalPoint(1, 47, 5), CalPoint(0.5, None, 3), CalPoint(0, 38, 0)]
    }
