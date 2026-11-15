"""Target assessment: coverage of the target region, model summary, verdict and documented context."""

from __future__ import annotations

from collections import Counter
from typing import Any

import numpy as np

from blindspots.acquisition.targets import target_points
from blindspots.api import deps
from blindspots.api.models import Target
from blindspots.api.services import context as ctxmod
from blindspots.api.services import modeling
from blindspots.api.services.targets import resolve_target
from blindspots.coverage.coverage import standardized_distances, target_coverage, to_coords
from blindspots.uncertainty import explanations

DASH = "\u2013"  # en dash for ranges in prose
BAND_SOURCE_TEXT = {
    "profile": "documented for this profile",
    "ventilation_standard": "NASA-STD-3001 ventilation range",
    "ventilation_standard_with_near_quiescent_extension": "NASA-STD-3001 ventilation range, extended down "
    "to 0.5 cm/s",
    "default_band": "default analysis band",
    "custom": "user-selected",
}


def fmt_num(x: float, nd: int = 1) -> str:
    """Compact number: trailing zeros dropped (21 -> '21', 24.1 -> '24.1')."""
    out = f"{x:.{nd}f}".rstrip("0").rstrip(".")
    return out if out not in ("", "-0") else "0"


def fmt_flow(u: float) -> str:
    return f"{u:.1f}" if u >= 1 else f"{u:.2g}"


def _nearest(t: np.ndarray, coords: np.ndarray, rows: Any, n: int = 5) -> list[dict[str, Any]]:
    if len(coords) == 0:
        return []
    d = standardized_distances(t, coords).min(axis=0)  # per observation: distance to the target region
    order = np.argsort(d, kind="stable")[:n]
    out = []
    for i in order:
        r = rows.iloc[int(i)]
        lab = r.get("label")
        out.append(
            {
                "observation_id": str(r["observation_id"]),
                "experiment_id": str(r["experiment_id"]),
                "distance": round(float(d[i]), 4),
                "oxygen_percent": float(r["oxygen_percent"]),
                "airflow_cm_s": float(r["airflow_cm_s"]),
                "pressure_kpa": float(r["pressure_for_analysis_kpa"]),
                "label": None if lab is None or lab != lab else int(lab),
            }
        )
    return out


def _aggregate(
    verdicts: list[str], reasons: list[list[dict[str, Any]]], comparable_counts: Any
) -> tuple[str, list[dict[str, Any]]]:
    """Target-level verdict and shared reasons: ``uncertainty.explanations.aggregate_target`` (D2 rule)."""
    agg = explanations.aggregate_target(verdicts, comparable_counts, reasons)
    return str(agg["verdict"]), list(agg["reasons"])


def verdict_basis(counts: dict[str, int], n: int, points_with_comparable: int) -> dict[str, Any]:
    """Numeric reason that states the rule behind the target verdict (never an empty 'why' list)."""
    k = counts["supported"]
    if points_with_comparable == 0:
        msg = (
            f"None of the {n} target points has a comparable observation within one reference distance, "
            "so no part of the target is supported by the integrated records."
        )
    else:
        msg = (
            f"{k} of {n} target points are supported ({100 * k / n:.0f}%; at least 50% are needed for a "
            f"supported target). A point is supported when it lies inside the observed region or has 3 or "
            f"more comparable observations, and its remaining uncertainty (latent std ratio) is below 0.6. "
            f"{points_with_comparable} of {n} target points have at least one comparable observation."
        )
    return {"code": "point_verdicts", "message": msg, "value": round(k / n, 4) if n else 0.0}


def target_verdict(gm: Any, t: np.ndarray) -> str:
    """Evidence verdict of a target region under a group model (same rule as ``assess``)."""
    assert gm.model is not None
    a = modeling.assess_points(gm.model, t)
    ev = modeling.explain_points(
        t, modeling.evidence_coords(gm.model), a["ratio"], a["aleatoric"], a["total"]
    )
    return _aggregate(ev["verdict"], ev["reasons"], ev["count"])[0]


