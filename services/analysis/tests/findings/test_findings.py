"""GET /api/findings: pure compute_findings on synthetic fixtures, plus one check on the real dataset."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from blindspots import config
from blindspots.api import deps
from blindspots.api.app import create_app
from blindspots.findings.compute import compute_findings


def fixture_obs(
    oid: str,
    group: str,
    o2: float,
    burning: bool,
    airflow: float | None = 5.0,
    measured_kpa: float | None = None,
    assumed_kpa: float | None = 101.353,
    flags: list[str] | None = None,
    included: bool = True,
) -> dict[str, Any]:
    qf = list(flags or [])
    if measured_kpa is None and assumed_kpa is not None:
        qf.append("pressure_assumed")
    return {
        "observation_id": oid,
        "experiment_id": oid.split("#")[0],
        "investigation_id": "FIXTURE-1",
        "campaign_group": "fixture_campaign",
        "material_family": group.split("__")[0],
        "flame_configuration": group.split("__")[1],
        "group_id": group,
        "oxygen_percent": o2,
        "airflow_cm_s": airflow,
        "total_pressure_kpa": measured_kpa,
        "pressure_for_analysis_kpa": measured_kpa if measured_kpa is not None else assumed_kpa,
        "flame_state": "sustained" if burning else "extinguished",
        "label": 1 if burning else 0,
        "quality_flags": qf,
        "included_in_training": included,
    }


FIXTURE_TARGETS = {
    "profiles": [
        {
            "profile_id": "iss_cabin_nominal",
            "oxygen_percent": {"nominal": 21.0},
            "total_pressure_kpa": {"nominal": 101.353},
        },
        {
            "profile_id": "exploration_atmosphere_8p2_34",
            "oxygen_percent": {"nominal": 34.0},
            "total_pressure_kpa": {"nominal": 56.537},
        },
        {
            "profile_id": "artemis_surface_habitat_10p2_26p5",
            "oxygen_percent": {"nominal": 26.5},
            "total_pressure_kpa": {"nominal": 70.327},
        },
    ]
}
FIXTURE_HEADLINE = {
    "profiles": [
        {
            "profile_id": "fixture_b",
            "label": "Fixture B",
            "oxygen_percent": 21.0,
            "total_pressure_kpa": 101.353,
            "comparable_observations": 5,
            "groups_with_comparable": 2,
            "n_groups": 3,
        },
        {
            "profile_id": "fixture_a",
            "label": "Fixture A",
            "oxygen_percent": 34.0,
            "total_pressure_kpa": 56.537,
            "comparable_observations": 0,
            "groups_with_comparable": 0,
            "n_groups": 3,
        },
    ]
}


def synthetic_observations() -> list[dict[str, Any]]:
    return [
        # g1: lowest burning 15.0 (2 records), went out up to 17.0 -> overlap [15, 17]
        fixture_obs("g1e1#s0", "fix_a__opposed", 15.0, True, airflow=1.0),
        fixture_obs("g1e2#s0", "fix_a__opposed", 15.0, True, airflow=12.0, flags=["o2_interpolated"]),
        fixture_obs("g1e3#s0", "fix_a__opposed", 17.0, False, airflow=None),
        fixture_obs("g1e4#s0", "fix_a__opposed", 16.0, False, airflow=25.0),
        fixture_obs("g1e5#s0", "fix_a__opposed", 18.0, True, airflow=3.0),
        # g2: same lowest burning 15.0 but fewer records -> ranked after g1; out only below -> no overlap
        fixture_obs("g2e1#s0", "fix_b__concurrent", 15.0, True, measured_kpa=60.0),
        fixture_obs("g2e2#s0", "fix_b__concurrent", 14.0, False, measured_kpa=60.0),
        # g3: same as g2 (tie on o2 and count) -> group_id decides; aaa sorts first
        fixture_obs("g3e1#s0", "aaa__concurrent", 15.0, True, measured_kpa=98.0),
        fixture_obs("g3e2#s0", "aaa__concurrent", 14.0, False, assumed_kpa=101.353),
        # g4: never burned -> ranked last
        fixture_obs("g4e1#s0", "fix_c__wake", 20.0, False, measured_kpa=None, assumed_kpa=None),
        # excluded row must be ignored
        fixture_obs("g1e9#s0", "fix_a__opposed", 10.0, True, included=False),
    ]


def run() -> dict[str, Any]:
    groups = [
        {"group_id": "fix_a__opposed", "label": "A", "model_status": "modeled", "model_reason": None},
        {
            "group_id": "fix_b__concurrent",
            "label": "B",
            "model_status": "insufficient_data",
            "model_reason": "few",
        },
    ]
    return compute_findings(synthetic_observations(), groups, FIXTURE_TARGETS, FIXTURE_HEADLINE, "dv", "mv")


def by_id(out: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {m["group_id"]: m for m in out["materials"]}


def test_ranking_order_and_tie_break() -> None:
    out = run()
    order = [m["group_id"] for m in out["materials"]]
    assert order == ["fix_a__opposed", "aaa__concurrent", "fix_b__concurrent", "fix_c__wake"]
    assert [m["rank"] for m in out["materials"]] == [1, 2, 3, 4]
    assert out["summary"]["n_observations"] == 10  # excluded row left out
    assert out["summary"]["n_sustained"] == 5 and out["summary"]["n_not_sustained"] == 5


def test_overlap_only_when_lo_le_hi() -> None:
    m = by_id(run())
    assert m["fix_a__opposed"]["overlap_o2"] == [15.0, 17.0]
    assert m["fix_b__concurrent"]["overlap_o2"] is None
    assert "fix_b__concurrent:overlap" not in {f["id"] for f in m["fix_b__concurrent"]["findings"]}
    ov = next(f for f in m["fix_a__opposed"]["findings"] if f["kind"] == "overlap")
    assert (ov["k"], ov["n"]) == (2, 4)  # 15, 15, 16(out), 17(out) in [15, 17]


def test_airflow_bins_and_missing() -> None:
    a = by_id(run())["fix_a__opposed"]
    assert a["n_airflow_missing"] == 1
    bins = {(b["lo"], b["hi"]): b for b in a["airflow_bins"]}
    assert bins[(0.0, 2.0)]["n"] == 1 and bins[(0.0, 2.0)]["lowest_o2_burning"] == 15.0
    assert bins[(2.0, 5.0)]["lowest_o2_burning"] == 18.0
    assert bins[(10.0, 20.0)]["n_sustained"] == 1
    assert bins[(20.0, None)]["n"] == 1 and bins[(20.0, None)]["lowest_o2_burning"] is None
    assert sum(b["n"] for b in a["airflow_bins"]) + a["n_airflow_missing"] == a["n_observations"]
    assert any(f["kind"] == "airflow" for f in a["findings"])
    # g2 has a single airflow bin with a burning flame -> no airflow finding
    assert not any(f["kind"] == "airflow" for f in by_id(run())["fix_b__concurrent"]["findings"])


def test_pressure_basis_cases() -> None:
    m = by_id(run())
    assert m["fix_a__opposed"]["tested_ranges"]["pressure_basis"] == "assumed"
    assert m["fix_b__concurrent"]["tested_ranges"]["pressure_basis"] == "measured"
    assert m["aaa__concurrent"]["tested_ranges"]["pressure_basis"] == "mixed"
    assert m["fix_c__wake"]["tested_ranges"]["pressure_basis"] == "mixed"
    assert m["fix_c__wake"]["tested_ranges"]["pressure_kpa"] is None
    assert m["fix_c__wake"]["highest_o2_out"]["pressure_basis"] == "missing"
    assert m["fix_c__wake"]["highest_o2_out"]["pressure_kpa"] is None
    low = m["fix_a__opposed"]["lowest_o2_burning"]
    assert low["n_at_value"] == 2 and low["observation_ids"] == ["g1e1#s0", "g1e2#s0"]
    assert low["pressure_basis"] == "assumed" and low["o2_basis"] == "measured"
    lf = next(f for f in m["fix_a__opposed"]["findings"] if f["kind"] == "lowest_o2_burning")
    assert "sea-level pressure is assumed" in lf["interpretation"] and "below" in lf["interpretation"]
    assert m["fix_b__concurrent"]["lowest_o2_burning"]["pressure_kpa"] == 60.0
    # 60 kPa was tested for g2, so no pressure-gap finding there
    assert not any(f["kind"] == "pressure_gap" for f in m["fix_b__concurrent"]["findings"])
    assert any(f["kind"] == "pressure_gap" for f in m["fix_a__opposed"]["findings"])


def test_no_detection_pillar_and_cabin_ranking() -> None:
    out = run()
    pillars = {f["pillar"] for m in out["materials"] for f in m["findings"]}
    assert pillars <= {"prevention", "suppression"}
    assert [c["profile_id"] for c in out["cabins"]] == ["fixture_a", "fixture_b"]
    assert out["cabins"][1]["sentence"] == "Fixture B: 5 comparable ISS results across 2 of 3 materials."


def test_deterministic() -> None:
    assert run() == run()


_real = pytest.mark.skipif(
    not (config.NORMALIZED_DIR / "experiments.json").is_file() or config.dataset_version() is None,
    reason="normalized dataset not built",
)


@_real
def test_real_dataset_route() -> None:
    deps.clear_caches()
    client = TestClient(create_app())
    r = client.get("/api/findings")
    assert r.status_code == 200
    body = r.json()
    assert 0 < len(body["materials"]) <= 20
    known = {o["observation_id"] for o in client.get("/api/observations").json()}
    for m in body["materials"]:
        for f in m["findings"]:
            assert f["pillar"] != "detection"
            assert set(f["observation_ids"]) <= known
    assert client.get("/api/findings").json() == body
