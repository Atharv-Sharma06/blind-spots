"""Deterministic research brief (markdown); computed from the same numbers as the other endpoints."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

from blindspots import config
from blindspots.api import deps
from blindspots.api.models import Point, Target
from blindspots.api.services import assess as assess_mod
from blindspots.api.services import modeling, ranking
from blindspots.api.services.targets import resolve_target

STANDARD_DISCLAIMER = (
    "Computational research candidates built from public NASA records. They need qualified scientific "
    "review, established safety procedures and formal feasibility assessment. Not endorsed or approved by "
    "NASA; not a certified fire-safety assessment."
)


def _fmt(x: float | None, nd: int = 3) -> str:
    return "n/a" if x is None else f"{x:.{nd}f}"


def _metric(m: dict[str, Any] | None) -> str:
    if not m or m.get("value") is None:
        return "n/a"
    ci = m.get("ci95")
    out = _fmt(m["value"])
    if ci and ci[0] is not None and ci[1] is not None:
        out += f" (95% CI {_fmt(ci[0])} to {_fmt(ci[1])})"
    return out


def _validation_group(group_id: str) -> dict[str, Any] | None:
    reg = modeling.full_registry()
    for g in (reg.validation or {}).get("groups", []):
        if g.get("group_id") == group_id:
            return g
    return None


STATUS_TEXT = {
    "documented_nasa": "documented NASA value",
    "historical_nasa": "historical NASA value",
    "nasa_design_recommendation": "NASA design recommendation",
    "user_hypothetical": "user-selected hypothetical",
}
FLAG_TEXT = {
    "documented_upper_bound_used": "no documented usual oxygen level; the documented upper limit is used",
    "documented_lower_bound_used": "no documented usual oxygen level; the documented lower limit is used",
    "documented_bound_used": "a documented limit is used where no usual value exists",
    "default_band": "no documented airflow; the default band is used",
}
REASON_LABELS = {
    "point_verdicts": "Points covered",
    "sparse_observations": "Few ISS tests nearby",
    "outside_hull": "Outside the tested range",
    "unobserved_pressure": "Pressure not tested",
    "outcome_variability": "Mixed results nearby",
    "model_instability": "Models disagree",
    "other_family_evidence_only": "Only other materials tested nearby",
    "no_model": "No model for this material",
    "high_knowledge_uncertainty": "Model still unsure",
    "target_points_not_supported": "Points not well covered",
    "expected_uncertainty_reduction": "Uncertainty it would remove",
    "at_target_conditions": "At the cabin's conditions",
    "high_target_covariance": "Informs the cabin's air",
    "high_candidate_uncertainty": "Model very unsure here",
    "near_decision_boundary": "Near the burn / go-out line",
    "fills_coverage_gap": "Fills a gap in the tests",
    "assumption_dependent": "Depends on the pressure assumption",
}
BLINDSPOT_VERDICT_TEXT = {
    "supported": "supported",
    "not_supported": "not supported",
    "inconclusive": "inconclusive",
}


def _bounds(r: dict[str, Any], nd: int = 1) -> str:
    lo, hi = r.get("min"), r.get("max")
    if lo is None and hi is None:
        return ""
    lo_s = "not given" if lo is None else f"{lo:.{nd}f}"
    hi_s = "not given" if hi is None else f"{hi:.{nd}f}"
    return f" (min {lo_s}, max {hi_s})"


def _target_section(resolved: dict[str, Any]) -> str:
    o2, p, af = resolved["oxygen_percent"], resolved["total_pressure_kpa"], resolved["airflow_cm_s"]
    status = STATUS_TEXT.get(resolved["status"], "documented value")
    band = assess_mod.BAND_SOURCE_TEXT.get(resolved["airflow_band_source"], "analysis band")
    lines = [
        f"- Label: {resolved['label']} ({status})",
        f"- Oxygen: usually {assess_mod.fmt_num(o2['nominal'])}%{_bounds(o2)}",
        f"- Pressure: usually {p['nominal']:.1f} kPa{_bounds(p)}",
        f"- Airflow: {assess_mod.fmt_flow(af['min'])}\u2013{assess_mod.fmt_flow(af['max'])} cm/s ({band})",
    ]
    if resolved.get("airflow_band_note"):
        lines.append(f"- Airflow note: {str(resolved['airflow_band_note']).removeprefix('Airflow band: ')}")
    if resolved.get("flags"):
        lines.append(
            f"- Notes: {'; '.join(FLAG_TEXT.get(f, f.replace('_', ' ')) for f in resolved['flags'])}"
        )
    if resolved["sources"]:
        lines.append("- Sources:")
        for s in resolved["sources"]:
            ref = f"{s['title']} ({s.get('doc_number') or s['ref_id']})"
            if s.get("url"):
                ref += f", {s['url']}"
            if s.get("page"):
                ref += f", {s['page']}"
            lines.append(f"  - {ref}")
            if s.get("quote"):
                lines.append(f'    - "{s["quote"]}"')
    else:
        lines.append("- Sources: none (you chose these conditions)")
    return "\n".join(lines)


VERDICT_PLAIN = {
    "supported": "covered by ISS tests",
    "extrapolation": "beyond the ISS tests",
    "insufficient_evidence": "not enough evidence",
}


def _coverage_section(a: dict[str, Any]) -> str:
    c = a["coverage"]
    n, k = c["n_target_points"], a["points_supported"]
    lines = [
        f"- Verdict: {VERDICT_PLAIN.get(a['verdict'], a['verdict'].replace('_', ' '))}; {k} of {n} points in "
        "this air are well covered",
        f"- Nearby ISS tests: {c['points_with_comparable']} of {n} points have at least one "
        f"({c['comparable_observations']} test results in all)",
        f'- Closest test: {_fmt(c["nn_distance_min"], 1)} reference distances away (our "nearby" unit); '
        f"typical {_fmt(c['nn_distance_median'], 1)}",
        f"- Inside the tested range: {100 * c['fraction_inside_hull']:.0f}% of this air",
    ]
    m = a.get("model") or {}
    if m.get("p_sustained_mean") is not None:
        lines.append(
            f"- Chance the flame kept burning, over the {k} covered points: "
            f"mean {_fmt(m['p_sustained_mean'], 2)} "
            f"(range {_fmt(m.get('p_sustained_min'), 2)}\u2013{_fmt(m.get('p_sustained_max'), 2)})"
        )
    if m.get("latent_std_ratio_mean") is not None:
        lines.append(
            "- Uncertainty left over the whole target: "
            f"{_fmt(m['latent_std_ratio_mean'], 2)} of the starting level"
        )
    why = [r for r in a["reasons"] if r["code"] != "point_verdicts"]
    if why:
        lines.append("- Why:")
        lines.extend(f"  - {r['message']}" for r in why)
    return "\n".join(lines)


def _model_section(group: dict[str, Any], group_id: str) -> str:
    gm = modeling.group_model(group_id)
    n = group["n_training"]
    lc = group["label_counts"]
    lines = [
        f"- Analysis group: {group['label']} ({group_id}); {group['n_experiments']} experiments, "
        f"{n} training observations ({lc['sustained']} sustained, {lc['not_sustained']} not sustained; "
        f"{100 * lc['sustained'] / n:.0f} % sustained)"
        if n
        else f"- Analysis group: {group['label']}",
    ]
    if gm is None:
        lines.append("- No model: too little data for this material; only coverage is shown.")
        return "\n".join(lines)
    ms = gm.metrics_summary
    lines.append(
        "- Model type: Gaussian-process classifier (it reports its own uncertainty); pressure length scale "
        f"fixed at {modeling.trained_pressure_length_scale(gm.model):g} (ln units)."  # type: ignore[arg-type]
    )
    gp, maj = ms.get("gp") or {}, ms.get("majority_class") or {}
    lines.append(
        f"- Check on held-out experiments ({ms.get('cv_scheme', 'grouped CV')}; lower is better except AUC): "
        f"model Brier {_metric(gp.get('brier'))}, log loss {_metric(gp.get('log_loss'))}, "
        f"AUC {_metric(gp.get('auc'))}, ECE {_metric(gp.get('ece'))}."
    )
    lines.append(
        "- Majority-class baseline (always guesses the common outcome): "
        f"Brier {_metric(maj.get('brier'))}, log loss "
        f"{_metric(maj.get('log_loss'))}, AUC {_metric(maj.get('auc'))}."
    )
    diff = ms.get("gp_vs_majority") or {}
    if diff:
        lines.append(
            "- Model minus baseline (negative means the model is better): "
            f"Brier {_metric(diff.get('brier'))}, "
            f"log loss {_metric(diff.get('log_loss'))}."
        )
    if ms.get("small_sample_warning"):
        lines.append(f"- Caution: {ms['small_sample_warning']}")
    val = _validation_group(group_id)
    if val:
        bt = val.get("blindspot_test") or {}
        if bt:
            bv = BLINDSPOT_VERDICT_TEXT.get(str(bt.get("verdict")), str(bt.get("verdict")))
            lines.append(
                f"- Does the model's uncertainty track its errors? {bv.capitalize()}. "
                f"{bt.get('interpretation', '')}".rstrip()
            )
    return "\n".join(lines)


_RANKED_RE = re.compile(
    r"^Ranked \d+ of (\d+) grid candidates by greedy batch expected uncertainty reduction\."
)


def _plain_assumption(text: str) -> str | None:
    """Plain wording for the ranking notes that read badly beside one candidate; others pass through."""
    m = _RANKED_RE.match(text)
    if m:
        return (
            f"We scored {m.group(1)} conditions on a grid by expected uncertainty reduction. "
            "Simple baselines (random, most uncertain, nearest gap) are scored the same way."
        )
    if text.startswith("Expected variance reduction (EVR)"):
        return (
            "Expected uncertainty reduction is how much one new hypothetical test would be expected to "
            "cut the model's uncertainty about the target (approximate; model settings held fixed)."
        )
    if text.startswith("Target airflow band "):
        return None  # already shown under Target
    return text


def _candidate_section(
    cand: dict[str, Any] | None,
    rank_res: dict[str, Any] | None,
    source: str,
    fractions: list[float] | None = None,
) -> str:
    if cand is None:
        return "No candidate is available (no model for this material, or no eligible candidate)."
    o2, p, u = cand["oxygen_percent"], cand["pressure_kpa"], cand["airflow_cm_s"]
    status = (
        "Inside the conditions ISS tests already ran"
        if cand["feasibility_status"] == "within_demonstrated_envelope"
        else "Outside the conditions ISS tests already ran"
    )
    lines = [
        f"- Research question: Would new test results at {o2:.1f}% O₂, {p:.1f} kPa and "
        f"{assess_mod.fmt_flow(u)} cm/s cut the model's uncertainty about this air? How much does the "
        "answer depend on the assumed pressure effect?",
        f"- Source of candidate: {source}.",
        f"- Expected uncertainty reduction: {100 * cand['evr_fraction']:.1f}% of the model's current "
        "uncertainty about this air (model-based, hypothetical).",
        f"- {cand['explanation']}",
        f"- Tested range: {status}. {cand['feasibility_note']}",
    ]
    for r in cand["reasons"]:
        if r["code"] == "expected_uncertainty_reduction":
            continue  # same number as the line above
        lines.append(f"  - {REASON_LABELS.get(r['code'], r['code'].replace('_', ' '))}: {r['message']}")
    if rank_res is not None:
        sens = rank_res["sensitivity"]
        if sens:
            changed = [s["pressure_length_scale"] for s in sens if not s["same_top_as_default"]]
            line = "- Pressure sensitivity (length scale 0.15 / 0.3 / 0.6): "
            if fractions:
                line += (
                    "uncertainty reduction here " + " / ".join(f"{100 * f:.1f}%" for f in fractions) + "; "
                )
            line += (
                "the top candidate stays the same."
                if not changed
                else "the top candidate changes at " + ", ".join(f"{c:g}" for c in changed) + "."
            )
            lines.append(line)
        lines.append("- Assumptions:")
        for a in rank_res["assumptions"]:
            note = _plain_assumption(a)
            if note:
                lines.append(f"  - {note}")
    if cand["related_documented_investigations"]:
        lines.append("- Related NASA work that may already cover this (not used by the model):")
        for r in cand["related_documented_investigations"]:
            lines.append(f"  - {r['name']}: {r['note']}")
    lines.append(f"- {ranking.DISCLAIMER}")
    return "\n".join(lines)


def _historical_section(a: dict[str, Any], store: deps.DataStore) -> str:
    near = a["coverage"]["nearest_observations"]
    if not near:
        return "No ISS test results exist for this material."
    lines = ["Closest ISS test results to this air (distance in reference distances):"]
    for o in near:
        exp = store.experiment_by_id.get(o["experiment_id"], {})
        inv, _, test = o["experiment_id"].partition(":")
        inv = exp.get("investigation_id", inv)
        label = {1: "flame kept burning", 0: "flame went out"}.get(o["label"], "not used by the model")
        lines.append(
            f"- {exp.get('investigation_acronym', inv)} test {test or o['experiment_id']}: "
            f"{o['oxygen_percent']:.1f}% O₂, {o['pressure_kpa']:.1f} kPa, {o['airflow_cm_s']:.2f} cm/s, "
            f"{label}, distance {o['distance']:.2f}"
        )
    rel = [
        r
        for r in a.get("investigation_relevance", [])
        if r["role"] != "catalogued_not_integrated"
        and (
            r.get("comparable_observations")
            or r.get("comparable_records_all_groups")
            or r.get("envelope_overlap") in ("contains_target_nominal", "overlaps_target_region")
        )
    ][:6]
    if rel:
        lines.append("Related investigations, closest first:")
        for r in rel:
            ref = f" ({r['url']})" if r.get("url") else ""
            lines.append(f"{r['relevance_rank']}. {r['name']}{ref}: {r['summary']}")
    return "\n".join(lines)


def _citations_section(resolved: dict[str, Any], a: dict[str, Any], store: deps.DataStore) -> str:
    lines = ["Datasets (NASA Physical Sciences Informatics, CC0):"]
    for i in store.investigations:
        if i.get("role") in ("integrated_model", "integrated_context") and i.get("doi"):
            lines.append(f"- {i['acronym']}: {i['title']}, doi:{i['doi']}, {i['landing_url']}")
    lines.append(
        "Sources for this air: listed under Target."
        if resolved["sources"]
        else "Sources for this air: none (you chose these conditions)."
    )
    if a["documented_context"]:
        lines.append("Related NASA work, not used by the model (context only):")
        by_id = {r["id"]: r for r in deps.not_integrated_records()}
        for d in a["documented_context"]:
            srcs = [q["url"] for q in by_id.get(d["id"], {}).get("sources", []) if q.get("url")]
            lines.append(f"- {d['name']}" + (f": {', '.join(sorted(set(srcs)))}" if srcs else ""))
    return "\n".join(lines)


def _limitations_section(group: dict[str, Any]) -> str:
    from blindspots.api.routes_data import _limitations

    items = _limitations(deps.get_store())
    items.append(
        f"Small sample: only {group['n_experiments']} experiments for this material, so uncertainty is wide "
        "and scores are unstable."
    )
    return "\n".join(f"- {x}" for x in items)


def build_brief(group_id: str, target: Target, candidate: Point | None) -> dict[str, Any]:
    store = deps.require_store()
    group = deps.get_group(group_id, store)
    resolved = resolve_target(target)
    a = assess_mod.assess(group_id, target)
    rank_res: dict[str, Any] | None = None
    cand: dict[str, Any] | None = None
    source = "none"
    fractions: list[float] | None = None
    if modeling.group_model(group_id) is not None:
        rank_res = ranking.rank(group_id, target, 3, 0.3)
        if candidate is None:
            if rank_res["status"] == "ok":
                cand = rank_res["candidates"][0]
                source = "top-ranked candidate (default assumptions)"
        else:
            cand = ranking.describe_point(group_id, target, candidate)
            source = "selected candidate"
            for c in rank_res["candidates"]:
                if all(
                    abs(float(c[k]) - float(getattr(candidate, k))) <= 1e-3
                    for k in ("oxygen_percent", "pressure_kpa", "airflow_cm_s")
                ):
                    source += f" (rank {c['rank']} under default assumptions)"
                    break
        if cand is not None:
            fractions = ranking.evr_fractions_by_setting(
                group_id, target, cand["oxygen_percent"], cand["pressure_kpa"], cand["airflow_cm_s"]
            )
    registry = deps.get_registry()
    model_version = registry.version if registry else None
    dataset_version = config.dataset_version()
    now = datetime.now(UTC)
    generated_at = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    title = f"Research brief: {group['label']} under {resolved.payload['label']}"
    sections = {
        "target": _target_section(resolved.payload),
        "coverage": _coverage_section(a),
        "model": _model_section(group, group_id),
        "candidate": _candidate_section(cand, rank_res, source, fractions),
        "historical_investigations": _historical_section(a, store),
        "citations": _citations_section(resolved.payload, a, store),
        "limitations": _limitations_section(group),
    }
    md = [
        f"# {title}",
        "",
        f"Generated {now.day} {now.strftime('%b %Y, %H:%M')} UTC. Dataset {dataset_version}. "
        f"Model {model_version}.",
        "",
        "## Target",
        sections["target"],
        "",
        "## Coverage of the target",
        sections["coverage"],
        "",
        "## Model",
        sections["model"],
        "",
        "## Candidate research question",
        sections["candidate"],
        "",
        "## Nearby ISS results and related NASA work",
        sections["historical_investigations"],
        "",
        "## Citations",
        sections["citations"],
        "",
        "## Limitations",
        sections["limitations"],
        "",
        "## Disclaimer",
        STANDARD_DISCLAIMER,
        "",
    ]
    return {
        "title": title,
        "generated_at": generated_at,
        "dataset_version": dataset_version,
        "model_version": model_version,
        "markdown": "\n".join(md),
        "sections": sections,
    }
