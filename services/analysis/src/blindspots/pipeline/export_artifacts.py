"""Static snapshot export (docs/API.md "Static snapshot").

Runs the real FastAPI app in-process (so snapshot responses are byte-for-byte what the live service
returns) and writes every response to ``<dir>/files`` plus ``manifest.json`` mapping request keys to files.
Key format: ``GET /api/<path>[?k=v&...sorted]`` and ``POST /api/<path> <canonical JSON body>``.
"""

from __future__ import annotations

import hashlib
import itertools
import json
import math
import os
import re
import shutil
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote

from fastapi.testclient import TestClient

from blindspots import config
from blindspots.api import deps
from blindspots.api import models as api_models
from blindspots.api.app import create_app
from blindspots.api.routes_data import DEFAULT_AXES
from blindspots.api.services import modeling

DEFAULT_SNAPSHOT_DIR = config.REPO_ROOT / "apps" / "web" / "public" / "snapshot"
O2_FLOW_BASE_SLICES = [101.3, 70.3, 56.5, 34.5]
O2_PRESSURE_SLICES = [1.0, 3.0, 10.0, 20.0]
PLANES = ("o2_flow", "o2_pressure")
COUNTERFACTUAL_O2_PRESSURE_SLICE = 10.0
RANK_K = 3
LP_DEFAULT = 0.3
GRID_DECIMALS = 4


def num(x: float) -> str:
    """JS-style number text: integral values without a trailing .0."""
    return str(int(x)) if float(x) == int(x) else repr(float(x))


def _norm(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _norm(v) for k, v in obj.items()}
    if isinstance(obj, list | tuple):
        return [_norm(v) for v in obj]
    if isinstance(obj, float) and obj == int(obj) and abs(obj) < 1e15:
        return int(obj)
    return obj