def assess(group_id: str, target: Target) -> dict[str, Any]:
    store = deps.require_store()
    group = deps.get_group(group_id, store)
    resolved = resolve_target(target)
    spec = resolved.spec
    t, w = target_points(spec)
    coords, rows = store.evidence(group_id)
    cov = target_coverage(t, coords)
    dist = standardized_distances(t, coords) if len(coords) else np.zeros((len(t), 0))
    comparable_obs = int((dist.min(axis=0) <= 1.0 + 1e-12).sum()) if dist.size else 0
    pwc = sum(1 for c in cov["comparable_count_per_point"] if c > 0)
    coverage = {
        "n_target_points": cov["n_target_points"],
        "comparable_observations": comparable_obs,
        "points_with_comparable": pwc,
        "nn_distance_min": cov["min_nn_d"],
        "nn_distance_median": cov["median_nn_d"],
        "fraction_inside_hull": cov["fraction_inside_hull"],
        "nearest_observations": _nearest(t, coords, rows),
    }
    n = len(t)
    gm = modeling.group_model(group_id)
    if gm is not None:
        assert gm.model is not None
        a = modeling.assess_points(gm.model, t)
        ev = modeling.explain_points(
            t, modeling.evidence_coords(gm.model), a["ratio"], a["aleatoric"], a["total"]
        )
        verdict, reasons = _aggregate(ev["verdict"], ev["reasons"], cov["comparable_count_per_point"])
        sup = np.asarray(ev["verdict"]) == "supported"
        # P(sustained) only over individually supported points (LEAD_DECISIONS D2); null when none is.
        ws = w[sup] / w[sup].sum() if sup.any() else None
        model = {
            "model_status": "modeled",
            "p_sustained_mean": float((ws * a["p"][sup]).sum()) if ws is not None else None,
            "p_sustained_min": float(a["p"][sup].min()) if sup.any() else None,
            "p_sustained_max": float(a["p"][sup].max()) if sup.any() else None,
            "latent_std_ratio_mean": float((w * a["ratio"]).sum()),
            "epistemic_mean": float((w * a["epistemic"]).sum()),
            "aleatoric_mean": float((w * a["aleatoric"]).sum()),
        }
        counts = Counter(ev["verdict"])
        point_verdicts = {k: int(counts[k]) for k in ("supported", "extrapolation", "insufficient_evidence")}
        reasons = [verdict_basis(point_verdicts, n, pwc), *reasons]
    else:
        ev = modeling.explain_points(t, coords, np.ones(len(t)))
        _, reasons = _aggregate(ev["verdict"], ev["reasons"], cov["comparable_count_per_point"])
        verdict = "insufficient_evidence"
        counts = Counter(ev["verdict"])
        point_verdicts = {"supported": 0, "extrapolation": 0, "insufficient_evidence": 0}
        point_verdicts.update({k: int(v) for k, v in counts.items() if k != "supported"})
        reasons = [modeling.no_model_reason(group.get("model_reason")), *reasons]
        model = {"model_status": "insufficient_data"}
    docs = ctxmod.documented_context(spec)
    return {
        "group_id": group_id,
        "target": resolved.payload,
        "coverage": coverage,
        "model": model,
        "verdict": verdict,
        "points_supported": point_verdicts["supported"],
        "point_verdicts": point_verdicts,
        "reasons": reasons,
        "documented_context": docs,
        "investigation_relevance": investigation_relevance(store, group_id, spec, t),
        "summary": summary(group, resolved.payload, coverage, model, verdict, docs, point_verdicts),
    }


