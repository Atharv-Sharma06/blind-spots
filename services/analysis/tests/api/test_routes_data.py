"""Data/coverage endpoints against the real normalized dataset (skipped when it has not been built)."""

from __future__ import annotations

import csv
import io
import time
from typing import Any

import pytest
from fastapi.testclient import TestClient

from blindspots import config
from blindspots.api import deps, models
from blindspots.api.app import create_app
from blindspots.schemas import ExperimentRecord

pytestmark = pytest.mark.skipif(
    not (config.NORMALIZED_DIR / "experiments.json").is_file() or config.dataset_version() is None,
    reason="normalized dataset not built",
)


@pytest.fixture(scope="module")
def client() -> TestClient:
    deps.clear_caches()
    return TestClient(create_app())


@pytest.fixture(scope="module")
def group_ids(client: TestClient) -> list[str]:
    return [g["group_id"] for g in client.get("/api/groups").json()]


def test_health_ok_dataset(client: TestClient) -> None:
    body = client.get("/api/health").json()
    models.HealthResponse.model_validate(body)
    assert body["artifacts"]["dataset"] is True
    assert body["dataset_version"] == config.dataset_version()


def test_investigations_and_counts(client: TestClient) -> None:
    inv = client.get("/api/investigations").json()
    assert {i["investigation_id"] for i in inv} >= {"PSI-25", "PSI-26"}
    exps = client.get("/api/experiments").json()
    obs = client.get("/api/observations").json()
    assert len(exps) == sum(i["n_experiments"] for i in inv)
    assert len(obs) == sum(i["n_observations"] for i in inv)
    assert all("group_id" in e for e in exps)


def test_groups_shape_and_status(client: TestClient) -> None:
    groups = client.get("/api/groups").json()
    assert groups
    for g in groups:
        assert g["model_status"] in ("modeled", "insufficient_data")
        assert (g["model_reason"] is None) == (g["model_status"] == "modeled")
        assert g["label_counts"]["sustained"] + g["label_counts"]["not_sustained"] == g["n_training"]
    assert any(g["model_status"] == "modeled" for g in groups)


def test_experiment_filters_and_search(client: TestClient, group_ids: list[str]) -> None:
    gid = group_ids[0]
    rows = client.get("/api/experiments", params={"group": gid}).json()
    assert rows and all(r["group_id"] == gid for r in rows)
    rows = client.get("/api/experiments", params={"investigation": "PSI-26"}).json()
    assert rows and {r["investigation_id"] for r in rows} == {"PSI-26"}
    inc = client.get("/api/experiments", params={"included": "true"}).json()
    exc = client.get("/api/experiments", params={"included": "false"}).json()
    assert all(r["included_in_training"] for r in inc)
    assert not any(r["included_in_training"] for r in exc)
    assert len(inc) + len(exc) == len(client.get("/api/experiments").json())
    first = client.get("/api/experiments").json()[0]
    hits = client.get("/api/experiments", params={"q": first["test_label"].upper()}).json()
    assert any(h["experiment_id"] == first["experiment_id"] for h in hits)
    assert client.get("/api/experiments", params={"q": "zzzz-no-such-text"}).json() == []


