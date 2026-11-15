"""Deterministic research brief (markdown); computed from the same numbers as the other endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from blindspots import config
from blindspots.api import deps
from blindspots.api.models import Point, Target
from blindspots.api.services import assess as assess_mod
from blindspots.api.services import modeling, ranking
from blindspots.api.services.targets import resolve_target

STANDARD_DISCLAIMER = (
    "This brief describes computational research candidates derived from public NASA records. It requires "
    "qualified scientific review, established safety procedures and formal feasibility assessment. It is "
    "not endorsed or approved by NASA and is not a certified fire-safety assessment."
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


def _target_section(resolved: dict[str, Any]) -> str:
    o2, p, af = resolved["oxygen_percent"], resolved["total_pressure_kpa"], resolved["airflow_cm_s"]
    lines = [
        f"- Label: {resolved['label']} (status: {resolved['status']})",
        f"- Oxygen: nominal {o2['nominal']:g} % (min {o2['min']}, max {o2['max']})",
        f"- Total pressure: nominal {p['nominal']:g} kPa (min {p['min']}, max {p['max']})",
        f"- Airflow band: {af['min']:g}-{af['max']:g} cm/s, source: {resolved['airflow_band_source']}",
    ]
    if resolved.get("airflow_band_note"):
        lines.append(f"- Airflow note: {resolved['airflow_band_note']}")
    if resolved.get("flags"):
        lines.append(f"- Flags: {', '.join(resolved['flags'])}")
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
        lines.append("- Sources: none (user-selected hypothetical conditions)")
    return "\n".join(lines)


def _coverage_section(a: dict[str, Any]) -> str:
    c = a["coverage"]
    lines = [
        f"- Target points analysed: {c['n_target_points']}; with at least one comparable integrated "
        f"observation: {c['points_with_comparable']}; comparable observations: "
        f"{c['comparable_observations']}",
        f"- Nearest-observation distance (reference-scale units): minimum {_fmt(c['nn_distance_min'], 2)}, "
        f"median {_fmt(c['nn_distance_median'], 2)}; fraction inside the observed hull: "
        f"{_fmt(c['fraction_inside_hull'], 2)}",
        f"- Evidence verdict: {a['verdict'].replace('_', ' ')}",
    ]
    for r in a["reasons"]:
        lines.append(f"  - {r['code']}: {r['message']}")
    lines.append(f"- Summary: {a['summary']}")
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
        lines.append("- No model: insufficient data for this group; only coverage is shown.")
        return "\n".join(lines)
    ms = gm.metrics_summary
    lines.append(
        "- Algorithm: Gaussian-process classifier (logit link, Laplace approximation, ARD "
        "squared-exponential "
        f"kernel, MAP-II hyperparameters); pressure length scale fixed at "
        f"{modeling.trained_pressure_length_scale(gm.model):g} (ln units)."  # type: ignore[arg-type]
    )
    gp, maj = ms.get("gp") or {}, ms.get("majority_class") or {}
    lines.append(
        f"- Grouped cross-validation by experiment ({ms.get('cv_scheme', 'grouped CV')}): "
        f"GP Brier {_metric(gp.get('brier'))}, log loss {_metric(gp.get('log_loss'))}, "
        f"AUC {_metric(gp.get('auc'))}, ECE {_metric(gp.get('ece'))}."
    )
    lines.append(
        f"- Majority-class baseline: Brier {_metric(maj.get('brier'))}, log loss "
        f"{_metric(maj.get('log_loss'))}, AUC {_metric(maj.get('auc'))}."
    )
    diff = ms.get("gp_vs_majority") or {}
    if diff:
        lines.append(
            f"- GP minus majority baseline (negative favours the GP): Brier {_metric(diff.get('brier'))}, "
            f"log loss {_metric(diff.get('log_loss'))}."
        )
    if ms.get("small_sample_warning"):
        lines.append(f"- Caution: {ms['small_sample_warning']}")
    val = _validation_group(group_id)
    if val:
        bt = val.get("blindspot_test") or {}
        if bt:
            lines.append(f"- Uncertainty-vs-error check: {bt.get('verdict')}. {bt.get('interpretation', '')}")
    return "\n".join(lines)


def _candidate_section(cand: dict[str, Any] | None, rank_res: dict[str, Any] | None, source: str) -> str:
    if cand is None:
        return "No candidate is available (no model for this group, or no eligible candidate)."
    o2, p, u = cand["oxygen_percent"], cand["pressure_kpa"], cand["airflow_cm_s"]
    lines = [
        f"- Research question: Would additional evidence at O2 {o2:g} %, {p:g} kPa and {u:g} cm/s "
        "materially change the estimated probability of sustained flame propagation over the target "
        "region, and how sensitive is that estimate to the assumed pressure correlation?",
        f"- Source of candidate: {source}.",
        f"- Expected information value: an expected reduction of {100 * cand['evr_fraction']:.1f} % of the "
        "weighted latent variance over the target region (model-based, hypothetical).",
        f"- {cand['explanation']}",
        f"- Demonstrated-envelope status: {cand['feasibility_status'].replace('_', ' ')}. "
        f"{cand['feasibility_note']}",
    ]
    for r in cand["reasons"]:
        lines.append(f"  - {r['code']}: {r['message']}")
    if rank_res is not None:
        sens = rank_res["sensitivity"]
        if sens:
            changed = [s["pressure_length_scale"] for s in sens if not s["same_top_as_default"]]
            lines.append(
                "- Pressure sensitivity (length scale 0.15 / 0.3 / 0.6): "
                + (
                    "the top-ranked candidate is unchanged."
                    if not changed
                    else "the top-ranked candidate changes at " + ", ".join(f"{c:g}" for c in changed) + "."
                )
            )
        lines.append("- Assumptions:")
        for a in rank_res["assumptions"]:
            lines.append(f"  - {a}")
    if cand["related_documented_investigations"]:
        lines.append("- Documented investigations that may already inform this condition:")
        for r in cand["related_documented_investigations"]:
            lines.append(f"  - {r['name']}: {r['note']}")
    lines.append(f"- {ranking.DISCLAIMER}")
    return "\n".join(lines)


def _historical_section(a: dict[str, Any], store: deps.DataStore) -> str:
    inv_url = {i["investigation_id"]: i["landing_url"] for i in store.investigations}
    near = a["coverage"]["nearest_observations"]
    if not near:
        return "No integrated observations exist for this analysis group."
    lines = ["Nearest integrated observations to the target region (standardized distance):"]
    for o in near:
        exp = store.experiment_by_id.get(o["experiment_id"], {})
        inv = exp.get("investigation_id", o["experiment_id"].split(":")[0])
        label = {1: "flame sustained", 0: "flame not sustained"}.get(o["label"], "label unknown")
        lines.append(
            f"- {o['experiment_id']} ({exp.get('investigation_acronym', inv)}): "
            f"O2 {o['oxygen_percent']:.1f} %, {o['pressure_kpa']:.1f} kPa, {o['airflow_cm_s']:.2f} cm/s, "
            f"{label}, distance {o['distance']:.2f}; "
            f"{inv_url.get(inv, config.PSI_LANDING_URL.format(id=inv))}"
        )
    return "\n".join(lines)


def _citations_section(resolved: dict[str, Any], a: dict[str, Any], store: deps.DataStore) -> str:
    lines = ["Datasets (NASA Physical Sciences Informatics, CC0):"]
    for i in store.investigations:
        if i.get("role") in ("integrated_model", "integrated_context") and i.get("doi"):
            lines.append(f"- {i['acronym']}: {i['title']}, doi:{i['doi']}, {i['landing_url']}")
    lines.append("Target profile sources:")
    seen: set[tuple[str, str | None]] = set()
    for s in resolved["sources"]:
        if (s["title"], s.get("url")) in seen:
            continue
        seen.add((s["title"], s.get("url")))
        lines.append(f"- {s['title']}" + (f", {s['url']}" if s.get("url") else ""))
    if not resolved["sources"]:
        lines.append("- none (user-selected hypothetical conditions)")
    if a["documented_context"]:
        lines.append("Documented investigations not integrated (context only):")
        by_id = {r["id"]: r for r in deps.not_integrated_records()}
        for d in a["documented_context"]:
            srcs = [q["url"] for q in by_id.get(d["id"], {}).get("sources", []) if q.get("url")]
            lines.append(f"- {d['name']}" + (f": {', '.join(sorted(set(srcs)))}" if srcs else ""))
    return "\n".join(lines)


def _limitations_section(group: dict[str, Any]) -> str:
    from blindspots.api.routes_data import _limitations

    items = _limitations(deps.get_store())
    items.append(
        f"Small samples: this group has {group['n_experiments']} experiments; uncertainty is wide and "
        "validation metrics are unstable."
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
    if modeling.group_model(group_id) is not None:
        if candidate is None:
            rank_res = ranking.rank(group_id, target, 3, 0.3)
            if rank_res["status"] == "ok":
                cand = rank_res["candidates"][0]
                source = "top-ranked candidate (default assumptions)"
        else:
            cand = ranking.describe_point(group_id, target, candidate)
            source = "user-selected candidate"
            rank_res = None
    registry = deps.get_registry()
    model_version = registry.version if registry else None
    dataset_version = config.dataset_version()
    generated_at = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    title = f"Research brief: {group['label']} under {resolved.payload['label']}"
    sections = {
        "target": _target_section(resolved.payload),
        "coverage": _coverage_section(a),
        "model": _model_section(group, group_id),
        "candidate": _candidate_section(cand, rank_res, source),
        "historical_investigations": _historical_section(a, store),
        "citations": _citations_section(resolved.payload, a, store),
        "limitations": _limitations_section(group),
    }
    md = [
        f"# {title}",
        "",
        f"Generated: {generated_at}. Dataset version: {dataset_version}. Model version: {model_version}.",
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
        "## Relevant historical investigations",
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