def summary(
    group: dict[str, Any],
    target: dict[str, Any],
    cov: dict[str, Any],
    model: dict[str, Any],
    verdict: str,
    docs: list[dict[str, Any]],
    point_verdicts: dict[str, int] | None = None,
) -> str:
    o2, p, af = target["oxygen_percent"], target["total_pressure_kpa"], target["airflow_cm_s"]
    n, pwc = cov["n_target_points"], cov["points_with_comparable"]
    band = BAND_SOURCE_TEXT.get(target["airflow_band_source"], "analysis band")
    lc = group["label_counts"]
    parts = [
        f"{target['label']}: {fmt_num(o2['nominal'])}% O₂, {p['nominal']:.1f} kPa, airflow "
        f"{fmt_flow(af['min'])}{DASH}{fmt_flow(af['max'])} cm/s ({band}). "
        f"For {group['label']} ({group['n_training']} training observations: {lc['sustained']} flame "
        f"sustained, {lc['not_sustained']} flame not sustained), {pwc} of {n} target points have at least "
        f"one comparable observation ({cov['comparable_observations']} comparable observations within one "
        "reference distance)"
    ]
    if cov["nn_distance_min"] is not None:
        parts[0] += f"; the nearest is {cov['nn_distance_min']:.1f} reference distances away"
    parts[0] += "."
    k = (point_verdicts or {}).get("supported", 0)
    if model["model_status"] == "modeled":
        parts.append(f"Supported at {k} of {n} target points.")
        if model.get("p_sustained_mean") is None:
            parts.append(
                "No P(sustained) estimate is given: no target point is supported, and away from the "
                "integrated evidence the model output reverts toward the training base rate."
            )
        else:
            parts.append(
                f"Model estimate of P(sustained) over the {k} supported target points: mean "
                f"{model['p_sustained_mean']:.2f} (range {model['p_sustained_min']:.2f}{DASH}"
                f"{model['p_sustained_max']:.2f}); remaining uncertainty (latent std ratio) over the whole "
                f"target {model['latent_std_ratio_mean']:.2f}."
            )
    else:
        parts.append("No model is available for this group (insufficient data); only coverage is reported.")
    parts.append(f"Evidence verdict: {verdict.replace('_', ' ')}.")
    names = ctxmod.names(docs)
    if pwc == 0:
        if docs:
            parts.append(
                "These target conditions are not represented in the integrated records. Documented "
                f"investigations whose ranges overlap them but are not integrated: {names}."
            )
        else:
            parts.append(
                "These target conditions are not represented in the integrated records; no investigation in "
                "the catalogue of not-integrated work overlaps them, but that catalogue is not exhaustive."
            )
    else:
        if pwc < n:
            parts.append(
                f"Comparable observations cover {pwc} of {n} target points; estimates at the other "
                f"{n - pwc} depend on model assumptions."
            )
        if docs:
            parts.append(f"Related NASA work overlapping this target, not integrated: {names}.")
    return " ".join(parts)


# --- investigations ranked by relevance to the target ---------------------------------------------

_ROLE_ORDER = {
    "integrated_model": 0,
    "integrated_context": 1,
    "documented_not_integrated": 2,
    "catalogued_not_integrated": 3,
}
_OVERLAP_ORDER = {
    "contains_target_nominal": 0,
    "overlaps_target_region": 1,
    "outside_target_region": 2,
    "not_documented": 3,
    None: 4,
}
_OVERLAP_TEXT = {
    "contains_target_nominal": "contains the target conditions",
    "overlaps_target_region": "overlaps the target region",
    "outside_target_region": "does not overlap the target region",
    "not_documented": "is not documented numerically",
}


def _envelope_overlap(rec: dict[str, Any], spec: Any) -> str:
    from blindspots.api.services.context import _contains, _overlaps

    o2r, pr, fr = rec.get("oxygen_percent_range"), rec.get("pressure_kpa_range"), rec.get("flow_cm_s_range")
    if o2r is None or pr is None:
        return "not_documented"
    o2_lo = spec.o2_min if spec.o2_min is not None else spec.o2_nominal
    o2_hi = spec.o2_max if spec.o2_max is not None else spec.o2_nominal
    p_lo = spec.pressure_min_kpa if spec.pressure_min_kpa is not None else spec.pressure_nominal_kpa
    p_hi = spec.pressure_max_kpa if spec.pressure_max_kpa is not None else spec.pressure_nominal_kpa
    if not (_overlaps(o2r, o2_lo, o2_hi) and _overlaps(pr, p_lo, p_hi)):
        return "outside_target_region"
    if fr is not None and not _overlaps(fr, spec.airflow_min_cm_s, spec.airflow_max_cm_s):
        return "outside_target_region"
    if _contains(o2r, spec.o2_nominal) and _contains(pr, spec.pressure_nominal_kpa):
        return "contains_target_nominal"
    return "overlaps_target_region"