def test_experiment_detail_and_404(client: TestClient) -> None:
    exps = client.get("/api/experiments", params={"included": "true"}).json()
    slash = next((e for e in exps if "/" in e["experiment_id"]), exps[0])
    detail = client.get(f"/api/experiments/{slash['experiment_id']}").json()
    models.ExperimentDetail.model_validate(detail)
    assert detail["experiment"]["experiment_id"] == slash["experiment_id"]
    assert len(detail["observations"]) == slash["n_observations"]
    r = client.get("/api/experiments/PSI-00:nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"
    for path in ("/api/observations?group=nope__nope", "/api/coverage?group=nope__nope"):
        r = client.get(path)
        assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_observations_group_filter(client: TestClient, group_ids: list[str]) -> None:
    obs = client.get("/api/observations", params={"group": group_ids[0]}).json()
    assert obs and all(o["group_id"] == group_ids[0] for o in obs)


def test_export_csv_header(client: TestClient) -> None:
    r = client.get("/api/export/experiments.csv", params={"investigation": "PSI-25"})
    assert r.headers["content-type"].startswith("text/csv")
    rows = list(csv.reader(io.StringIO(r.text)))
    assert rows[0] == list(ExperimentRecord.model_fields)
    assert len(rows) - 1 == len(client.get("/api/experiments", params={"investigation": "PSI-25"}).json())


def test_export_csv_context_only_groups(client: TestClient, group_ids: list[str]) -> None:
    """Groups that exist only on context records (e.g. Saffire) filter the table and CSV; unknown ids 404."""
    record_groups = {e["group_id"] for e in client.get("/api/experiments").json()}
    context_only = sorted(record_groups - set(group_ids))
    assert context_only, "expected at least one context-only group id on the records"
    for gid in context_only:
        rows = client.get("/api/experiments", params={"group": gid}).json()
        assert rows and all(r["group_id"] == gid for r in rows)
        r = client.get("/api/export/experiments.csv", params={"group": gid})
        assert r.status_code == 200
        assert len(list(csv.reader(io.StringIO(r.text)))) - 1 == len(rows)
    assert client.get("/api/export/experiments.csv", params={"group": "no_such__group"}).status_code == 404


def test_methodology_flow_provenance(client: TestClient) -> None:
    fp = client.get("/api/methodology").json()["config"]["training_flow_provenance"]
    assert set(fp) == {
        "n_training",
        "n_recorded",
        "n_converted_bass2_calibration",
        "n_borrowed_calibration",
        "n_below_calibration_range",
    }
    store = deps.require_store()
    train = [o for o in store.observations if o["included_in_training"] and o.get("label") is not None]
    assert fp["n_training"] == len(train) > 0
    assert fp["n_recorded"] + fp["n_converted_bass2_calibration"] + fp["n_borrowed_calibration"] <= len(train)
    sentence = next(x for x in client.get("/api/methodology").json()["limitations"] if "training steps" in x)
    assert f"{fp['n_recorded']} of {fp['n_training']} training steps" in sentence


def test_targets_context_sources_methodology(client: TestClient) -> None:
    t = client.get("/api/targets").json()
    assert len(t["profiles"]) >= 11 and t["ventilation"]["min_cm_s"] == pytest.approx(7.62)
    assert any(p["oxygen_percent"]["nominal"] is None for p in t["profiles"])
    c = client.get("/api/context").json()
    ids = {n["id"] for n in c["not_integrated"]}
    assert {"sofie-gel", "saffire-v", "saffire-vi"} <= ids
    assert c["ground_flammability"]
    # context experiments = every integrated_context record (Saffire-I/III from PSI plus transcribed
    # NTRS tables such as Saffire-IV-VI, the drop tower and DARTFire); never used for training
    assert c["context_experiments"] and all(not e["included_in_training"] for e in c["context_experiments"])
    assert {"PSI-98", "PSI-100"} <= {e["investigation_id"] for e in c["context_experiments"]}
    s = client.get("/api/sources").json()
    assert s["investigations"] and s["raw_files"] and s["atmosphere_sources"] and s["ground_data_sources"]
    assert all(p["title"] for p in s["publications"])
    m = client.get("/api/methodology").json()
    assert m["versions"]["dataset_version"] == config.dataset_version()
    assert m["versions"]["model_version"] is None or isinstance(m["versions"]["model_version"], str)
    assert m["config"]["pressure_length_scale_default"] == 0.3
    assert m["dates"]["data_retrieved"] == "2026-11-15"
    assert any("imbalanced" in x for x in m["limitations"])
    # D5: airflow provenance is computed from the data, never the old "borrowed calibrations" claim
    assert any(x.startswith("Airflow provenance: ") for x in m["limitations"])
    assert not any("borrowed fan and pot" in x for x in m["limitations"])


HEADLINE_DEFAULT_ORDER = [
    "iss_cabin_nominal",
    "artemis_surface_habitat_10p2_26p5",
    "exploration_atmosphere_8p2_34",
    "orion_cm_lunar_design_10p2",
    "orion_cm_14p7_o2_limit",
    "shuttle_nominal",
    "shuttle_staged_pre_eva",
    "skylab",
    "apollo_cm",
    "iss_materials_worst_case",
    "eawg_2006_8p0_32",
]


def test_headline(client: TestClient) -> None:
    h = models.HeadlineResponse.model_validate(client.get("/api/headline").json())
    by_id = {p.profile_id: p for p in h.profiles}
    iss, expl = by_id["iss_cabin_nominal"], by_id["exploration_atmosphere_8p2_34"]
    assert h.profiles[0].profile_id == "iss_cabin_nominal"
    assert iss.comparable_observations == sum(g.comparable_observations for g in iss.by_group) > 0
    assert expl.comparable_observations == 0 and expl.groups_with_comparable == 0
    env = h.envelope
    assert (
        env.n_steps > 0
        and env.oxygen_percent is not None
        and env.oxygen_percent[0] < 21 < env.oxygen_percent[1]
    )
    assert set(env.investigations) == {"BASS", "BASS-II"}
    # the earlier finding-strip behaviour with an explicit `profiles` list is unchanged
    extra = client.get("/api/headline", params={"profiles": "shuttle_nominal"}).json()
    assert [p["profile_id"] for p in extra["profiles"]] == [
        "iss_cabin_nominal",
        "exploration_atmosphere_8p2_34",
        "shuttle_nominal",
    ]
    assert extra["profiles"][2] == next(
        p.model_dump() for p in h.profiles if p.profile_id == "shuttle_nominal"
    )
    assert client.get("/api/headline", params={"profiles": "nope"}).status_code == 404
    assert client.get("/api/headline", params={"profiles": "nasa_std_3001_crew_envelope"}).status_code == 422


def test_headline_default_lists_every_operating_profile_in_display_order(client: TestClient) -> None:
    h = models.HeadlineResponse.model_validate(client.get("/api/headline").json())
    manifest = deps.profiles_manifest()["profiles"]
    operating = [
        p["profile_id"] for p in manifest if (p.get("kind") or "operating_point") == "operating_point"
    ]
    ids = [p.profile_id for p in h.profiles]
    assert set(ids) == set(operating) and len(ids) == len(set(ids))  # all of them, once, no envelope
    assert "nasa_std_3001_crew_envelope" not in ids
    listed = [pid for pid in HEADLINE_DEFAULT_ORDER if pid in operating]
    assert ids[: len(listed)] == listed  # the documented display order first
    assert ids[len(listed) :] == [pid for pid in operating if pid not in listed]  # others in manifest order
    for p in h.profiles:  # every card has its numbers: counts are consistent with the per-material rows
        assert p.n_groups == len(p.by_group) > 0 and p.n_target_points > 0
        assert p.comparable_observations == sum(g.comparable_observations for g in p.by_group)
        assert p.groups_with_comparable == sum(1 for g in p.by_group if g.comparable_observations > 0)
        assert p.groups_with_comparable <= p.n_groups


def test_headline_is_fast(client: TestClient) -> None:
    client.get("/api/headline")  # warm
    t0 = time.perf_counter()
    assert client.get("/api/headline").status_code == 200
    assert time.perf_counter() - t0 < 2.0


def test_non_finite_and_out_of_range_inputs_are_422(client: TestClient, group_ids: list[str]) -> None:
    g = group_ids[0]
    for q in (
        {"slice": "nan"},
        {"x_max": "inf"},
        {"x_min": -1e308, "x_max": 1e308},
        {"plane": "o2_pressure", "y_min": -50},
    ):
        r = client.get("/api/coverage", params={"group": g, **q})
        assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error", q


@pytest.mark.parametrize(
    ("plane", "default_slice", "ykey"),
    [("o2_flow", 101.3, "airflow_cm_s"), ("o2_pressure", 10.0, "pressure_kpa")],
)
def test_coverage_grids(
    client: TestClient, group_ids: list[str], plane: str, default_slice: float, ykey: str
) -> None:
    gid = group_ids[0]
    body = client.get("/api/coverage", params={"group": gid, "plane": plane}).json()
    models.CoverageResponse.model_validate(body)
    assert body["slice"]["value"] == default_slice and body["y"]["variable"] == ykey
    nx, ny = 61, 41
    assert len(body["x"]["values"]) == nx and len(body["y"]["values"]) == ny
    for key in ("nn_distance", "comparable_count", "inside_hull"):
        assert len(body[key]) == ny and all(len(row) == nx for row in body[key])
    assert body["x"]["values"][0] == 10 and body["x"]["values"][-1] == 40
    custom = client.get(
        "/api/coverage",
        params={"group": gid, "plane": plane, "nx": 5, "ny": 4, "slice": 50, "x_min": 15, "x_max": 25},
    ).json()
    assert len(custom["x"]["values"]) == 5 and len(custom["nn_distance"]) == 4
    assert custom["x"]["values"][0] == 15 and custom["slice"]["value"] == 50


def test_coverage_slice_membership_and_errors(client: TestClient, group_ids: list[str]) -> None:
    gid = group_ids[0]
    near = client.get("/api/coverage", params={"group": gid, "plane": "o2_flow", "slice": 101.3}).json()
    far = client.get("/api/coverage", params={"group": gid, "plane": "o2_flow", "slice": 30}).json()
    assert len(near["observations_in_slice"]) > 0 and far["observations_in_slice"] == []
    assert near["n_evidence_observations"] >= len(near["observations_in_slice"])
    far_cells = [v for row in far["nn_distance"] for v in row]
    assert min(v for v in far_cells if v is not None) > 1.0  # pressure far from all data: sparse everywhere
    r = client.get("/api/coverage", params={"group": gid, "plane": "bad"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"
    r = client.get("/api/coverage", params={"group": gid, "x_min": 30, "x_max": 20})
    assert r.status_code == 422


def test_degraded_without_dataset(fake_root: Any) -> None:
    deps.clear_caches()
    c = TestClient(create_app())
    r = c.get("/api/groups")
    assert r.status_code == 503 and r.json()["error"]["code"] == "artifact_missing"
    assert c.get("/api/methodology").status_code == 200
    assert c.get("/api/context").json()["context_experiments"] == []
    deps.clear_caches()


def test_performance_after_warmup(client: TestClient, group_ids: list[str]) -> None:
    paths = [
        "/api/groups",
        "/api/experiments",
        "/api/observations",
        "/api/targets",
        "/api/context",
        "/api/sources",
        "/api/methodology",
        f"/api/coverage?group={group_ids[0]}&plane=o2_flow",
        f"/api/coverage?group={group_ids[0]}&plane=o2_pressure",
    ]
    for p in paths:
        client.get(p)
    for p in paths:
        t0 = time.perf_counter()
        assert client.get(p).status_code == 200
        assert (time.perf_counter() - t0) < 0.3, p
