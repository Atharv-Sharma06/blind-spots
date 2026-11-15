"""Static snapshot export (docs/API.md "Static snapshot").

Runs the real FastAPI app in-process (so snapshot responses are byte-for-byte what the live service
returns) and writes every response to ``<dir>/files`` plus ``manifest.json`` mapping request keys to files.
Key format: ``GET /api/<path>[?k=v&...sorted]`` and ``POST /api/<path> <canonical JSON body>``.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from blindspots import config
from blindspots.api import deps
from blindspots.api.app import create_app
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
    def __init__(self, out: Path) -> None:
        self.out = out
        self.files = out / "files"
        self.entries: dict[str, str] = {}
        self.bytes = 0
        self.by_content: dict[str, str] = {}
        if self.files.exists():
            shutil.rmtree(self.files)
        self.files.mkdir(parents=True, exist_ok=True)

    def add(self, key: str, text: str, ext: str = "json", alias_of: str | None = None) -> None:
        if alias_of is not None:
            self.entries[key] = self.entries[alias_of]
            return
        digest_c = hashlib.sha1(text.encode()).hexdigest()
        if digest_c in self.by_content:
            self.entries[key] = self.by_content[digest_c]
            return
        slug = re.sub(r"[^a-z0-9]+", "-", key.split(" ")[1].lower()).strip("-")[:40]
        digest = hashlib.sha1(key.encode()).hexdigest()[:12]
        rel = f"files/{slug}-{digest}.{ext}"
        (self.out / rel).write_text(text, encoding="utf-8")
        self.entries[key] = rel
        self.by_content[digest_c] = rel
        self.bytes += len(text.encode())


class Exporter:
    def __init__(self, out: Path) -> None:
        self.out = out
        self.client = TestClient(create_app(), raise_server_exceptions=True)
        self.w = Writer(out)

    def get(self, path: str, query: dict[str, Any] | None = None, rounded: bool = False) -> Any:
        r = self.client.get(path, params={k: v for k, v in (query or {}).items() if v is not None})
        if r.status_code != 200:
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


def snapshot_slices() -> dict[str, list[float]]:
    pressures = {float(p) for p in O2_FLOW_BASE_SLICES}
    for p in deps.profiles_manifest().get("profiles", []):
        nominal = (p.get("total_pressure_kpa") or {}).get("nominal")
        if nominal is not None:
            pressures.add(float(nominal))
    return {"o2_flow": sorted(pressures), "o2_pressure": list(O2_PRESSURE_SLICES)}


def slice_representatives(slices: dict[str, list[float]]) -> dict[str, dict[float, float]]:
    """Maps every slice to the one kept within SLICE_DEDUPE_KPA of it (a documented profile value wins)."""
    documented: set[float] = set()
    for p in deps.profiles_manifest().get("profiles", []):
        nominal = (p.get("total_pressure_kpa") or {}).get("nominal")
        if nominal is not None:
            documented.add(float(nominal))
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


def pressure_plane_slice(assessed: dict[str, Any]) -> float:
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
    best = O2_PRESSURE_SLICES[0]
    for x in O2_PRESSURE_SLICES:
        if abs(x - v) < abs(best - v):
            best = x
    return best


def export(out: Path) -> dict[str, Any]:
    out.mkdir(parents=True, exist_ok=True)
    ex = Exporter(out)
    store = deps.require_store()
    groups = ex.get("/api/groups")
    modelled = [g["group_id"] for g in groups if g["model_status"] == "modeled"]
    health = ex.get("/api/health")
    for path in ("/api/investigations", "/api/targets", "/api/context", "/api/methodology", "/api/sources"):
        ex.get(path)
    ex.get("/api/experiments")
    ex.get("/api/observations")
    ex.get("/api/export/experiments.csv")
    for g in groups:
        gid = g["group_id"]
        ex.get("/api/experiments", {"group": gid})
        ex.get("/api/observations", {"group": gid})
        ex.get("/api/export/experiments.csv", {"group": gid})
    for e in store.experiments:
        ex.get(f"/api/experiments/{e['experiment_id']}")
    if health["artifacts"]["validation"]:
        ex.get("/api/model/validation")
    for gid in modelled:
        ex.get("/api/model/metadata", {"group": gid})

    slices = snapshot_slices()
    reps = slice_representatives(slices)
    print(
        f"coverage/surface slices: {slices} (kept: {sorted(set(reps['o2_flow'].values()))})", file=sys.stderr
    )
    for g in groups:
        gid = g["group_id"]
        for plane in PLANES:
            for r in sorted(set(reps[plane].values())):
                q = {"group": gid, "plane": plane, "slice": r}
                ex.get("/api/coverage", q, rounded=True)
                ex.get("/api/surface", q, rounded=True)
            for s, r in reps[plane].items():
                if s != r:
                    for path in ("/api/coverage", "/api/surface"):
                        q = {"group": gid, "plane": plane, "slice": r}
                        ex.w.add(get_key(path, {**q, "slice": s}), "", alias_of=get_key(path, q))

    profiles = operating_profiles()
    skipped = {
        p["profile_id"]: "context-only envelope profile (not an analysis target)"
        for p in deps.profiles_manifest().get("profiles", [])
        if p not in profiles
    }
    n_rank = 0
    for p in profiles:
        pid = p["profile_id"]
        target = {"profile_id": pid}
        nominal_p = float(p["total_pressure_kpa"]["nominal"])
        for g in groups:
            gid = g["group_id"]
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
            if gid not in modelled:
                continue
            if rank["status"] != "ok":
                # No informative/eligible candidate: the brief is still available without a candidate.
                ex.post("/api/brief", {"group_id": gid, "target": target, "candidate": None})
                continue
            # Size budget: the top candidate is exported on both planes; the others only on the plane that
            # shows the gap (O2 x pressure when the target pressure is outside the group's evidence).
            plane_slice = {"o2_flow": nominal_p, "o2_pressure": pressure_plane_slice(assessed)}
            relevant: str | None = None
            for ci, cand in enumerate(rank["candidates"]):
                point = {k: cand[k] for k in ("oxygen_percent", "airflow_cm_s", "pressure_kpa")}
                planes = ("o2_flow", "o2_pressure") if ci == 0 else (relevant,)
                for plane in planes:
                    cf = ex.post(
                        "/api/candidates/counterfactual",
                        {
                            "group_id": gid,
                            "target": target,
                            "candidate": point,
                            "plane": plane,
                            "slice": plane_slice[plane],
                        },
                    )
                    if ci == 0 and plane == "o2_flow":
                        relevant = "o2_flow" if cf.get("target_p_supported") else "o2_pressure"
            top = rank["candidates"][0]
            top_point = {k: top[k] for k in ("oxygen_percent", "airflow_cm_s", "pressure_kpa")}
            ex.post(
                "/api/brief",
                {"group_id": gid, "target": target, "candidate": top_point},
                aliases=[{"group_id": gid, "target": target, "candidate": None}],
            )
        print(f"profile {pid}: done", file=sys.stderr)
    manifest: dict[str, Any] = {
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dataset_version": config.dataset_version(),
        "model_version": modeling.full_registry().model_version if health["artifacts"]["models"] else None,
        "slices": slices,
        "profiles": [p["profile_id"] for p in profiles],
        "skipped_profiles": skipped,
        "modelled_groups": modelled,
        "entries": dict(sorted(ex.w.entries.items())),
    }
    (out / "manifest.json").write_text(
        json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(
        f"snapshot: {len(ex.w.entries)} entries, {len(set(ex.w.entries.values()))} files, "
        f"{ex.w.bytes / 1e6:.1f} MB, {n_rank} rank requests -> {out}",
        file=sys.stderr,
    )
    return manifest


def main(snapshot: Path | None = None) -> None:
    export((snapshot or DEFAULT_SNAPSHOT_DIR).resolve())


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else None)
