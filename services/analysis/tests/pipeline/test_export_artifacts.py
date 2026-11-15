"""Fast checks of the snapshot exporter helpers (the full export runs in tests/api/test_routes_model.py)."""

from __future__ import annotations

import itertools
import json
from pathlib import Path

from blindspots.pipeline import export_artifacts as ex


def test_writer_names_files_by_content_and_prunes_strays(tmp_path: Path) -> None:
    w = ex.Writer(tmp_path)
    stray = w.files / "api-brief-056e9803c568 2.json"
    stray.write_text("{}")
    w.add("GET /api/a", '{"x":1}')
    w.add("GET /api/b", '{"x":1}')  # same bytes: one file
    w.add("GET /api/c", '{"x":2}')
    w.add("GET /api/c?alias=1", "", alias_of="GET /api/c")
    assert w.entries["GET /api/a"] == w.entries["GET /api/b"] != w.entries["GET /api/c"]
    assert w.entries["GET /api/c?alias=1"] == w.entries["GET /api/c"]
    assert all(" " not in r for r in w.entries.values())
    rel_before = w.entries["GET /api/c"]
    assert w.prune() == 1 and not stray.exists()
    assert sorted(f.name for f in w.files.iterdir()) == sorted({Path(r).name for r in w.entries.values()})
    # Re-export with changed bytes for the same key gets a new name (immutable caching stays correct).
    w2 = ex.Writer(tmp_path)
    w2.add("GET /api/c", '{"x":3}')
    assert w2.entries["GET /api/c"] != rel_before


def test_slices_are_deduplicated_to_documented_values() -> None:
    slices = ex.snapshot_slices()
    reps = ex.slice_representatives(slices)
    kept = ex.kept_slices(reps)
    documented = ex.documented_pressures()
    for plane, vals in kept.items():
        assert vals == sorted(set(vals))
        assert all(b - a > ex.SLICE_DEDUPE_KPA for a, b in itertools.pairwise(vals)), plane
        assert set(reps[plane]) == set(slices[plane])
    # A documented profile pressure is always kept as itself.
    assert documented <= set(kept["o2_flow"])


def test_x_domain_mirrors_web_rule() -> None:
    assert ex.x_domain_for({"nominal": 21.0}) is None
    assert ex.x_domain_for({"nominal": 40.0}) is None
    assert ex.x_domain_for({"nominal": 70.0}) == (10.0, 75.0)
    assert ex.x_domain_for({"nominal": 100.0}) == (10.0, 100.0)
    assert ex.x_domain_for({"nominal": None, "max": 42.0}) == (10.0, 50.0)


def test_experiment_path_matches_encode_uri_component() -> None:
    assert ex.experiment_path("PSI-98:SAFFIRE-I S2") == "/api/experiments/PSI-98%3ASAFFIRE-I%20S2"
    assert ex.experiment_path("PSI-26:85/117") == "/api/experiments/PSI-26%3A85%2F117"
    assert ex.experiment_path("a-b_c.d!~*'()") == "/api/experiments/a-b_c.d!~*'()"


def test_snap_ties_to_first() -> None:
    assert ex.snap([1.0, 3.0, 10.0, 20.0], 2.0) == 1.0
    assert ex.snap([1.0, 3.0, 10.0, 20.0], 13.0) == 10.0


def test_key_format_round_trip() -> None:
    assert ex.get_key(
        "/api/coverage", {"slice": 34.474, "group": "g", "plane": "o2_flow", "x_min": 10.0, "x_max": 75.0}
    ) == ("GET /api/coverage?group=g&plane=o2_flow&slice=34.474&x_max=75&x_min=10")
    body = {"group_id": "g", "target": {"profile_id": "p"}, "candidate": None}
    assert json.loads(ex.post_key("/api/brief", body).split(" ", 2)[2]) == body


def test_discovery_exports_parameterless_get_routes(tmp_path: Path) -> None:
    e = ex.Exporter(tmp_path)
    schema_paths = e.client.app.openapi()["paths"]  # type: ignore[attr-defined]
    live_only = ex.export_discovered(e, [], [])
    for path, ops in schema_paths.items():
        get = ops.get("get")
        if get is None or "{" in path:
            continue
        required = [q for q in get.get("parameters", []) if q.get("in") == "query" and q.get("required")]
        if not required:
            assert f"GET {path}" in e.w.entries or f"GET {path}" in live_only, path
    if "/api/headline" in schema_paths:
        assert "GET /api/headline" in e.w.entries
