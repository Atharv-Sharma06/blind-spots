"""GET /api/findings: summarise, rank and interpret the integrated ISS fire-test records (pure function).

Every number is read from the observations, groups, target profiles and the GET /api/headline payload passed
in; nothing is invented. Only observations with ``included_in_training == true`` are counted. An observation
"kept burning" when its training ``label`` is 1 (flame_state ``sustained``) and "went out" when it is 0
(extinguished / brief flame without sustained spread), the same split as ``label_counts`` of GET /api/groups.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Any

RANKING_RULE = (
    "Materials are ranked by the lowest oxygen at which an ISS flame kept burning (lowest first). "
    "Ties: more supporting records first, then group_id."
)
PILLAR_RULE = (
    "prevention = which air keeps a flame burning; suppression = which air or airflow made it go out; "
    "detection = not represented in the integrated records."
)
# Fixed airflow bins (cm/s); the last bin is open-ended.
AIRFLOW_BINS: list[tuple[float, float | None]] = [
    (0.0, 2.0),
    (2.0, 5.0),
    (5.0, 10.0),
    (10.0, 20.0),
    (20.0, None),
]
# "About the same as" ISS cabin oxygen when within this many percentage points (documented in docs/API.md).
O2_SAME_TOLERANCE = 0.5
ISS_PROFILE = "iss_cabin_nominal"
# Documented lower-pressure exploration cabins for the pressure-gap sentence (pressures read from targets).
LOW_PRESSURE_PROFILES = ("exploration_atmosphere_8p2_34", "artemis_surface_habitat_10p2_26p5")
SEA_LEVEL_KPA = 101.325
DASH = "\u2013"
SIG_DIGITS = 4  # same as the snapshot exporter
MAX_IDS = 5


def _sig(x: float, nd: int = SIG_DIGITS) -> float:
    if x == 0 or x != x or x in (float("inf"), float("-inf")):
        return x
    return float(f"{x:.{nd}g}")


def _round(obj: Any) -> Any:
    if isinstance(obj, float):
        return _sig(obj)
    if isinstance(obj, list):
        return [_round(v) for v in obj]
    if isinstance(obj, dict):
        return {k: _round(v) for k, v in obj.items()}
    return obj


def fmt(x: float) -> str:
    """At most 3 significant digits, never scientific notation, no trailing zeros."""
    if abs(x) >= 1000:
        return str(round(x))
    s = f"{x:.3g}"
    if "e" in s:
        s = f"{x:.0f}"
    return s


def _sustained(o: dict[str, Any]) -> bool | None:
    label = o.get("label")
    if label is None:
        return None
    return bool(label)


def pressure_basis(o: dict[str, Any]) -> str:
    if o.get("total_pressure_kpa") is not None:
        return "measured"
    if o.get("pressure_for_analysis_kpa") is not None and "pressure_assumed" in (
        o.get("quality_flags") or []
    ):
        return "assumed"
    return "missing"


def _pressure(o: dict[str, Any]) -> float | None:
    basis = pressure_basis(o)
    if basis == "measured":
        return float(o["total_pressure_kpa"])
    if basis == "assumed":
        return float(o["pressure_for_analysis_kpa"])
    return None


def _ids(rows: Iterable[dict[str, Any]], key: str) -> list[str]:
    return sorted({str(r[key]) for r in rows if r.get(key) is not None})[:MAX_IDS]


def _point(rows_at_value: list[dict[str, Any]]) -> dict[str, Any]:
    """The extreme value plus its supporting rows; the representative row is the first by observation_id."""
    rows = sorted(rows_at_value, key=lambda r: str(r["observation_id"]))
    rep = rows[0]
    airflow = rep.get("airflow_cm_s")
    return {
        "oxygen_percent": float(rep["oxygen_percent"]),
        "airflow_cm_s": None if airflow is None else float(airflow),
        "pressure_kpa": _pressure(rep),
        "pressure_basis": pressure_basis(rep),
        "o2_basis": "interpolated" if "o2_interpolated" in (rep.get("quality_flags") or []) else "measured",
        "n_at_value": len(rows),
        "observation_ids": _ids(rows, "observation_id"),
        "experiment_ids": _ids(rows, "experiment_id"),
    }


def _extreme(rows: list[dict[str, Any]], burning: bool, lowest: bool) -> dict[str, Any] | None:
    pool = [r for r in rows if _sustained(r) is burning and r.get("oxygen_percent") is not None]
    if not pool:
        return None
    vals = [float(r["oxygen_percent"]) for r in pool]
    target = min(vals) if lowest else max(vals)
    return _point([r for r in pool if float(r["oxygen_percent"]) == target])


def _bin_label(lo: float, hi: float | None) -> str:
    return f"{fmt(lo)}+" if hi is None else f"{fmt(lo)}{DASH}{fmt(hi)}"


def airflow_bins(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    out = []
    missing = sum(1 for r in rows if r.get("airflow_cm_s") is None)
    for lo, hi in AIRFLOW_BINS:
        in_bin = [
            r
            for r in rows
            if r.get("airflow_cm_s") is not None
            and float(r["airflow_cm_s"]) >= lo
            and (hi is None or float(r["airflow_cm_s"]) < hi)
        ]
        burning = [
            float(r["oxygen_percent"])
            for r in in_bin
            if _sustained(r) and r.get("oxygen_percent") is not None
        ]
        out.append(
            {
                "lo": lo,
                "hi": hi,
                "n": len(in_bin),
                "n_sustained": sum(1 for r in in_bin if _sustained(r)),
                "lowest_o2_burning": min(burning) if burning else None,
            }
        )
    return out, missing


def _span(vals: Sequence[float]) -> list[float] | None:
    return [min(vals), max(vals)] if vals else None


def tested_ranges(rows: list[dict[str, Any]]) -> dict[str, Any]:
    o2 = [float(r["oxygen_percent"]) for r in rows if r.get("oxygen_percent") is not None]
    flow = [float(r["airflow_cm_s"]) for r in rows if r.get("airflow_cm_s") is not None]
    pressures = [p for p in (_pressure(r) for r in rows) if p is not None]
    bases = {pressure_basis(r) for r in rows}
    basis = next(iter(bases)) if len(bases) == 1 and "missing" not in bases else "mixed"
    return {
        "oxygen_percent": _span(o2),
        "airflow_cm_s": _span(flow),
        "pressure_kpa": _span(pressures),
        "pressure_basis": basis,
    }


def _profile(targets: dict[str, Any], pid: str) -> dict[str, Any] | None:
    for p in targets.get("profiles") or []:
        if p.get("profile_id") == pid:
            return dict(p)
    return None


def _nominal(profile: dict[str, Any] | None, field: str) -> float | None:
    if not profile:
        return None
    v = profile.get(field)
    if isinstance(v, dict):
        v = v.get("nominal")
    return None if v is None else float(v)


def _finding(
    group_id: str,
    kind: str,
    pillar: str,
    headline: str,
    interpretation: str,
    k: int | None,
    n: int | None,
    basis: str,
    rows: Iterable[dict[str, Any]],
) -> dict[str, Any]:
    rows = list(rows)
    return {
        "id": f"{group_id}:{kind}",
        "kind": kind,
        "pillar": pillar,
        "headline": headline,
        "interpretation": interpretation,
        "k": k,
        "n": n,
        "basis": basis,
        "observation_ids": _ids(rows, "observation_id"),
        "experiment_ids": _ids(rows, "experiment_id"),
    }


def _material_findings(
    gid: str,
    rows: list[dict[str, Any]],
    low: dict[str, Any] | None,
    high_out: dict[str, Any] | None,
    bins: list[dict[str, Any]],
    ranges: dict[str, Any],
    iss_o2: float | None,
    low_kpa: list[float],
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    o2_rows = [r for r in rows if r.get("oxygen_percent") is not None]
    if low is not None:
        lo = low["oxygen_percent"]
        at_or_below = [r for r in o2_rows if float(r["oxygen_percent"]) <= lo]
        k = sum(1 for r in at_or_below if _sustained(r))
        interp = ""
        if iss_o2 is not None:
            diff = lo - iss_o2
            rel = (
                "about the same as" if abs(diff) <= O2_SAME_TOLERANCE else ("below" if diff < 0 else "above")
            )
            interp = f"That is {rel} the {fmt(iss_o2)}% oxygen of ISS cabin air."
        if low["pressure_basis"] == "assumed" and low["pressure_kpa"] is not None:
            p = low["pressure_kpa"]
            if abs(p - SEA_LEVEL_KPA) <= 1.0:
                extra = "Pressure was not recorded for these tests; sea-level pressure is assumed."
            else:
                extra = f"Pressure was not recorded for these tests; {fmt(p)} kPa is assumed."
            interp = f"{interp} {extra}".strip()
        support = [r for r in at_or_below if _sustained(r)]
        out.append(
            _finding(
                gid,
                "lowest_o2_burning",
                "prevention",
                f"A flame kept burning at {fmt(lo)}% oxygen in {k} of {len(at_or_below)} ISS tests "
                "at or below that "
                "level.",
                interp,
                k,
                len(at_or_below),
                "derived" if low["o2_basis"] == "interpolated" else "measured",
                support,
            )
        )
    if low is not None and high_out is not None and low["oxygen_percent"] <= high_out["oxygen_percent"]:
        lo, hi = low["oxygen_percent"], high_out["oxygen_percent"]
        band = [r for r in o2_rows if lo <= float(r["oxygen_percent"]) <= hi and _sustained(r) is not None]
        went_out = [r for r in band if not _sustained(r)]
        out.append(
            _finding(
                gid,
                "overlap",
                "suppression",
                f"Between {fmt(lo)}% and {fmt(hi)}% oxygen, some flames kept burning and some went out "
                f"({len(went_out)} of {len(band)} tests in that band went out).",
                "Oxygen alone does not decide the outcome here; airflow matters too.",
                len(went_out),
                len(band),
                "derived",
                went_out,
            )
        )
    burning_bins = [(i, b) for i, b in enumerate(bins) if b["lowest_o2_burning"] is not None]
    if len(burning_bins) >= 2:
        ia, a = min(burning_bins, key=lambda t: (t[1]["lowest_o2_burning"], t[0]))
        ib, b = max(burning_bins, key=lambda t: (t[1]["lowest_o2_burning"], -t[0]))
        if ia == ib:  # every bin reached the same value: compare the lowest and highest airflow bins
            (ia, a), (ib, b) = burning_bins[0], burning_bins[-1]
        first, second = sorted([(ia, a), (ib, b)], key=lambda t: t[0])
        la, lb = _bin_label(first[1]["lo"], first[1]["hi"]), _bin_label(second[1]["lo"], second[1]["hi"])
        va, vb = first[1]["lowest_o2_burning"], second[1]["lowest_o2_burning"]
        if va == vb:
            same = fmt(va)
            interp = f"In these tests, both airflow ranges kept a flame burning down to {same}% oxygen."
        else:
            leaner = la if va < vb else lb
            interp = f"In these tests, the flame kept burning in leaner air at {leaner} cm/s airflow."

        def bin_rows(bn: dict[str, Any]) -> list[dict[str, Any]]:
            return [
                r
                for r in rows
                if _sustained(r)
                and r.get("airflow_cm_s") is not None
                and float(r["airflow_cm_s"]) >= bn["lo"]
                and (bn["hi"] is None or float(r["airflow_cm_s"]) < bn["hi"])
                and r.get("oxygen_percent") is not None
                and float(r["oxygen_percent"]) == bn["lowest_o2_burning"]
            ]

        out.append(
            _finding(
                gid,
                "airflow",
                "suppression",
                f"The lowest oxygen that kept a flame burning was {fmt(va)}% at {la} cm/s airflow "
                f"and {fmt(vb)}% "
                f"at {lb} cm/s.",
                interp,
                None,
                first[1]["n"] + second[1]["n"],
                "derived",
                bin_rows(first[1]) + bin_rows(second[1]),
            )
        )
    prange = ranges["pressure_kpa"]
    if prange is not None and low_kpa and prange[0] > max(low_kpa):
        n = len(rows)
        if n == 1:
            first_line = f"The only test for this material was at {fmt(prange[0])} kPa."
        elif fmt(prange[0]) == fmt(prange[1]):
            about = "" if prange[0] == prange[1] else "about "
            first_line = f"All {n} tests for this material were at {about}{fmt(prange[0])} kPa."
        else:
            first_line = (
                f"All {n} tests for this material were between {fmt(prange[0])} and {fmt(prange[1])} kPa."
            )
        span = (
            f"{fmt(min(low_kpa))}{DASH}{fmt(max(low_kpa))} kPa"
            if len(set(low_kpa)) > 1
            else f"{fmt(low_kpa[0])} kPa"
        )
        basis = "measured" if ranges["pressure_basis"] == "measured" else "assumed"
        interp = "These results cannot show how this material behaves at lower cabin pressure."
        if basis == "assumed":
            interp += " Some or all of these pressures were not recorded and are assumed."
        out.append(
            _finding(
                gid,
                "pressure_gap",
                "prevention",
                f"{first_line} Lower-pressure cabin air (Moon and Mars habitat designs at {span}) "
                "is not represented "
                "in the integrated records.",
                interp,
                None,
                n,
                basis,
                rows,
            )
        )
    return out


def _cabins(headline: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for p in headline.get("profiles") or []:
        name = str(p.get("label") or p["profile_id"])
        rows.append(
            {
                "profile_id": p["profile_id"],
                "name": name,
                "oxygen_percent": p.get("oxygen_percent"),
                "total_pressure_kpa": p.get("total_pressure_kpa"),
                "comparable_observations": int(p["comparable_observations"]),
                "groups_with_comparable": int(p["groups_with_comparable"]),
                "n_groups": int(p["n_groups"]),
                "sentence": f"{name}: {int(p['comparable_observations'])} comparable ISS results across "
                f"{int(p['groups_with_comparable'])} of {int(p['n_groups'])} materials.",
                "pillar": "prevention",
            }
        )
    rows.sort(key=lambda r: (r["comparable_observations"], r["name"], r["profile_id"]))
    return [{"rank": i + 1, **r} for i, r in enumerate(rows)]


def compute_findings(
    observations: list[dict[str, Any]],
    groups: list[dict[str, Any]],
    targets: dict[str, Any],
    headline: dict[str, Any],
    dataset_version: str | None = None,
    model_version: str | None = None,
) -> dict[str, Any]:
    """Pure: same inputs give the same (sorted, rounded) output."""
    included = [o for o in observations if o.get("included_in_training") is True]
    excluded = len(observations) - len(included)
    by_group: dict[str, list[dict[str, Any]]] = {}
    for o in included:
        by_group.setdefault(str(o["group_id"]), []).append(o)
    iss_o2 = _nominal(_profile(targets, ISS_PROFILE), "oxygen_percent")
    low_kpa = [
        v
        for v in (_nominal(_profile(targets, pid), "total_pressure_kpa") for pid in LOW_PRESSURE_PROFILES)
        if v is not None
    ]
    group_meta = {str(g["group_id"]): g for g in groups}
    materials: list[dict[str, Any]] = []
    for gid in sorted(by_group):
        rows = sorted(by_group[gid], key=lambda r: str(r["observation_id"]))
        g = group_meta.get(gid, {})
        low = _extreme(rows, burning=True, lowest=True)
        high_out = _extreme(rows, burning=False, lowest=False)
        bins, n_flow_missing = airflow_bins(rows)
        ranges = tested_ranges(rows)
        overlap = (
            [low["oxygen_percent"], high_out["oxygen_percent"]]
            if low is not None
            and high_out is not None
            and low["oxygen_percent"] <= high_out["oxygen_percent"]
            else None
        )
        first = rows[0]
        materials.append(
            {
                "group_id": gid,
                "label": str(g.get("label") or gid),
                "material_family": str(g.get("material_family") or first.get("material_family") or ""),
                "flame_configuration": str(
                    g.get("flame_configuration") or first.get("flame_configuration") or ""
                ),
                "n_experiments": len({r["experiment_id"] for r in rows}),
                "n_observations": len(rows),
                "investigation_ids": sorted(
                    {str(r["investigation_id"]) for r in rows if r.get("investigation_id")}
                ),
                "campaigns": sorted({str(r["campaign_group"]) for r in rows if r.get("campaign_group")}),
                "model_status": g.get("model_status") or "insufficient_data",
                "model_reason": g.get("model_reason"),
                "lowest_o2_burning": low,
                "highest_o2_out": high_out,
                "overlap_o2": overlap,
                "airflow_bins": bins,
                "n_airflow_missing": n_flow_missing,
                "tested_ranges": ranges,
                "findings": _material_findings(gid, rows, low, high_out, bins, ranges, iss_o2, low_kpa),
            }
        )
    materials.sort(
        key=lambda m: (
            m["lowest_o2_burning"] is None,
            m["lowest_o2_burning"]["oxygen_percent"] if m["lowest_o2_burning"] else 0.0,
            -m["n_observations"],
            m["group_id"],
        )
    )
    materials = [{"rank": i + 1, **m} for i, m in enumerate(materials)]
    n_sus = sum(1 for o in included if _sustained(o) is True)
    n_out = sum(1 for o in included if _sustained(o) is False)
    notes = [
        f"Counts use the {len(included)} ISS test results included in model training "
        "(included_in_training = true); "
        f"{excluded} other records are left out.",
        "ISS tests only. Not endorsed by NASA.",
        "Not a certified fire-safety assessment.",
        "Detection: not represented in the integrated records.",
        "Materials without a flame that kept burning are ranked last.",
    ]
    body = {
        "dataset_version": dataset_version,
        "model_version": model_version,
        "ranking_rule": RANKING_RULE,
        "pillar_rule": PILLAR_RULE,
        "summary": {
            "n_observations": len(included),
            "n_experiments": len({o["experiment_id"] for o in included}),
            "n_groups": len(by_group),
            "n_investigations": len({o["investigation_id"] for o in included if o.get("investigation_id")}),
            "n_sustained": n_sus,
            "n_not_sustained": n_out,
        },
        "materials": materials,
        "cabins": _cabins(headline),
        "notes": notes,
    }
    return _round(body)
