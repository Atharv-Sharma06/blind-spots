"""Model-backed endpoints against the real trained models (skipped when artifacts are missing)."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import numpy as np
import pytest
from fastapi.testclient import TestClient

from blindspots import config
from blindspots.api import deps, models
from blindspots.api.app import create_app
from blindspots.api.routes_model import clear_memo
from blindspots.api.services import modeling
from blindspots.coverage.coverage import to_coords
from blindspots.uncertainty.explanations import explain_point

pytestmark = pytest.mark.skipif(
    not (config.NORMALIZED_DIR / "experiments.json").is_file()
    or config.dataset_version() is None
    or config.model_version() is None
    or not (config.MODELS_DIR / (config.model_version() or "-") / "manifest.json").is_file(),
    reason="dataset or trained models not built",
)

FORBIDDEN_FEASIBILITY = ("feasible", "safe", "approved", "certified")
# Operational phrasing that must never appear. The mandated disclaimer itself contains the words
# "safety procedures", so only operational phrases are denied here.
BRIEF_DENYLIST = ("ignite the", "step 1", "test procedure", "operating procedure", "ignition procedure")


@pytest.fixture(scope="module")
def client() -> TestClient:
    deps.clear_caches()
    clear_memo()
    return TestClient(create_app())


@pytest.fixture(scope="module")
def groups(client: TestClient) -> list[dict[str, Any]]:
    return client.get("/api/groups").json()


@pytest.fixture(scope="module")
def gid(groups: list[dict[str, Any]]) -> str:
    modelled = [g for g in groups if g["model_status"] == "modeled"]
    assert modelled
    for g in modelled:
        if g["group_id"] == "pmma_rod__stagnation":
            return str(g["group_id"])
    return str(max(modelled, key=lambda g: g["n_training"])["group_id"])


@pytest.fixture(scope="module")
def unmodelled(groups: list[dict[str, Any]]) -> str:
    g = next((g for g in groups if g["model_status"] != "modeled"), None)
    if g is None:
        pytest.skip("every group is modelled")
    return str(g["group_id"])


ISS = {"profile_id": "iss_cabin_nominal"}
EXPLORATION = {"profile_id": "exploration_atmosphere_8p2_34"}
FAR = {
    "custom": {
        "label": "x",
        "oxygen_percent": {"nominal": 34.0, "min": None, "max": None},
        "total_pressure_kpa": {"nominal": 56.5, "min": None, "max": None},
        "airflow_cm_s": None,
    }
}


def pick(c: dict[str, Any]) -> dict[str, float]:
    return {k: c[k] for k in ("oxygen_percent", "airflow_cm_s", "pressure_kpa")}


def post(client: TestClient, path: str, body: dict[str, Any]) -> Any:
    r = client.post(path, json=body)
    assert r.status_code == 200, r.text
    return r.json()


# --- surface / predict -----------------------------------------------------------------------------


def test_surface_modeled_and_unmodelled(client: TestClient, gid: str, unmodelled: str) -> None:
    for plane in ("o2_flow", "o2_pressure"):
        body = client.get("/api/surface", params={"group": gid, "plane": plane, "nx": 11, "ny": 7}).json()
        s = models.SurfaceResponse.model_validate(body)
        assert s.model_status == "modeled" and s.p_sustained is not None
        assert len(s.p_sustained) == 7 and len(s.p_sustained[0]) == 11
        assert s.verdict is not None and {v for row in s.verdict for v in row} <= {
            "supported",
            "extrapolation",
            "insufficient_evidence",
        }
        flat = [v for row in s.p_sustained for v in row]
        assert all(v is not None and 0 <= v <= 1 for v in flat)
    cov = client.get("/api/coverage", params={"group": gid, "nx": 11, "ny": 7}).json()
    surf = client.get("/api/surface", params={"group": gid, "nx": 11, "ny": 7}).json()
    assert cov["x"] == surf["x"] and cov["y"] == surf["y"]
    body = client.get("/api/surface", params={"group": unmodelled}).json()
    s = models.SurfaceResponse.model_validate(body)
    assert s.model_status == "insufficient_data" and s.p_sustained is None and s.verdict is None
    assert client.get("/api/surface", params={"group": "nope__nope"}).status_code == 404


def test_predict(client: TestClient, gid: str, unmodelled: str) -> None:
    pts = [
        {"oxygen_percent": 21.0, "airflow_cm_s": 5.0, "pressure_kpa": 101.3},
        {"oxygen_percent": 35.0, "airflow_cm_s": 1.0, "pressure_kpa": 56.5},
    ]
    r = models.PredictResponse.model_validate(post(client, "/api/predict", {"group_id": gid, "points": pts}))
    assert len(r.predictions) == 2
    near, far = r.predictions
    assert near.p_sustained is not None and 0 <= near.p_sustained <= 1
    assert far.verdict in ("extrapolation", "insufficient_evidence")
    assert far.latent_std_ratio is not None and near.latent_std_ratio is not None
    assert far.latent_std_ratio > near.latent_std_ratio
    assert {x.code for x in far.reasons} & {"outside_hull", "sparse_observations", "unobserved_pressure"}
    r = models.PredictResponse.model_validate(
        post(client, "/api/predict", {"group_id": unmodelled, "points": pts[:1]})
    )
    assert r.predictions[0].p_sustained is None and r.predictions[0].reasons[0].code == "no_model"
    bad = client.post(
        "/api/predict",
        json={"group_id": gid, "points": [{"oxygen_percent": 21, "airflow_cm_s": 1, "pressure_kpa": -1}]},
    )
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "validation_error"


def test_vectorised_explanations_match_reference(gid: str) -> None:
    gm = modeling.group_model(gid)
    assert gm is not None and gm.model is not None
    obs = modeling.evidence_coords(gm.model)
    pts = to_coords([21.0, 30.0, 17.0], [101.3, 56.5, 101.3], [5.0, 1.0, 0.5])
    a = modeling.assess_points(gm.model, pts)
    ev = modeling.explain_points(pts, obs, a["ratio"], a["aleatoric"], a["total"])
    for i in range(3):
        ref = explain_point(
            pts[i],
            obs,
            latent_std_ratio=float(a["ratio"][i]),
            aleatoric=float(a["aleatoric"][i]),
            total=float(a["total"][i]),
        )
        assert ev["verdict"][i] == ref["verdict"]
        assert [r["code"] for r in ev["reasons"][i]] == [r["code"] for r in ref["reasons"]]


# --- target assessment -----------------------------------------------------------------------------


def test_assess_schema_and_context_wording(client: TestClient, gid: str) -> None:
    body = post(client, "/api/target/assess", {"group_id": gid, "target": EXPLORATION})
    r = models.AssessResponse.model_validate(body)
    assert r.verdict in ("extrapolation", "insufficient_evidence")
    assert r.target.airflow_band_source == "ventilation_standard_with_near_quiescent_extension"
    assert r.target.airflow_cm_s.min == 0.5 and r.target.airflow_cm_s.max == 60.96
    assert r.coverage.n_target_points > 0 and r.model.model_status == "modeled"
    ids = {d.id for d in r.documented_context}
    assert "sofie-gel" in ids
    assert "not represented in the integrated records" in r.summary
    assert "SoFIE-GEL" in r.summary
    assert "not studied" not in r.summary.lower()
    iss = models.AssessResponse.model_validate(
        post(client, "/api/target/assess", {"group_id": gid, "target": ISS})
    )
    assert iss.coverage.nearest_observations


def test_assess_unmodelled_group(client: TestClient, unmodelled: str) -> None:
    r = models.AssessResponse.model_validate(
        post(client, "/api/target/assess", {"group_id": unmodelled, "target": ISS})
    )
    assert r.model.model_status == "insufficient_data"
    assert r.verdict == "insufficient_evidence" and r.reasons[0].code == "no_model"


def test_far_custom_target(client: TestClient, gid: str) -> None:
    r = models.AssessResponse.model_validate(
        post(client, "/api/target/assess", {"group_id": gid, "target": FAR})
    )
    assert r.verdict in ("insufficient_evidence", "extrapolation")
    assert r.target.label == "User-selected hypothetical conditions"
    assert r.target.status == "user_hypothetical"
    assert r.coverage.points_with_comparable == 0


def test_profile_resolution_rules(client: TestClient, gid: str) -> None:
    # nominal O2 missing, upper bound documented: analysed at the bound and flagged
    t = post(
        client,
        "/api/target/assess",
        {"group_id": gid, "target": {"profile_id": "orion_cm_lunar_design_10p2"}},
    )
    assert "documented_upper_bound_used" in t["target"]["flags"]
    assert t["target"]["oxygen_percent"]["nominal"] == 30
    # envelope profiles are context only
    r = client.post(
        "/api/target/assess",
        json={"group_id": gid, "target": {"profile_id": "nasa_std_3001_crew_envelope"}},
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"
    r = client.post("/api/target/assess", json={"group_id": gid, "target": {"profile_id": "nope"}})
    assert r.status_code == 404
    r = client.post("/api/target/assess", json={"group_id": gid, "target": {}})
    assert r.status_code == 422


# --- candidates ------------------------------------------------------------------------------------


def rank(client: TestClient, gid: str, target: dict[str, Any], **kw: Any) -> dict[str, Any]:
    body = {"group_id": gid, "target": target, "k": 3, **kw}
    return models.RankResponse.model_validate(post(client, "/api/candidates/rank", body)).model_dump()


def test_rank_schema_and_content(client: TestClient, gid: str) -> None:
    r = rank(client, gid, EXPLORATION)
    assert r["status"] == "ok" and len(r["candidates"]) == 3
    assert [c["rank"] for c in r["candidates"]] == [1, 2, 3]
    for c in r["candidates"]:
        assert c["evr_fraction"] >= 0 and c["feasibility_status"] in (
            "within_demonstrated_envelope",
            "outside_demonstrated_envelope",
        )
        text = (c["feasibility_note"]).lower()
        assert not any(w in text for w in FORBIDDEN_FEASIBILITY)
        assert c["explanation"]
        for rs in c["reasons"]:
            assert rs["code"] in {
                "high_target_covariance",
                "high_candidate_uncertainty",
                "near_decision_boundary",
                "fills_coverage_gap",
                "assumption_dependent",
            }
    # greedy order: standalone EVR of the first pick is the maximum over the three
    assert r["candidates"][0]["evr_fraction"] >= max(c["evr_fraction"] for c in r["candidates"])
    assert set(r["baselines"]) == {"random", "uncertainty_sampling", "nearest_gap"}
    for b in r["baselines"].values():
        if b is not None:
            assert b["evr_fraction"] <= r["candidates"][0]["evr_fraction"] + 1e-9
    assert [s["pressure_length_scale"] for s in r["sensitivity"]] == [0.15, 0.3, 0.6]
    assert r["sensitivity"][1]["same_top_as_default"] is True
    assert r["assumptions"] and r["candidate_domain"]["oxygen_percent"] == [12.0, 40.0]
    assert "qualified scientific review" in r["disclaimer"]
    assert r["target"]["airflow_band_source"] == "ventilation_standard_with_near_quiescent_extension"
    assert any("fixed" in a and "0.3" in a for a in r["assumptions"])


def test_rank_deterministic_and_target_dependent(client: TestClient, gid: str) -> None:
    clear_memo()
    a = rank(client, gid, EXPLORATION)
    clear_memo()
    b = rank(client, gid, EXPLORATION)
    assert a == b
    far = rank(client, gid, FAR)
    iss = rank(client, gid, ISS)
    key = lambda r: [(c["oxygen_percent"], c["pressure_kpa"], c["airflow_cm_s"]) for c in r["candidates"]]  # noqa: E731
    assert key(iss) != key(a) or iss["target"] != a["target"]
    assert iss["target"]["oxygen_percent"] != a["target"]["oxygen_percent"]
    assert key(far) != key(iss)
    assert [c["evr_fraction"] for c in iss["candidates"]] != [c["evr_fraction"] for c in a["candidates"]]


def test_rank_pressure_assumption_changes_posterior(client: TestClient, gid: str) -> None:
    from blindspots.acquisition.evr import evr_fraction

    gm = modeling.group_model(gid)
    assert gm is not None
    target = to_coords([21.0], [101.3], [5.0])
    far = to_coords([21.0], [80.0], [5.0])
    values = [
        float(evr_fraction(modeling.model_for_lp(gm, lp), target, far)[0])
        for lp in modeling.PRESSURE_LS_SENSITIVITY
    ]
    assert len(set(round(v, 9) for v in values)) == 3  # the assumed pressure correlation matters off-1-atm
    a = rank(client, gid, EXPLORATION)
    b = rank(client, gid, EXPLORATION, assumptions={"pressure_length_scale": 0.6})
    assert any("0.6" in x for x in b["assumptions"]) and not any(
        "fixed at 0.6" in x for x in a["assumptions"]
    )
    r = client.post(
        "/api/candidates/rank",
        json={"group_id": gid, "target": ISS, "assumptions": {"pressure_length_scale": -1}},
    )
    assert r.status_code == 422
    assert (
        client.post("/api/candidates/rank", json={"group_id": gid, "target": ISS, "k": 99}).status_code == 422
    )


def test_rank_model_unavailable(client: TestClient, unmodelled: str) -> None:
    r = rank(client, unmodelled, ISS)
    assert r["status"] == "model_unavailable" and r["candidates"] == []
    assert "No model is available" in r["assumptions"][0]


def test_rank_related_investigations(client: TestClient, gid: str) -> None:
    r = rank(client, gid, EXPLORATION)
    related = [x for c in r["candidates"] for x in c["related_documented_investigations"]]
    assert related, "a 34 % O2 / 56.5 kPa candidate lies in documented not-integrated envelopes"
    assert all("Inside the documented test envelope of" in x["note"] for x in related)


def test_compare(client: TestClient, gid: str) -> None:
    top = rank(client, gid, EXPLORATION)["candidates"][0]
    a = pick(top)
    b = {"oxygen_percent": 20.0, "airflow_cm_s": 5.0, "pressure_kpa": 101.3}
    r = models.CompareResponse.model_validate(
        post(client, "/api/candidates/compare", {"group_id": gid, "target": EXPLORATION, "a": a, "b": b})
    )
    assert r.preferred in ("a", "b", "indistinguishable")
    assert r.both_evr_fraction >= max(r.a.evr_fraction, r.b.evr_fraction) - 1e-9
    same = models.CompareResponse.model_validate(
        post(client, "/api/candidates/compare", {"group_id": gid, "target": EXPLORATION, "a": a, "b": a})
    )
    assert same.preferred == "indistinguishable"


def test_counterfactual(client: TestClient, gid: str) -> None:
    top = rank(client, gid, EXPLORATION)["candidates"][0]
    body = {"group_id": gid, "target": EXPLORATION, "candidate": pick(top), "plane": None, "slice": None}
    r = models.CounterfactualResponse.model_validate(post(client, "/api/candidates/counterfactual", body))
    assert abs(sum(s.probability for s in r.scenarios) - 1.0) < 1e-9
    assert {s.outcome for s in r.scenarios} == {"sustained", "not_sustained"}
    assert all(s.surface is None for s in r.scenarios)
    assert 0 <= r.expected_variance_reduction_fraction <= 1
    assert "not experimental results" in r.note
    for plane, sl in (("o2_flow", 56.5), ("o2_pressure", 10.0)):
        r2 = models.CounterfactualResponse.model_validate(
            post(client, "/api/candidates/counterfactual", {**body, "plane": plane, "slice": sl})
        )
        surf = r2.scenarios[0].surface
        assert surf is not None and len(surf.p_sustained) == 41 and len(surf.p_sustained[0]) == 61
        assert abs(sum(s.probability for s in r2.scenarios) - 1.0) < 1e-9
    # observing the more probable outcome at a candidate cannot increase the expected variance
    assert r.current.target_latent_var >= min(s.target_latent_var for s in r.scenarios) - 1e-9


# --- model card / validation / brief ---------------------------------------------------------------


def test_model_metadata_and_validation(client: TestClient, gid: str, unmodelled: str) -> None:
    m = models.ModelMetadata.model_validate(client.get("/api/model/metadata", params={"group": gid}).json())
    assert m.group_id == gid and m.training.n_observations > 0 and m.hyperparameters["l_p"] == 0.3
    assert "l_p" in m.fixed_hyperparameters
    assert client.get("/api/model/metadata", params={"group": unmodelled}).status_code == 404
    v = models.ValidationReport.model_validate(client.get("/api/model/validation").json())
    assert any(g.group_id == gid for g in v.groups)
    g = next(g for g in v.groups if g.group_id == gid)
    assert {m.name for m in g.cv.models} >= {"gp", "majority_class"}


def test_brief(client: TestClient, gid: str) -> None:
    for cand in (None, pick(rank(client, gid, EXPLORATION)["candidates"][0])):
        r = models.BriefResponse.model_validate(
            post(client, "/api/brief", {"group_id": gid, "target": EXPLORATION, "candidate": cand})
        )
        text = r.markdown.lower()
        assert not any(p in text for p in BRIEF_DENYLIST)
        for h in ("## target", "## coverage", "## model", "## candidate research question", "## citations"):
            assert h in text
        assert "doi:" in text and "psi.nasa.gov" in text and "?" in r.sections.candidate
        assert "majority-class" in text and "95% ci" in text
        assert "not represented in the integrated records" in text
        assert "qualified scientific review" in text and "not endorsed or approved by nasa" in text
        assert r.dataset_version == config.dataset_version()


def test_brief_unmodelled_group(client: TestClient, unmodelled: str) -> None:
    r = models.BriefResponse.model_validate(
        post(client, "/api/brief", {"group_id": unmodelled, "target": ISS, "candidate": None})
    )
    assert "No candidate is available" in r.sections.candidate


def test_latency(client: TestClient, gid: str) -> None:
    rank(client, gid, ISS)  # warm registry / numpy
    clear_memo()
    t0 = time.perf_counter()
    r = rank(client, gid, {"profile_id": "iss_materials_worst_case"})
    assert time.perf_counter() - t0 < 1.5 and r["status"] == "ok"
    top = r["candidates"][0]
    for path, body in (
        ("/api/target/assess", {"group_id": gid, "target": EXPLORATION}),
        ("/api/candidates/compare", {"group_id": gid, "target": ISS, "a": pick(top), "b": pick(top)}),
        (
            "/api/candidates/counterfactual",
            {"group_id": gid, "target": ISS, "candidate": pick(top), "plane": "o2_flow", "slice": 101.3},
        ),
        ("/api/brief", {"group_id": gid, "target": ISS, "candidate": pick(top)}),
    ):
        clear_memo()
        t0 = time.perf_counter()
        post(client, path, body)
        assert time.perf_counter() - t0 < 0.5, path
    clear_memo()
    t0 = time.perf_counter()
    client.get("/api/surface", params={"group": gid})
    assert time.perf_counter() - t0 < 0.5


# --- snapshot export -------------------------------------------------------------------------------


def test_snapshot_export(tmp_path: Path, groups: list[dict[str, Any]]) -> None:
    from blindspots.pipeline import export_artifacts as ex

    manifest = ex.export(tmp_path)
    on_disk = json.loads((tmp_path / "manifest.json").read_text())
    assert on_disk["entries"] == manifest["entries"]
    assert on_disk["dataset_version"] == config.dataset_version()
    assert on_disk["model_version"] == config.model_version()
    assert set(on_disk["slices"]) == {"o2_flow", "o2_pressure"}
    entries = on_disk["entries"]
    profiles = [
        p["profile_id"]
        for p in deps.profiles_manifest()["profiles"]
        if str(p.get("kind") or "operating_point") == "operating_point"
    ]
    assert len(profiles) >= 10
    modelled = [g["group_id"] for g in groups if g["model_status"] == "modeled"]
    for pid in profiles:
        for g in modelled:
            t = {"profile_id": pid}
            assert ex.post_key("/api/target/assess", {"group_id": g, "target": t}) in entries
            assert (
                ex.post_key(
                    "/api/candidates/rank",
                    {"group_id": g, "target": t, "k": 3, "assumptions": {"pressure_length_scale": 0.3}},
                )
                in entries
            )
            assert ex.post_key("/api/brief", {"group_id": g, "target": t, "candidate": None}) in entries
    assert ex.get_key("/api/health") in entries and ex.get_key("/api/targets") in entries
    for g in modelled:
        for plane, values in on_disk["slices"].items():
            for s in values:
                assert ex.get_key("/api/surface", {"group": g, "plane": plane, "slice": s}) in entries
    assert all((tmp_path / rel).is_file() for rel in entries.values())
    key = ex.post_key("/api/target/assess", {"group_id": modelled[0], "target": {"profile_id": profiles[0]}})
    assert json.loads((tmp_path / entries[key]).read_text())["group_id"] == modelled[0]


def test_key_format() -> None:
    from blindspots.pipeline import export_artifacts as ex

    assert ex.get_key("/api/coverage", {"slice": 101.0, "group": "g", "plane": "o2_flow"}) == (
        "GET /api/coverage?group=g&plane=o2_flow&slice=101"
    )
    assert ex.post_key("/api/x", {"b": 1.0, "a": {"z": None, "y": [2.5]}}) == (
        'POST /api/x {"a":{"y":[2.5],"z":null},"b":1}'
    )
    assert np.isclose(sum(np.array([0.25, 0.75])), 1.0)


# --- review fixes: no base-rate estimates, uninformative ranks, input validation, bounded caches -----


def test_no_probability_estimate_when_unsupported(client: TestClient, gid: str) -> None:
    a = post(client, "/api/target/assess", {"group_id": gid, "target": EXPLORATION})
    if a["verdict"] == "insufficient_evidence":
        assert a["model"]["p_sustained_mean"] is None
        assert "Model estimate of P(sustained)" not in a["summary"]
    r = rank(client, gid, EXPLORATION)
    for c in [*r["candidates"], *[b for b in r["baselines"].values() if b]]:
        if c["nn_distance"] is not None and c["nn_distance"] > 1.0:
            assert c["p_sustained"] is None
            assert "the model estimates P(sustained)" not in c["explanation"]
        else:
            assert c["p_sustained"] is not None


def test_rank_flags_uninformative_candidates(client: TestClient, gid: str) -> None:
    custom = {
        "custom": {
            "label": "unreachable",
            "oxygen_percent": {"nominal": 90.0},
            "total_pressure_kpa": {"nominal": 30.0},
        }
    }
    r = rank(client, gid, custom)
    assert r["status"] in ("ok", "no_informative_candidates")
    if r["status"] == "ok":
        assert r["candidates"][0]["evr_fraction"] >= 1e-4
    else:
        assert r["candidates"] == [] and any("tie-breaking" in a for a in r["assumptions"])
    assert any("outside the candidate" in a for a in r["assumptions"])


def test_custom_target_rejects_one_sided_airflow(client: TestClient, gid: str) -> None:
    custom = {
        "custom": {
            "label": "x",
            "oxygen_percent": {"nominal": 21.0},
            "total_pressure_kpa": {"nominal": 101.3},
            "airflow_cm_s": {"min": 5.0},
        }
    }
    resp = client.post("/api/target/assess", json={"group_id": gid, "target": custom})
    assert resp.status_code == 422 and resp.json()["error"]["code"] == "validation_error"


def test_lp_model_cache_is_bounded(client: TestClient, gid: str) -> None:
    from blindspots.api.services import modeling

    gm = modeling.group_model(gid)
    assert gm is not None
    for i in range(modeling._LP_CACHE_MAX + 8):
        modeling.model_for_lp(gm, 0.51 + 0.01 * i)
    assert len(modeling._LP_CACHE) <= modeling._LP_CACHE_MAX
