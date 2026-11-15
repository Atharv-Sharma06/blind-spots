"""Numbers that come from the analysis API (computed in-process with the same code that exports the snapshot).

Needs the analysis package on the path (run with `PYTHONPATH=src uv run python ...` from services/analysis).
Every value returned here is read from an API response; nothing is typed by hand.
"""

from __future__ import annotations

import math
import os
import warnings
from pathlib import Path
from typing import Any

EXPLORATION = "exploration_atmosphere_8p2_34"
ISS = "iss_cabin_nominal"
# Coverage reference scales (docs/CONTRACTS.md section 5; scientific-methodology.md section 4).
S_O2, S_FLOW, S_P = 2.0, 0.5, 0.1
P_REF_KPA = 101.325
REDUCED_PRESSURE_KPA = 90.0  # "below 1 atm" for the headline list (all integrated data are at 98-102 kPa)


def _client(root: Path) -> Any:
    os.environ.setdefault("BLINDSPOTS_ROOT", str(root))
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        try:
            from blindspots.api.app import create_app
            from fastapi.testclient import TestClient
        except ImportError as exc:  # pragma: no cover - environment problem, explained to the user
            raise SystemExit(
                "docs/_gen needs the analysis package: run it as\n"
                "  cd services/analysis && PYTHONPATH=src uv run python ../../docs/_gen/build.py --install\n"
                f"({exc})"
            ) from exc
        return TestClient(create_app())


def _ok(resp: Any, what: str) -> Any:
    if resp.status_code != 200:
        raise SystemExit(f"{what} returned HTTP {resp.status_code}: {resp.text[:300]}")
    return resp.json()


def _bound(r: dict | None) -> float | None:
    if not r:
        return None
    for k in ("nominal", "max", "min"):
        if r.get(k) is not None:
            return float(r[k])
    return None


def _target_distance(c: dict, target: dict) -> float:
    """Standardized distance of a candidate from the target's nominal O2 / pressure and airflow band."""
    o2 = _bound(target.get("oxygen_percent"))
    p = _bound(target.get("total_pressure_kpa"))
    band = target.get("airflow_cm_s") or {}
    d2 = 0.0
    if o2 is not None:
        d2 += ((c["oxygen_percent"] - o2) / S_O2) ** 2
    if p is not None:
        d2 += ((math.log(c["pressure_kpa"] / P_REF_KPA) - math.log(p / P_REF_KPA)) / S_P) ** 2
    lo, hi = band.get("min"), band.get("max")
    u = math.log1p(c["airflow_cm_s"])
    if lo is not None and u < math.log1p(lo):
        d2 += ((math.log1p(lo) - u) / S_FLOW) ** 2
    if hi is not None and u > math.log1p(hi):
        d2 += ((u - math.log1p(hi)) / S_FLOW) ** 2
    return math.sqrt(d2)


def _points_supported(a: dict) -> int | None:
    """Target points individually supported (D2 field), when the API reports it."""
    for src in (a, a.get("coverage") or {}, a.get("model") or {}):
        for key in ("points_supported", "n_points_supported"):
            if isinstance(src.get(key), int):
                return int(src[key])
    vc = a.get("verdict_counts") or (a.get("coverage") or {}).get("verdict_counts")
    if isinstance(vc, dict) and isinstance(vc.get("supported"), int):
        return int(vc["supported"])
    return None