def canonical(obj: Any) -> str:
    return json.dumps(_norm(obj), sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def get_key(path: str, query: dict[str, Any] | None = None) -> str:
    pairs = []
    for k in sorted(query or {}):
        v = (query or {})[k]
        if v is None or v == "":
            continue
        pairs.append(f"{k}={num(v) if isinstance(v, float) else v}")
    return f"GET {path}" + (f"?{'&'.join(pairs)}" if pairs else "")


def post_key(path: str, body: dict[str, Any]) -> str:
    return f"POST {path} {canonical(body)}"


SIG_DIGITS = 4
SLICE_DEDUPE_KPA = 1.0


def _sig(x: float, nd: int = SIG_DIGITS) -> float:
    if x == 0 or x != x or x in (float("inf"), float("-inf")):
        return x
    return float(f"{x:.{nd}g}")


def round_floats(obj: Any, nd: int = SIG_DIGITS) -> Any:
    """Round every float to ``nd`` significant digits (keeps the snapshot small; display never needs more)."""
    if isinstance(obj, float):
        return _sig(obj, nd)
    if isinstance(obj, list):
        return [round_floats(v, nd) for v in obj]
    if isinstance(obj, dict):
        return {k: round_floats(v, nd) for k, v in obj.items()}
    return obj


class Writer:
    """Content-addressed files: ``files/<slug>-<sha1(content)[:12]>.<ext>``.

    A file name never carries different bytes across exports (safe for immutable HTTP caching), unchanged
    files are not rewritten, and ``prune`` removes everything the manifest does not reference (stale exports,
    iCloud/Finder conflict copies such as ``name 2.json``).
    """

    def __init__(self, out: Path) -> None:
        self.out = out
        self.files = out / "files"
        self.entries: dict[str, str] = {}
        self.bytes = 0
        self.by_content: dict[str, str] = {}
        self.rel_digest: dict[str, str] = {}
        self.files.mkdir(parents=True, exist_ok=True)

    def add(self, key: str, text: str, ext: str = "json", alias_of: str | None = None) -> None:
        if alias_of is not None:
            self.entries[key] = self.entries[alias_of]
            return
        data = text.encode("utf-8")
        digest_c = hashlib.sha1(data).hexdigest()
        rel = self.by_content.get(digest_c)
        if rel is None:
            slug = re.sub(r"[^a-z0-9]+", "-", key.split(" ")[1].lower()).strip("-")[:40]
            rel = f"files/{slug}-{digest_c[:12]}.{ext}"
            if self.rel_digest.get(rel, digest_c) != digest_c:
                raise RuntimeError(f"snapshot file name collision: {rel}")
            path = self.out / rel
            if not (path.is_file() and path.read_bytes() == data):
                tmp = path.with_name(path.name + ".tmp")
                tmp.write_bytes(data)
                os.replace(tmp, path)
            self.by_content[digest_c] = rel
            self.rel_digest[rel] = digest_c
            self.bytes += len(data)
        self.entries[key] = rel

    def prune(self) -> int:
        """Deletes every file under files/ that no manifest entry references; returns the count."""
        keep = {Path(r).name for r in self.entries.values()}
        n = 0
        for f in self.files.iterdir():
            if f.name in keep:
                continue
            if f.is_dir():
                shutil.rmtree(f)
            else:
                f.unlink()
            n += 1
        return n


class Exporter:
    def __init__(self, out: Path) -> None:
        self.out = out
        self.client = TestClient(create_app(), raise_server_exceptions=True)
        self.w = Writer(out)

    def get(
        self, path: str, query: dict[str, Any] | None = None, rounded: bool = False, tolerant: bool = False
    ) -> Any:
        r = self.client.get(path, params={k: v for k, v in (query or {}).items() if v is not None})
        if r.status_code != 200:
            if tolerant:
                print(f"not exported: GET {path} {query} -> {r.status_code}", file=sys.stderr)
                return None
            raise RuntimeError(f"GET {path} {query} -> {r.status_code}: {r.text[:300]}")
        key = get_key(path, query)
        if r.headers.get("content-type", "").startswith("text/csv"):
            self.w.add(key, r.text, ext="csv")
            return None
        data = r.json()
        if rounded and path == "/api/coverage":
            data = {k: v for k, v in data.items() if k != "comparable_count"}  # never read by the web
        if rounded and path == "/api/surface":
            # Grids the web never reads from /api/surface (evidence layers come from /api/coverage).
            for k in ("epistemic", "aleatoric", "total", "inside_hull", "comparable_count", "nn_distance"):
                if k in data:
                    data[k] = None
        text = json.dumps(round_floats(data) if rounded else data, separators=(",", ":"), ensure_ascii=False)
        self.w.add(key, text)
        return data

    def post(self, path: str, body: dict[str, Any], aliases: list[dict[str, Any]] | None = None) -> Any:
        r = self.client.post(path, json=body)
        if r.status_code != 200:
            raise RuntimeError(f"POST {path} {canonical(body)[:200]} -> {r.status_code}: {r.text[:300]}")
        data = r.json()
        key = post_key(path, body)
        if path == "/api/candidates/counterfactual":
            data_out = round_floats(data)
            for sc in data_out.get("scenarios", []):
                # Hypothetical map rasters are display-only (hover, colour ramp): 2 decimals.
                if isinstance(sc.get("surface"), dict):
                    sc["surface"] = {
                        k: [[round(v, 2) for v in row] for row in arr]
                        if k in ("p_sustained", "latent_std_ratio")
                        else round_floats(arr)
                        for k, arr in sc["surface"].items()
                    }
        else:
            data_out = data
        self.w.add(key, json.dumps(data_out, separators=(",", ":"), ensure_ascii=False))
        for alt in aliases or []:
            self.w.add(post_key(path, alt), "", alias_of=key)
        return data


def operating_profiles() -> list[dict[str, Any]]:
    return [
        p
        for p in deps.profiles_manifest().get("profiles", [])
        if str(p.get("kind") or "operating_point") == "operating_point"
    ]


def anchor(r: dict[str, Any] | None) -> float | None:
    """Value the web analyses at: nominal, else max, else min (model.ts o2Anchor/pressureAnchor)."""
    r = r or {}
    for k in ("nominal", "max", "min"):
        if r.get(k) is not None:
            return float(r[k])
    return None


def documented_pressures() -> set[float]:
    out: set[float] = set()
    for p in deps.profiles_manifest().get("profiles", []):
        v = anchor(p.get("total_pressure_kpa"))
        if v is not None and str(p.get("kind") or "operating_point") == "operating_point":
            out.add(v)
    return out


def snapshot_slices() -> dict[str, list[float]]:
    pressures = {float(p) for p in O2_FLOW_BASE_SLICES} | documented_pressures()
    return {"o2_flow": sorted(pressures), "o2_pressure": list(O2_PRESSURE_SLICES)}


def slice_representatives(slices: dict[str, list[float]]) -> dict[str, dict[float, float]]:
    """Maps every slice to the one kept within SLICE_DEDUPE_KPA of it (a documented profile value wins)."""
    documented = documented_pressures()
    out: dict[str, dict[float, float]] = {}
    for plane, vals in slices.items():
        clusters: list[list[float]] = []
        for v in sorted(vals):
            if clusters and v - clusters[-1][0] <= SLICE_DEDUPE_KPA:
                clusters[-1].append(v)
            else:
                clusters.append([v])
        m: dict[float, float] = {}
        for c in clusters:
            r = next((v for v in c if v in documented), c[0])
            for v in c:
                m[v] = r
        out[plane] = m
    return out


def kept_slices(reps: dict[str, dict[float, float]]) -> dict[str, list[float]]:
    """The distinct slices the UI lists (manifest.slices); the merged ones stay resolvable as aliases."""
    return {plane: sorted(set(m.values())) for plane, m in reps.items()}


def snap(values: list[float], v: float) -> float:
    """Nearest value, ties to the first (lib/snapshot.ts snapSlice and the workspace slice sync)."""
    best = values[0]
    for x in values:
        if abs(x - v) < abs(best - v):
            best = x
    return best


def x_domain_for(o2: dict[str, Any] | None) -> tuple[float, float] | None:
    """Extended O2 axis for a target beyond the default axis (mirrors xDomainFor in explore/model.ts)."""
    x0, x1 = DEFAULT_AXES["o2_flow"]["x"]
    a = anchor(o2)
    if a is None or a <= x1:
        return None
    return (x0, float(min(100, math.ceil(a / 5) * 5 + 5)))


def pressure_plane_slice(assessed: dict[str, Any], values: list[float] | None = None) -> float:
    """The airflow slice the web selects on the O2 x pressure plane for this target (snapped).

    Mirrors targetSliceFor() in apps/web/components/explore/model.ts: nominal airflow, else the geometric
    mean of the band, snapped to the nearest exported slice.
    """
    flow = (assessed.get("target") or {}).get("airflow_cm_s") or {}
    v = flow.get("nominal")
    if v is None and flow.get("min") is not None and flow.get("max") is not None:
        v = (float(flow["min"]) * float(flow["max"])) ** 0.5
    if v is None:
        return COUNTERFACTUAL_O2_PRESSURE_SLICE
    return snap(values or list(O2_PRESSURE_SLICES), float(v))


def experiment_path(experiment_id: str) -> str:
    """The path the web requests: encodeURIComponent(id), so every key round-trips (no spaces in keys)."""
    return "/api/experiments/" + quote(experiment_id, safe="-_.!~*'()")


def point(c: dict[str, Any]) -> dict[str, Any]:
    return {k: c[k] for k in ("oxygen_percent", "airflow_cm_s", "pressure_kpa")}


def axes_query(domain: tuple[float, float] | None) -> dict[str, float]:
    return {} if domain is None else {"x_min": domain[0], "x_max": domain[1]}


def counterfactual_axes(domain: tuple[float, float] | None) -> dict[str, float]:
    """Axis fields for the counterfactual body, only when the API accepts them (same names as the grids)."""
    fields = api_models.CounterfactualRequest.model_fields
    return axes_query(domain) if "x_min" in fields and "x_max" in fields else {}


GROUP_PARAMS = ("group", "group_id")
TARGET_PARAMS = ("target", "profile", "profile_id")


def export_discovered(ex: Exporter, group_ids: list[str], profile_ids: list[str]) -> list[str]:
    """Exports every GET route not covered above (e.g. GET /api/headline) by introspecting the app's
    OpenAPI schema: without parameters, and per group / per profile when it takes such a parameter.
    Returns the endpoints that stay live-only."""
    done = {k.split(" ")[1].split("?")[0] for k in ex.w.entries}
    done_prefixes = ("/api/experiments/",)
    live_only: list[str] = []
    schema = ex.client.app.openapi()  # type: ignore[attr-defined]
    for path, ops in sorted(schema.get("paths", {}).items()):
        if not path.startswith("/api/"):
            continue
        for method in sorted(ops):
            if method != "get":
                if not any(k.startswith(f"{method.upper()} {path} ") for k in ex.w.entries):
                    live_only.append(f"{method.upper()} {path}")
                continue
            if path in done or "{" in path or path.startswith(done_prefixes):
                continue
            params = [q for q in ops[method].get("parameters", []) if q.get("in") == "query"]
            names = {q["name"]: bool(q.get("required")) for q in params}
            choices: dict[str, list[str]] = {}
            for n in names:
                if n in GROUP_PARAMS:
                    choices[n] = group_ids
                elif n in TARGET_PARAMS:
                    choices[n] = profile_ids
            required = {n for n, r in names.items() if r}
            if required - set(choices):
                live_only.append(f"GET {path}")
                continue
            n_ok = 0
            dims = list(choices)
            for size in range(len(dims) + 1):
                for subset in itertools.combinations(dims, size):
                    if not required <= set(subset):
                        continue
                    for values in itertools.product(*(choices[d] for d in subset)):
                        if ex.get(path, dict(zip(subset, values, strict=True)), tolerant=True) is not None:
                            n_ok += 1
            print(f"discovered GET {path}: {n_ok} responses exported", file=sys.stderr)
            if n_ok == 0:
                live_only.append(f"GET {path}")
    return sorted(set(live_only))


def export(out: Path) -> dict[str, Any]:
    out.mkdir(parents=True, exist_ok=True)
    ex = Exporter(out)
    store = deps.require_store()
    groups = ex.get("/api/groups")
    group_ids = [g["group_id"] for g in groups]
    modelled = [g["group_id"] for g in groups if g["model_status"] == "modeled"]
    health = ex.get("/api/health")
    for path in ("/api/investigations", "/api/targets", "/api/context", "/api/methodology", "/api/sources"):
        ex.get(path)
    experiments = ex.get("/api/experiments")
    ex.get("/api/observations")
    ex.get("/api/export/experiments.csv")
    for gid in group_ids:
        ex.get("/api/experiments", {"group": gid})
        ex.get("/api/observations", {"group": gid})
        ex.get("/api/export/experiments.csv", {"group": gid})
    # Groups that exist only on context records (e.g. Saffire `other__concurrent`) are table filters too.
    record_groups = sorted({e["group_id"] for e in experiments if e.get("group_id")})
    for gid in record_groups:
        if gid not in group_ids:
            ex.get("/api/experiments", {"group": gid})
            ex.get("/api/export/experiments.csv", {"group": gid})
    # The Experiments page CSV follows the investigation and group filters.
    for inv in sorted({e["investigation_id"] for e in experiments if e.get("investigation_id")}):
        ex.get("/api/export/experiments.csv", {"investigation": inv})
        for gid in sorted(
            {e["group_id"] for e in experiments if e.get("investigation_id") == inv and e.get("group_id")}
        ):
            ex.get("/api/export/experiments.csv", {"investigation": inv, "group": gid})
    for e in store.experiments:
        ex.get(experiment_path(e["experiment_id"]))
    if health["artifacts"]["validation"]:
        ex.get("/api/model/validation")
    for gid in modelled:
        ex.get("/api/model/metadata", {"group": gid})

    profiles = operating_profiles()
    slices = snapshot_slices()
    reps = slice_representatives(slices)
    kept = kept_slices(reps)
    x_domains = {
        p["profile_id"]: d for p in profiles if (d := x_domain_for(p.get("oxygen_percent"))) is not None
    }
    print(f"slices kept: {kept}; extended O2 axes: {x_domains}", file=sys.stderr)

    def grids(gid: str, plane: str, r: float, domain: tuple[float, float] | None) -> None:
        q = {"group": gid, "plane": plane, "slice": r, **axes_query(domain)}
        ex.get("/api/coverage", q, rounded=True)
        ex.get("/api/surface", q, rounded=True)
        # Merged neighbours and 0.1-rounded values resolve to the kept grid.
        alts = {s for s, v in reps[plane].items() if v == r and s != r}
        if round(r, 1) not in reps[plane]:
            alts.add(round(r, 1))
        for s in alts:
            for path in ("/api/coverage", "/api/surface"):
                ex.w.add(get_key(path, {**q, "slice": s}), "", alias_of=get_key(path, q))

    for gid in group_ids:
        for plane in PLANES:
            for r in kept[plane]:
                grids(gid, plane, r, None)

    skipped = {
        p["profile_id"]: "context-only envelope profile (not an analysis target)"
        for p in deps.profiles_manifest().get("profiles", [])
        if p not in profiles
    }
    n_rank = 0
    for p in profiles:
        pid = p["profile_id"]
        target = {"profile_id": pid}
        domain = x_domains.get(pid)
        p_anchor = anchor(p.get("total_pressure_kpa"))
        for gid in group_ids:
            assessed = ex.post("/api/target/assess", {"group_id": gid, "target": target})
            rank_body = {
                "group_id": gid,
                "target": target,
                "k": RANK_K,
                "assumptions": {"pressure_length_scale": LP_DEFAULT},
            }
            rank = ex.post(
                "/api/candidates/rank",
                rank_body,
                aliases=[
                    {"group_id": gid, "target": target, "k": RANK_K},
                    {"group_id": gid, "target": target},
                ],
            )
            n_rank += 1
            # Default brief (the API picks the top-ranked candidate and says so), for every group.
            ex.post("/api/brief", {"group_id": gid, "target": target, "candidate": None})
            plane_slice = {
                "o2_flow": snap(kept["o2_flow"], p_anchor if p_anchor is not None else 101.3),
                "o2_pressure": pressure_plane_slice(assessed, kept["o2_pressure"]),
            }
            if domain is not None:
                # Far target (Skylab, Apollo): grids at the extended O2 axis the web requests, at the slice
                # it selects for the target on each plane (other slices fall back to the default axis).
                for plane in PLANES:
                    grids(gid, plane, plane_slice[plane], domain)
            if gid not in modelled or rank.get("status") != "ok" or not rank.get("candidates"):
                continue
            points = [point(c) for c in rank["candidates"]]
            for pt in points:
                for plane in PLANES:
                    body = {
                        "group_id": gid,
                        "target": target,
                        "candidate": pt,
                        "plane": plane,
                        "slice": plane_slice[plane],
                        **counterfactual_axes(domain),
                    }
                    alt = [
                        {**body, "slice": s}
                        for s in {
                            round(plane_slice[plane], 1),
                            *(k for k, v in reps[plane].items() if v == plane_slice[plane]),
                        }
                        if s != plane_slice[plane]
                    ]
                    ex.post("/api/candidates/counterfactual", body, aliases=alt)
            # Compare sheet: every pair of ranked candidates, in both selection orders.
            for a, b in itertools.permutations(points, 2):
                ex.post("/api/candidates/compare", {"group_id": gid, "target": target, "a": a, "b": b})
            # Brief opened with the top candidate spelled out (guided demo end card).
            ex.post("/api/brief", {"group_id": gid, "target": target, "candidate": points[0]})
        print(f"profile {pid}: done", file=sys.stderr)

    live_only = export_discovered(ex, group_ids, [p["profile_id"] for p in profiles])
    manifest: dict[str, Any] = {
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dataset_version": config.dataset_version(),
        "model_version": modeling.full_registry().model_version if health["artifacts"]["models"] else None,
        "slices": kept,
        "x_domains": {pid: list(d) for pid, d in sorted(x_domains.items())},
        "profiles": [p["profile_id"] for p in profiles],
        "skipped_profiles": skipped,
        "modelled_groups": modelled,
        "live_only": live_only,
        "entries": dict(sorted(ex.w.entries.items())),
    }
    tmp = out / "manifest.json.tmp"
    tmp.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp, out / "manifest.json")
    removed = ex.w.prune()
    on_disk = sum(f.stat().st_size for f in ex.w.files.iterdir())
    print(
        f"snapshot: {len(ex.w.entries)} entries, {len(set(ex.w.entries.values()))} files, "
        f"{on_disk / 1e6:.1f} MB on disk ({removed} unreferenced files removed), {n_rank} rank requests, "
        f"live-only: {live_only} -> {out}",
        file=sys.stderr,
    )
    return manifest


def main(snapshot: Path | None = None) -> None:
    export((snapshot or DEFAULT_SNAPSHOT_DIR).resolve())


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else None)