def _record_coords(rows: list[dict[str, Any]]) -> np.ndarray:
    pts = []
    for e in rows:
        o2, u = e.get("oxygen_percent"), e.get("airflow_cm_s")
        pk = (
            e.get("total_pressure_kpa")
            if e.get("total_pressure_kpa") is not None
            else e.get("pressure_assumed_kpa")
        )
        if o2 is not None and u is not None and pk is not None and pk > 0 and u >= 0:
            pts.append((float(o2), float(pk), float(u)))
    if not pts:
        return np.zeros((0, 3))
    arr = np.asarray(pts)
    return to_coords(arr[:, 0], arr[:, 1], arr[:, 2])


def investigation_relevance(
    store: deps.DataStore, group_id: str, spec: Any, t: np.ndarray
) -> list[dict[str, Any]]:
    """Every catalogued investigation ranked by relevance to the target region (deterministic).

    Order: role (integrated training data, integrated context records, documented not integrated, PSI
    catalogued not integrated), then comparable observations in this analysis group (desc), documented
    envelope overlap, nearest reference distance (asc) and name. Summaries are built from numbers and
    manifest fields only.
    """
    from blindspots.models.groups import training_rows

    train = training_rows(store.obs_df).dropna(
        subset=["oxygen_percent", "airflow_cm_s", "pressure_for_analysis_kpa"]
    )
    group_coords, group_rows = store.evidence(group_id)
    by_url: dict[str, list[dict[str, Any]]] = {}
    manifest = deps.not_integrated_records()
    for rec in manifest:
        for q in rec.get("sources", []):
            if q.get("url"):
                by_url.setdefault(str(q["url"]), []).append(rec)
    merged_ids: set[str] = set()
    out: list[dict[str, Any]] = []
    for inv in store.investigations:
        iid, role = inv["investigation_id"], inv.get("role")
        name = f"{inv.get('acronym') or iid}: {inv.get('title') or ''}".rstrip(": ")
        url = inv.get("landing_url")
        row: dict[str, Any] = {"id": iid, "name": name, "doi": inv.get("doi"), "url": url}
        if role == "integrated_model":
            mine = train.loc[train["investigation_id"] == iid]
            coords = (
                to_coords(
                    mine["oxygen_percent"].to_numpy(float),
                    mine["pressure_for_analysis_kpa"].to_numpy(float),
                    mine["airflow_cm_s"].to_numpy(float),
                )
                if len(mine)
                else np.zeros((0, 3))
            )
            d_all = standardized_distances(t, coords).min(axis=0) if len(coords) else np.zeros(0)
            g_mask = (
                (group_rows["investigation_id"] == iid).to_numpy() if len(group_rows) else np.zeros(0, bool)
            )
            d_g = standardized_distances(t, group_coords[g_mask]).min(axis=0) if g_mask.any() else np.zeros(0)
            k_g = int((d_g <= 1.0 + 1e-12).sum())
            k_all = int((d_all <= 1.0 + 1e-12).sum())
            nn = float(d_all.min()) if len(d_all) else None
            row.update(
                role="integrated_model",
                comparable_observations=k_g,
                comparable_records_all_groups=k_all,
                nearest_distance=None if nn is None else round(nn, 2),
                summary=(
                    f"Integrated training data ({len(mine)} training observations). {k_g} of its "
                    f"{int(g_mask.sum())} observations in this analysis group are comparable to the target; "
                    f"{k_all} across all analysis groups"
                    + (f"; nearest {nn:.1f} reference distances away." if nn is not None else ".")
                ),
            )
        elif role == "integrated_context":
            exps = [e for e in store.experiments if e["investigation_id"] == iid]
            coords = _record_coords(exps)
            d_all = standardized_distances(t, coords).min(axis=0) if len(coords) else np.zeros(0)
            k_all = int((d_all <= 1.0 + 1e-12).sum())
            nn = float(d_all.min()) if len(d_all) else None
            matched = by_url.get(str(url), []) if url else []
            overlaps = [_envelope_overlap(m, spec) for m in matched]
            merged_ids.update(m["id"] for m in matched)
            best = min(overlaps, key=lambda o: _OVERLAP_ORDER[o]) if overlaps else None
            text = (
                f"Context only, not used by the model: {len(exps)} transcribed test conditions; {k_all} "
                "within one reference distance of the target (any material)"
                + (f", nearest {nn:.1f} reference distances away" if nn is not None else "")
                + "."
            )
            if best is not None:
                text += f" Its documented test envelope {_OVERLAP_TEXT[best]}."
            row.update(
                role="integrated_context",
                comparable_records_all_groups=k_all,
                nearest_distance=None if nn is None else round(nn, 2),
                envelope_overlap=best,
                summary=text,
            )
        else:
            row.update(
                role="catalogued_not_integrated",
                summary="Catalogued in NASA PSI, not integrated: "
                + str(inv.get("role_reason") or "reason not recorded"),
            )
        out.append(row)
    for rec in manifest:
        if rec["id"] in merged_ids:
            continue
        ov = _envelope_overlap(rec, spec)
        rng = []
        if rec.get("oxygen_percent_range"):
            lo, hi = rec["oxygen_percent_range"]
            rng.append(f"{fmt_num(lo)}{DASH}{fmt_num(hi)}% O₂")
        if rec.get("pressure_kpa_range"):
            lo, hi = rec["pressure_kpa_range"]
            rng.append(f"{lo:.1f}{DASH}{hi:.1f} kPa")
        if rec.get("flow_cm_s_range"):
            lo, hi = rec["flow_cm_s_range"]
            rng.append(f"{fmt_num(lo)}{DASH}{fmt_num(hi)} cm/s")
        env = f"Documented test envelope ({', '.join(rng)})" if rng else "Documented test envelope"
        urls = [q["url"] for q in rec.get("sources", []) if q.get("url")]
        out.append(
            {
                "id": rec["id"],
                "name": rec["name"],
                "role": "documented_not_integrated",
                "envelope_overlap": ov,
                "doi": None,
                "url": urls[0] if urls else None,
                "summary": f"{env} {_OVERLAP_TEXT[ov]}; not integrated: "
                f"{rec.get('reason_not_integrated') or 'reason not recorded'}",
            }
        )

    def key(r: dict[str, Any]) -> tuple[Any, ...]:
        nn = r.get("nearest_distance")
        tier = float(_ROLE_ORDER[r["role"]])
        near = bool(r.get("comparable_records_all_groups")) or r.get("envelope_overlap") in (
            "contains_target_nominal",
            "overlaps_target_region",
        )
        if r["role"] == "integrated_model" and not r.get("comparable_observations"):
            tier = 1.5 if near else 2.5  # comparable records only in other groups, or none at all
        if r["role"] == "integrated_context" and not near:
            tier = 2.5  # far context records rank below documented envelopes that overlap the target
        return (
            tier,
            -(r.get("comparable_observations") or 0),
            -(r.get("comparable_records_all_groups") or 0),
            _OVERLAP_ORDER[r.get("envelope_overlap")],
            nn if nn is not None else float("inf"),
            r["name"],
        )

    out.sort(key=key)
    for i, r in enumerate(out, start=1):
        r["relevance_rank"] = i
    return out