def compute(root: Path) -> dict:
    c = _client(root)
    groups = _ok(c.get("/api/groups"), "GET /api/groups")
    targets = _ok(c.get("/api/targets"), "GET /api/targets")
    profiles = targets["profiles"] if isinstance(targets, dict) else targets
    analysed = [p for p in profiles if p.get("kind") != "envelope"]
    default = next((g for g in groups if g.get("is_default")), None)
    if default is None:
        raise SystemExit("GET /api/groups returned no is_default group")

    per_profile: dict[str, dict] = {}
    assess: dict[tuple[str, str], dict] = {}
    for p in analysed:
        pid = p["profile_id"]
        agg = {"comparable": 0, "pts_with": 0, "pts": 0, "nn": [], "verdicts": {}, "label": p.get("label")}
        for g in groups:
            body = {"group_id": g["group_id"], "target": {"profile_id": pid}}
            a = _ok(c.post("/api/target/assess", json=body), f"assess {g['group_id']} x {pid}")
            assess[(g["group_id"], pid)] = a
            cov = a["coverage"]
            agg["comparable"] += cov["comparable_observations"]
            agg["pts_with"] += cov["points_with_comparable"]
            agg["pts"] += cov["n_target_points"]
            if cov.get("nn_distance_min") is not None:
                agg["nn"].append(cov["nn_distance_min"])
            agg["verdicts"][a["verdict"]] = agg["verdicts"].get(a["verdict"], 0) + 1
            agg["target"] = a["target"]
        agg["label"] = agg["label"] or p.get("name") or agg["target"].get("label") or pid
        agg["groups_with"] = sum(
            1 for g in groups if assess[(g["group_id"], pid)]["coverage"]["comparable_observations"] > 0
        )
        per_profile[pid] = agg

    X: dict[str, Any] = {}
    X["H_N_GROUPS"] = len(groups)
    X["H_N_PROFILES_ANALYSED"] = len(analysed)
    for key, pid in (("ISS", ISS), ("EXPL", EXPLORATION)):
        agg = per_profile[pid]
        X[f"H_{key}_LABEL"] = agg["label"]
        X[f"H_{key}_COMPARABLE"] = agg["comparable"]
        X[f"H_{key}_GROUPS_WITH"] = sum(
            1 for g in groups if assess[(g["group_id"], pid)]["coverage"]["comparable_observations"] > 0
        )
        X[f"H_{key}_NN_MIN"] = f"{min(agg['nn']):.1f}"
        X[f"H_{key}_NN_MAX"] = f"{max(agg['nn']):.1f}"

    # profiles with no comparable observation in any group
    zero = [pid for pid, a in per_profile.items() if a["comparable"] == 0]
    reduced = [
        pid
        for pid, a in per_profile.items()
        if (_bound(a["target"].get("total_pressure_kpa")) or P_REF_KPA) < REDUCED_PRESSURE_KPA
    ]
    X["H_N_ZERO"] = len(zero)
    X["H_N_REDUCED"] = len(reduced)
    X["H_N_REDUCED_ZERO"] = sum(1 for pid in reduced if pid in zero)
    X["H_REDUCED_ALL_ZERO"] = bool(reduced) and all(pid in zero for pid in reduced)
    X["H_REDUCED_LIST"] = "; ".join(per_profile[pid]["label"] for pid in reduced)
    X["H_ZERO_AT_1ATM_LIST"] = "; ".join(per_profile[pid]["label"] for pid in zero if pid not in reduced)
    X["H_PROFILE_TABLE"] = _profile_table(per_profile, groups)

    # default group
    gid = default["group_id"]
    X["DG_ID"] = gid
    X["DG_LABEL"] = default["label"]
    X["DG_N_EXP"] = default["n_experiments"]
    X["DG_N_OBS"] = default["n_observations"]
    X["DG_N_TRAIN"] = default["n_training"]
    lc = default.get("label_counts") or {}
    X["DG_TRAIN_POS"] = lc.get("sustained", lc.get("1"))
    X["DG_TRAIN_NEG"] = lc.get("not_sustained", lc.get("0"))
    for key, pid in (("DX", EXPLORATION), ("DI", ISS)):
        a = assess[(gid, pid)]
        cov = a["coverage"]
        X[f"{key}_PTS_WITH"] = cov["points_with_comparable"]
        X[f"{key}_NPTS"] = cov["n_target_points"]
        X[f"{key}_COMPARABLE"] = cov["comparable_observations"]
        X[f"{key}_NN"] = f"{cov['nn_distance_min']:.1f}" if cov.get("nn_distance_min") is not None else "n/a"
        X[f"{key}_INSIDE"] = f"{100 * (cov.get('fraction_inside_hull') or 0):.0f}%"
        X[f"{key}_VERDICT"] = a["verdict"].replace("_", " ")
        sup = _points_supported(a)
        X[f"{key}_SUPPORTED"] = "n/a" if sup is None else sup

    # top-ranked candidate for the default group and the exploration atmosphere
    rank_body = {
        "assumptions": {"pressure_length_scale": 0.3},
        "group_id": gid,
        "k": 3,
        "target": {"profile_id": EXPLORATION},
    }
    r = _ok(c.post("/api/candidates/rank", json=rank_body), "POST /api/candidates/rank")
    top = r["candidates"][0]
    X["TC_O2"] = f"{top['oxygen_percent']:.1f}"
    X["TC_P"] = f"{top['pressure_kpa']:.1f}"
    X["TC_U"] = f"{top['airflow_cm_s']:.2f}"
    X["TC_EVR"] = f"{100 * top['evr_fraction']:.1f}%"
    X["TC_DIST_TO_TARGET"] = f"{_target_distance(top, per_profile[EXPLORATION]['target']):.2f}"
    X["TC_AT_TARGET"] = _target_distance(top, per_profile[EXPLORATION]["target"]) <= 1.0
    X["TC_N_CAND"] = len(r["candidates"])
    same_pos = all(
        abs(x["oxygen_percent"] - top["oxygen_percent"]) < 1e-9
        and abs(x["pressure_kpa"] - top["pressure_kpa"]) < 1e-9
        for x in r["candidates"]
    )
    X["TC_SAME_O2_P"] = same_pos
    X["TC_FLOWS"] = ", ".join(f"{x['airflow_cm_s']:.2f}" for x in r["candidates"])
    b = r.get("baselines") or {}

    def bev(name: str) -> str:
        x = b.get(name)
        return "n/a" if not x or x.get("evr_fraction") is None else f"{100 * x['evr_fraction']:.1f}%"

    X["TB_RANDOM"] = bev("random")
    X["TB_UNC"] = bev("uncertainty_sampling")
    X["TB_GAP"] = bev("nearest_gap")
    sens = r.get("sensitivity") or []
    X["TC_SENS_SAME"] = bool(sens) and all(
        abs(s["top_candidate"]["oxygen_percent"] - top["oxygen_percent"]) < 1e-9
        and abs(s["top_candidate"]["pressure_kpa"] - top["pressure_kpa"]) < 1e-9
        and abs(s["top_candidate"]["airflow_cm_s"] - top["airflow_cm_s"]) < 1e-9
        for s in sens
    )
    X["TC_SENS_LPS"] = " / ".join(f"{s['pressure_length_scale']:g}" for s in sens)
    return X


def _profile_table(per_profile: dict, groups: list) -> str:
    rows = [
        "| documented atmosphere | O2 % | pressure kPa | comparable observations (sum over groups) | "
        "groups with any | nearest (reference distances) |",
        "|---|---|---|---|---|---|",
    ]
    for _pid, a in per_profile.items():
        t = a["target"]
        o2 = _bound(t.get("oxygen_percent"))
        p = _bound(t.get("total_pressure_kpa"))
        n_with = a["groups_with"]
        rows.append(
            f"| {a['label']} | {o2:g} | {p:.1f} | {a['comparable']} | "
            f"{'n/a' if n_with is None else n_with} | {min(a['nn']):.1f} to {max(a['nn']):.1f} |"
        )
    return "\n".join(rows)
