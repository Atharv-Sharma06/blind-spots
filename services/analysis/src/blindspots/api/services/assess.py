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
from blindspots.coverage.coverage import standardized_distances, target_coverage

SUPPORTED_FRACTION = 0.75
INSUFFICIENT_FRACTION = 0.5
REASON_FRACTION = 0.5


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


def _aggregate(verdicts: list[str], reasons: list[list[dict[str, Any]]]) -> tuple[str, list[dict[str, Any]]]:
    n = len(verdicts)
    c = Counter(verdicts)
    if c["supported"] / n >= SUPPORTED_FRACTION:
        verdict = "supported"
    elif c["insufficient_evidence"] / n >= INSUFFICIENT_FRACTION:
        verdict = "insufficient_evidence"
    else:
        verdict = "extrapolation"
    codes: Counter[str] = Counter()
    messages: dict[str, str] = {}
    for per_point in reasons:
        for r in per_point:
            codes[r["code"]] += 1
            messages.setdefault(r["code"], r["message"])
    out = []
    for code, cnt in sorted(codes.items(), key=lambda kv: (-kv[1], kv[0])):
        frac = cnt / n
        if frac >= REASON_FRACTION:
            out.append(
                {
                    "code": code,
                    "message": f"{messages[code]} (applies to {100 * frac:.0f} % of the target points)",
                    "value": round(frac, 4),
                }
            )
    return verdict, out


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
    coverage = {
        "n_target_points": cov["n_target_points"],
        "comparable_observations": comparable_obs,
        "points_with_comparable": sum(1 for c in cov["comparable_count_per_point"] if c > 0),
        "nn_distance_min": cov["min_nn_d"],
        "nn_distance_median": cov["median_nn_d"],
        "fraction_inside_hull": cov["fraction_inside_hull"],
        "nearest_observations": _nearest(t, coords, rows),
    }
    gm = modeling.group_model(group_id)
    if gm is not None:
        assert gm.model is not None
        a = modeling.assess_points(gm.model, t)
        ev = modeling.explain_points(
            t, modeling.evidence_coords(gm.model), a["ratio"], a["aleatoric"], a["total"]
        )
        verdict, reasons = _aggregate(ev["verdict"], ev["reasons"])
        model = {
            "model_status": "modeled",
            "p_sustained_mean": float((w * a["p"]).sum()),
            "p_sustained_min": float(a["p"].min()),
            "p_sustained_max": float(a["p"].max()),
            "latent_std_ratio_mean": float((w * a["ratio"]).sum()),
            "epistemic_mean": float((w * a["epistemic"]).sum()),
            "aleatoric_mean": float((w * a["aleatoric"]).sum()),
        }
    else:
        ev = modeling.explain_points(t, coords, np.ones(len(t)))
        _, reasons = _aggregate(ev["verdict"], ev["reasons"])
        verdict = "insufficient_evidence"
        reasons = [modeling.no_model_reason(group.get("model_reason")), *reasons]
        model = {"model_status": "insufficient_data"}
    docs = ctxmod.documented_context(spec)
    return {
        "group_id": group_id,
        "target": resolved.payload,
        "coverage": coverage,
        "model": model,
        "verdict": verdict,
        "reasons": reasons,
        "documented_context": docs,
        "summary": summary(group, resolved.payload, coverage, model, verdict, docs),
    }


def summary(
    group: dict[str, Any],
    target: dict[str, Any],
    cov: dict[str, Any],
    model: dict[str, Any],
    verdict: str,
    docs: list[dict[str, Any]],
) -> str:
    o2, p, af = target["oxygen_percent"], target["total_pressure_kpa"], target["airflow_cm_s"]
    parts = [
        f"{target['label']}: O2 {o2['nominal']:g} %, {p['nominal']:g} kPa, airflow "
        f"{af['min']:g}-{af['max']:g} cm/s ({target['airflow_band_source']}). "
        f"For {group['label']} ({group['n_training']} training observations, "
        f"{group['label_counts']['sustained']} sustained and {group['label_counts']['not_sustained']} "
        f"not sustained), {cov['points_with_comparable']} of {cov['n_target_points']} target points have "
        f"at least one comparable integrated observation ({cov['comparable_observations']} observation(s) "
        "within one reference distance)"
    ]
    if cov["nn_distance_min"] is not None:
        parts[0] += f"; the nearest is {cov['nn_distance_min']:.1f} reference distances away"
    parts[0] += "."
    if model["model_status"] == "modeled":
        parts.append(
            f"Model estimate of P(sustained) over the target region: mean {model['p_sustained_mean']:.2f} "
            f"(range {model['p_sustained_min']:.2f}-{model['p_sustained_max']:.2f}), mean latent std ratio "
            f"{model['latent_std_ratio_mean']:.2f}."
        )
    else:
        parts.append("No model is available for this group (insufficient data); only coverage is reported.")
    parts.append(f"Evidence verdict: {verdict.replace('_', ' ')}.")
    names = ctxmod.names(docs)
    if verdict != "supported":
        if docs:
            parts.append(
                "These target conditions are not represented in the integrated records with comparable "
                f"evidence. Documented investigations whose ranges overlap them but are not integrated: "
                f"{names}."
            )
        else:
            parts.append(
                "These target conditions are not represented in the integrated records with comparable "
                "evidence; no investigation in the catalogue of not-integrated work overlaps them, but "
                "that catalogue is not exhaustive."
            )
    elif docs:
        parts.append(f"Other documented investigations overlapping this target but not integrated: {names}.")
    return " ".join(parts)
