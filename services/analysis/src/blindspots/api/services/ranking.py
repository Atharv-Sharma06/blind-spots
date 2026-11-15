"""Candidate ranking, comparison and counterfactuals (docs/API.md), all deterministic."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any

import numpy as np

from blindspots import config
from blindspots.acquisition.batch import JointPosterior, candidate_record, greedy_from
from blindspots.acquisition.candidates import STATUS_TEXT, CandidateSet, build_candidates
from blindspots.acquisition.counterfactual import counterfactual
from blindspots.acquisition.evr import expected_target_mi_reduction
from blindspots.acquisition.targets import target_points
from blindspots.api import deps
from blindspots.api.errors import ApiError
from blindspots.api.models import Target
from blindspots.api.services import context as ctxmod
from blindspots.api.services import modeling
from blindspots.api.services.assess import BAND_SOURCE_TEXT, fmt_flow
from blindspots.api.services.targets import ResolvedSpec, resolve_target
from blindspots.coverage.coverage import SCALES, standardized_distances, to_coords
from blindspots.coverage.grid import DEFAULT_SLICE
from blindspots.models.gp_laplace import GPLaplaceClassifier
from blindspots.models.registry import GroupModel

DISCLAIMER = (
    "Computational research candidate requiring qualified scientific review, established safety "
    "procedures and formal feasibility assessment."
)
CANDIDATE_DOMAIN = {
    "oxygen_percent": [12.0, 40.0],
    "pressure_kpa": [50.0, 103.0],
    "airflow_cm_s": [0.5, 45.0],
}
ASSUMPTION_DEPENDENT_THRESHOLD = 0.5  # relative EVR-fraction change across the pressure sensitivity settings
INDISTINGUISHABLE_TOLERANCE = 0.15  # relative EVR difference below which two candidates are not separated
HIGH_COVARIANCE_CORR = 0.5
HIGH_UNCERTAINTY_RATIO = 0.85
BOUNDARY_P_RANGE = (0.3, 0.7)
GAP_NN_DISTANCE = 1.0
AT_TARGET_DISTANCE = 1.0  # reference distances from the nearest target point (LEAD_DECISIONS D4)
MIN_INFORMATIVE_FRACTION = 1e-4  # below this the best candidate carries no usable information
ROUND = 4


def canonical(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), default=str)


def request_seed(obj: Any) -> int:
    return int(hashlib.sha256(canonical(obj).encode()).hexdigest()[:8], 16)


@dataclass
class Ctx:
    group_id: str
    gm: GroupModel
    model: GPLaplaceClassifier
    lp: float
    resolved: ResolvedSpec
    t: np.ndarray
    w: np.ndarray
    evidence: np.ndarray

    @property
    def spec(self) -> Any:
        return self.resolved.spec


def build_ctx(group_id: str, target: Target, lp: float) -> Ctx | None:
    """Context for a modelled group, or None when the group has no model."""
    deps.get_group(group_id)  # 404 for unknown groups
    resolved = resolve_target(target)
    gm = modeling.group_model(group_id)
    if gm is None:
        return None
    model = modeling.model_for_lp(gm, lp)
    t, w = target_points(resolved.spec)
    return Ctx(group_id, gm, model, lp, resolved, t, w, modeling.evidence_coords(gm.model))  # type: ignore[arg-type]


def require_ctx(group_id: str, target: Target, lp: float = 0.3) -> Ctx:
    ctx = build_ctx(group_id, target, lp)
    if ctx is None:
        g = deps.get_group(group_id)
        raise ApiError(
            422,
            "validation_error",
            f"Group {group_id!r} has no model ({g.get('model_reason') or 'insufficient data'}).",
            {"group_id": group_id, "model_status": g["model_status"]},
        )
    return ctx


# --- candidate payloads ----------------------------------------------------------------------------


def _r(x: float | None, nd: int = ROUND) -> float | None:
    return None if x is None else round(float(x), nd)


def _pct(x: float) -> str:
    return f"{100 * x:.1f} %"


def _reason(code: str, message: str, value: float | None) -> dict[str, Any]:
    return {"code": code, "message": message, "value": _r(value, 4)}


def _candidate_stats(
    model: GPLaplaceClassifier, t: np.ndarray, w: np.ndarray, x: np.ndarray
) -> dict[str, float]:
    """Model summaries at one candidate (analysis coordinates, shape (1, 3))."""
    u = model.uncertainty(x)
    cross = np.asarray(model.latent_cov(t, x))[:, 0]
    var_t = np.asarray(model.latent(t)[1])
    var_c = float(np.asarray(model.latent(x)[1])[0])
    corr = float((w * np.abs(cross) / np.sqrt(var_t * var_c)).sum())
    mi = expected_target_mi_reduction(model, t, x, w)
    mi_frac = float(mi["reduction"][0] / mi["mi_before"]) if mi["mi_before"] > 0 else 0.0
    ratio = np.asarray(u["latent_std_ratio"])
    ev = modeling.explain_points(
        x, modeling.evidence_coords(model), ratio, np.asarray(u["aleatoric"]), np.asarray(u["total"])
    )
    return {
        "p": float(u["p_mean"][0]),
        "ratio": float(ratio[0]),
        "corr": corr,
        "mi_frac": mi_frac,
        "verdict": ev["verdict"][0],
        "target_d": float(standardized_distances(x, t).min()),
    }


def spread(values: list[float]) -> float:
    hi = max(values)
    return (hi - min(values)) / hi if hi > 0 else 0.0


def build_candidate(
    ctx: Ctx,
    model: GPLaplaceClassifier,
    rec: dict[str, Any],
    *,
    cid: str,
    rank: int | None,
    fractions_by_setting: list[float] | None = None,
    n_grid: int | None = None,
) -> dict[str, Any]:
    o2, p, u = rec["o2"], rec["pressure_kpa"], rec["airflow_cm_s"]
    x = to_coords(o2, p, u)
    st = _candidate_stats(model, ctx.t, ctx.w, x)
    nn = rec["reasons"]["coverage_nn_d"]
    # P(sustained) only where the candidate point itself is supported (LEAD_DECISIONS D2); elsewhere the
    # prediction mostly reverts to the training base rate (fixed pressure length scale).
    p_supported = st["verdict"] == "supported"
    frac, marg = rec["standalone_fraction"], rec["marginal_fraction"]
    reasons: list[dict[str, Any]] = []
    if rank == 1:
        msg = (
            f"Highest expected uncertainty reduction over the target among the {n_grid} grid candidates: "
            f"{_pct(frac)} of the target's current latent variance."
            if n_grid
            else f"Highest expected uncertainty reduction over the target: {_pct(frac)}."
        )
    elif rank is not None:
        msg = (
            f"Largest additional expected uncertainty reduction after the higher-ranked picks: {_pct(marg)} "
            f"({_pct(frac)} on its own)."
        )
    else:
        msg = f"Expected uncertainty reduction over the target if this condition were tested: {_pct(frac)}."
    reasons.append(_reason("expected_uncertainty_reduction", msg, frac))
    if st["target_d"] <= AT_TARGET_DISTANCE:
        reasons.append(
            _reason(
                "at_target_conditions",
                (
                    "This condition lies within one reference distance of the target conditions. The most "
                    "informative single experiment is at the target conditions themselves; this follows "
                    "from the model's distance-based (stationary) correlation assumption."
                    if rank == 1
                    else "This condition lies within one reference distance of the target conditions; the "
                    "model's distance-based (stationary) correlation assumption favours conditions at the "
                    "target itself."
                ),
                st["target_d"],
            )
        )
    if st["corr"] >= HIGH_COVARIANCE_CORR:
        reasons.append(
            _reason(
                "high_target_covariance",
                f"Weighted mean posterior correlation with the target region is {st['corr']:.2f}, so an "
                "outcome here would inform the target.",
                st["corr"],
            )
        )
    if st["ratio"] >= HIGH_UNCERTAINTY_RATIO:
        reasons.append(
            _reason(
                "high_candidate_uncertainty",
                f"The latent standard deviation is {st['ratio']:.2f} of its prior value (little evidence "
                "constrains this condition).",
                st["ratio"],
            )
        )
    if p_supported and BOUNDARY_P_RANGE[0] <= st["p"] <= BOUNDARY_P_RANGE[1]:
        reasons.append(
            _reason(
                "near_decision_boundary",
                f"The estimated probability of a sustained flame is {st['p']:.2f}, near the uncertain "
                "region between outcomes.",
                st["p"],
            )
        )
    if nn is not None and nn > GAP_NN_DISTANCE:
        reasons.append(
            _reason(
                "fills_coverage_gap",
                f"The nearest integrated observation is {nn:.1f} reference distances away (more than "
                f"{GAP_NN_DISTANCE:g}).",
                nn,
            )
        )
    dependent = False
    if fractions_by_setting:
        s = spread(fractions_by_setting)
        if s > ASSUMPTION_DEPENDENT_THRESHOLD:
            dependent = True
            reasons.append(
                _reason(
                    "assumption_dependent",
                    f"The expected variance reduction changes by {100 * s:.0f} % across the pressure "
                    "length-scale settings (0.15, 0.3, 0.6), so its value depends mainly on the assumed "
                    "pressure correlation.",
                    s,
                )
            )
    name = "The selected candidate" if cid == "selected" else f"Candidate {cid}"
    sentence = (
        f"{name} ({o2:.1f}% O₂, {p:.1f} kPa, {fmt_flow(u)} cm/s) has an expected uncertainty reduction of "
        f"{_pct(frac)} of the weighted latent variance over the target region"
    )
    if rank is not None and rank > 1:
        sentence += f" ({_pct(marg)} after the higher-ranked picks)"
    if p_supported:
        sentence += (
            f"; the model estimates P(sustained) = {st['p']:.2f} with remaining uncertainty (latent std "
            f"ratio) {st['ratio']:.2f}"
        )
    else:
        sentence += (
            "; no P(sustained) estimate is given because this condition is not supported by the integrated "
            f"evidence (remaining uncertainty, latent std ratio, {st['ratio']:.2f})"
        )
    sentence += (
        f" and the nearest integrated observation is {nn:.1f} reference distances away."
        if nn is not None
        else "."
    )
    if dependent:
        sentence += " This value depends mainly on the assumed pressure correlation."
    status = rec["feasibility_status"]
    return {
        "candidate_id": cid,
        "rank": rank,
        "oxygen_percent": _r(o2),
        "pressure_kpa": _r(p),
        "airflow_cm_s": _r(u),
        "evr": _r(rec["standalone_evr"], 6),
        "evr_fraction": _r(frac, 6),
        "marginal_evr_fraction": _r(marg, 6),
        "mi_reduction_fraction": _r(st["mi_frac"], 6),
        "p_sustained": _r(st["p"], 4) if p_supported else None,
        "latent_std_ratio": _r(st["ratio"], 4),
        "nn_distance": _r(nn, 3),
        "verdict": st["verdict"],
        "target_distance": _r(st["target_d"], 3),
        "feasibility_status": status,
        "feasibility_note": STATUS_TEXT[status],
        "reasons": reasons,
        "explanation": sentence,
        "related_documented_investigations": ctxmod.related_to_candidate(o2, p, u),
    }


# --- posterior sweeps ------------------------------------------------------------------------------


def candidate_set(ctx: Ctx) -> CandidateSet:
    """Candidate grid; the target pressure joins the grid only when no grid pressure is within 1 kPa.

    (Adding e.g. 56.54 next to 56.5 would create near-duplicate candidates that the greedy batch then
    picks as separate points.)
    """
    from blindspots.acquisition.candidates import PRESSURE_GRID_KPA

    p = ctx.spec.pressure_nominal_kpa
    extra = None if min(abs(p - q) for q in PRESSURE_GRID_KPA) <= 1.0 else p
    return build_candidates(ctx.evidence, target_pressure_kpa=extra)


def _assumptions(ctx: Ctx) -> list[str]:
    lo, hi = modeling.observed_pressure_range_kpa(ctx.model)
    spec = ctx.spec
    out = [
        f"The GP pressure length scale is fixed at {ctx.lp:g} (ln-pressure units) and cannot be learned: "
        + (
            f"all training observations of this group sit at {lo:.1f} kPa. "
            if f"{lo:.1f}" == f"{hi:.1f}"
            else f"the training observations of this group span only {lo:.1f}\u2013{hi:.1f} kPa. "
        )
        + "Any candidate or prediction at other pressures is assumption-driven.",
        "Expected variance reduction (EVR) is the expected drop in the weighted latent variance over the "
        "target region from one hypothetical new observation, as a fraction of the current variance "
        "(Gaussian surrogate of the Laplace posterior; hyperparameters held fixed).",
        f"Target airflow band {fmt_flow(spec.airflow_min_cm_s)}\u2013{fmt_flow(spec.airflow_max_cm_s)} cm/s "
        f"({BAND_SOURCE_TEXT.get(spec.airflow_band_source, 'analysis band')}).",
        "The model's correlation depends only on the distance between conditions (a stationary kernel whose "
        "length scales were learned near 1 atm); away from the data the ranking follows this assumption.",
    ]
    note = ctx.resolved.payload.get("airflow_band_note")
    if note:
        text = str(note).removeprefix("Airflow band: ")
        out.append(text[:1].upper() + text[1:])
    for flag in ctx.resolved.flags:
        if flag == "documented_upper_bound_used":
            out.append(
                "The target oxygen nominal is not documented; the documented upper bound is analysed "
                "(higher O₂ is the worst case for flammability)."
            )
        elif flag in ("documented_bound_used", "documented_lower_bound_used"):
            out.append("A documented bound is used where no nominal value exists.")
    d = CANDIDATE_DOMAIN
    out.append(
        f"Candidate domain: O2 {d['oxygen_percent'][0]:g}-{d['oxygen_percent'][1]:g} %, pressure "
        f"{d['pressure_kpa'][0]:g}-{d['pressure_kpa'][1]:g} kPa, airflow "
        f"{d['airflow_cm_s'][0]:g}-{d['airflow_cm_s'][1]:g} cm/s (an analysis grid, not a test envelope)."
    )
    tp = spec.pressure_nominal_kpa
    if not d["pressure_kpa"][0] <= tp <= d["pressure_kpa"][1]:
        out.append(
            f"The target pressure ({tp:g} kPa) lies outside the candidate pressure domain; candidates at "
            "that pressure are added to the grid so the target pressure itself can be probed."
        )
    if not d["oxygen_percent"][0] <= spec.o2_nominal <= d["oxygen_percent"][1]:
        out.append(
            f"The target oxygen level ({spec.o2_nominal:g} %) lies outside the candidate oxygen domain; "
            "candidates cannot reach it, so their correlation with the target region is weak."
        )
    reg = modeling.full_registry()
    cur = config.dataset_version()
    if cur is not None and reg.dataset_version != cur:
        out.append(
            f"Version note: the model was trained on dataset {reg.dataset_version}; the current dataset is "
            f"{cur}. Retrain to align them."
        )
    return out


# --- rank ------------------------------------------------------------------------------------------


def rank(group_id: str, target: Target, k: int, lp: float) -> dict[str, Any]:
    deps.get_group(group_id)
    resolved = resolve_target(target)
    base = {
        "group_id": group_id,
        "target": resolved.payload,
        "candidate_domain": CANDIDATE_DOMAIN,
        "disclaimer": DISCLAIMER,
    }
    ctx = build_ctx(group_id, target, lp)
    if ctx is None:
        g = deps.get_group(group_id)
        return {
            **base,
            "status": "model_unavailable",
            "candidates": [],
            "baselines": None,
            "sensitivity": [],
            "assumptions": [
                f"No model is available for {group_id} ({g.get('model_reason') or 'insufficient data'}); "
                "candidates cannot be ranked. Coverage is still shown."
            ],
        }
    cs = candidate_set(ctx)
    if len(cs) == 0:
        return {
            **base,
            "status": "no_eligible_candidates",
            "candidates": [],
            "baselines": None,
            "sensitivity": [],
            "assumptions": _assumptions(ctx),
        }
    settings = sorted({*modeling.PRESSURE_LS_SENSITIVITY, ctx.lp})
    fractions: dict[float, np.ndarray] = {}
    sens_models: dict[float, GPLaplaceClassifier] = {}
    tops: dict[float, dict[str, Any]] = {}
    jp_default: JointPosterior | None = None
    default_picks: list[dict[str, Any]] = []
    for s in settings:
        m = ctx.model if abs(s - ctx.lp) < 1e-12 else modeling.model_for_lp(ctx.gm, s)
        sens_models[s] = m
        jp = JointPosterior(m, ctx.t, cs.X, ctx.w)
        if jp.total0 <= 0:
            return {
                **base,
                "status": "no_eligible_candidates",
                "candidates": [],
                "baselines": None,
                "sensitivity": [],
                "assumptions": _assumptions(ctx),
            }
        gains = jp.evr(None)
        fractions[s] = gains / jp.total0
        if abs(s - ctx.lp) < 1e-12 and float(np.max(gains)) / jp.total0 < MIN_INFORMATIVE_FRACTION:
            return {
                **base,
                "status": "no_informative_candidates",
                "candidates": [],
                "baselines": None,
                "sensitivity": [],
                "assumptions": [
                    "No candidate in the analysis grid is expected to reduce the target region's latent "
                    f"variance by more than {100 * MIN_INFORMATIVE_FRACTION:g} %: the target conditions "
                    "are effectively uncorrelated with every candidate under the model, so ranking would "
                    "only reflect tie-breaking.",
                    *_assumptions(ctx),
                ],
            }
        top_i = int(np.argmax(gains))
        if abs(s - ctx.lp) < 1e-12:
            jp_default = jp
            picks = greedy_from(jp, cs, k)
        else:
            picks = [candidate_record(jp, cs, top_i, 1, float(gains[top_i]), "greedy_evr")]
        tops[s] = picks[0]
        if abs(s - ctx.lp) < 1e-12:
            default_picks = picks
    assert jp_default is not None

    def dep_fracs(i: int) -> list[float]:
        return [float(fractions[s][i]) for s in settings]

    candidates = [
        build_candidate(
            ctx,
            ctx.model,
            rec,
            cid=f"c{rec['rank']}",
            rank=rec["rank"],
            fractions_by_setting=dep_fracs(rec["candidate_index"]),
            n_grid=len(cs),
        )
        for rec in default_picks
    ]
    # baselines, scored with the same standalone EVR fraction. Kept inline rather than calling
    # acquisition.baselines: its random baseline draws with rng.choice (a different index for the same
    # seed than rng.integers here), so switching would change published rankings.
    seed = request_seed({"g": group_id, "t": target.model_dump(), "k": k, "lp": lp})
    rng = np.random.default_rng(seed)
    baseline_idx: dict[str, int | None] = {
        "random": int(rng.integers(len(cs))),
        "uncertainty_sampling": int(np.argmax(np.asarray(ctx.model.uncertainty(cs.X)["epistemic"]))),
    }
    eligible = np.flatnonzero(cs.nn_d > 1.0)
    if len(eligible):
        centroid = ctx.t.mean(axis=0)
        d = np.linalg.norm((cs.X[eligible] - centroid) / SCALES, axis=1)
        baseline_idx["nearest_gap"] = int(eligible[int(np.argmin(d))])
    else:
        baseline_idx["nearest_gap"] = None
    baselines: dict[str, Any] = {}
    for name, i in baseline_idx.items():
        if i is None:
            baselines[name] = None
            continue
        rec = candidate_record(jp_default, cs, i, 1, jp_default.evr_initial(i), name)
        rec["candidate_index"] = i
        baselines[name] = build_candidate(
            ctx, ctx.model, rec, cid=name, rank=None, fractions_by_setting=dep_fracs(i)
        )
    default_top = default_picks[0]["candidate_index"]
    sensitivity = []
    for s in modeling.PRESSURE_LS_SENSITIVITY:
        rec = tops[s]
        sensitivity.append(
            {
                "pressure_length_scale": s,
                "top_candidate": build_candidate(ctx, sens_models[s], rec, cid=f"c1@lp{s:g}", rank=1),
                "same_top_as_default": bool(rec["candidate_index"] == default_top),
            }
        )
    notes = _assumptions(ctx)
    changed = [e["pressure_length_scale"] for e in sensitivity if not e["same_top_as_default"]]
    top_c = candidates[0]
    at_target_pressure = abs(float(top_c["pressure_kpa"]) - ctx.spec.pressure_nominal_kpa) <= 1.0
    notes.append(
        (
            "Top candidate is unchanged across pressure length scales 0.15 / 0.3 / 0.6 (it sits at the "
            "target pressure, so this check is uninformative here)."
            if at_target_pressure
            else "Top candidate is unchanged across pressure length scales 0.15 / 0.3 / 0.6."
        )
        if not changed
        else "The top candidate changes under pressure length scale(s) "
        + ", ".join(f"{c:g}" for c in changed)
        + " (see sensitivity)."
    )
    if all(c["rank"] is not None for c in candidates):
        notes.append(
            f"Ranked {len(candidates)} of {len(cs)} grid candidates by greedy batch expected uncertainty "
            "reduction. Baselines (random, seeded by a hash of the request; uncertainty sampling; nearest "
            "gap) are scored with the same measure: the expected reduction if that baseline's pick were "
            "tested instead."
        )
    return {
        **base,
        "status": "ok",
        "candidates": candidates,
        "baselines": baselines,
        "sensitivity": sensitivity,
        "assumptions": notes,
    }


# --- compare ---------------------------------------------------------------------------------------


def compare(group_id: str, target: Target, a: Any, b: Any) -> dict[str, Any]:
    ctx = require_ctx(group_id, target)
    raw = np.array(
        [
            [a.oxygen_percent, a.pressure_kpa, a.airflow_cm_s],
            [b.oxygen_percent, b.pressure_kpa, b.airflow_cm_s],
        ]
    )
    cs = build_candidates(ctx.evidence, raw=raw)

    def fractions(model: GPLaplaceClassifier) -> tuple[float, float, float]:
        jp = JointPosterior(model, ctx.t, cs.X, ctx.w)
        fa, fb = jp.evr_initial(0) / jp.total0, jp.evr_initial(1) / jp.total0
        jp.downdate(0)
        both = fa + float(jp.evr(np.array([1]))[0]) / jp.total0
        return fa, fb, both

    fa, fb, both = fractions(ctx.model)
    by_setting = {s: fractions(modeling.model_for_lp(ctx.gm, s)) for s in modeling.PRESSURE_LS_SENSITIVITY}

    def rec_for(i: int, jp: JointPosterior) -> dict[str, Any]:
        rec = candidate_record(jp, cs, i, 1, jp.evr_initial(i), "compare")
        rec["candidate_index"] = i
        return rec

    jp0 = JointPosterior(ctx.model, ctx.t, cs.X, ctx.w)
    fa_list = [fa, *[v[0] for v in by_setting.values()]]
    fb_list = [fb, *[v[1] for v in by_setting.values()]]
    cand_a = build_candidate(
        ctx, ctx.model, rec_for(0, jp0), cid="a", rank=None, fractions_by_setting=fa_list
    )
    cand_b = build_candidate(
        ctx, ctx.model, rec_for(1, jp0), cid="b", rank=None, fractions_by_setting=fb_list
    )
    top = max(fa, fb)
    rel = abs(fa - fb) / top if top > 0 else 0.0
    prefs = {("a" if x > y else "b" if y > x else "tie") for x, y in zip(fa_list, fb_list, strict=True)}
    flips = len(prefs) > 1
    reasons: list[dict[str, Any]] = [
        _reason(
            "relative_evr_difference",
            f"EVR fractions are {_pct(fa)} (a) and {_pct(fb)} (b); relative difference {100 * rel:.0f} % "
            f"(candidates are not separated below {100 * INDISTINGUISHABLE_TOLERANCE:.0f} %).",
            rel,
        )
    ]
    if flips:
        reasons.append(
            _reason(
                "preference_flips_under_sensitivity",
                "The preferred candidate changes across pressure length-scale settings 0.15 / 0.3 / 0.6.",
                None,
            )
        )
    preferred = "a" if fa > fb else "b"
    if rel < INDISTINGUISHABLE_TOLERANCE or flips:
        preferred = "indistinguishable"
    return {
        "a": cand_a,
        "b": cand_b,
        "both_evr_fraction": _r(both, 6),
        "preferred": preferred,
        "reasons": reasons,
        "assumptions": _assumptions(ctx),
    }


def describe_point(group_id: str, target: Target, point: Any, cid: str = "selected") -> dict[str, Any]:
    """Full candidate payload for one user-chosen point (no rank)."""
    ctx = require_ctx(group_id, target)
    raw = np.array([[point.oxygen_percent, point.pressure_kpa, point.airflow_cm_s]])
    cs = build_candidates(ctx.evidence, raw=raw)
    jp = JointPosterior(ctx.model, ctx.t, cs.X, ctx.w)
    rec = candidate_record(jp, cs, 0, 1, jp.evr_initial(0), "selected")
    return build_candidate(ctx, ctx.model, rec, cid=cid, rank=None)


def evr_fractions_by_setting(
    group_id: str, target: Target, o2: float, pressure_kpa: float, airflow_cm_s: float
) -> list[float]:
    """Standalone expected uncertainty reduction at one point under pressure length scales 0.15/0.3/0.6."""
    from blindspots.acquisition.evr import evr_fraction

    ctx = require_ctx(group_id, target)
    x = to_coords(o2, pressure_kpa, airflow_cm_s)
    return [
        float(evr_fraction(modeling.model_for_lp(ctx.gm, s), ctx.t, x, ctx.w)[0])
        for s in modeling.PRESSURE_LS_SENSITIVITY
    ]


# --- counterfactual --------------------------------------------------------------------------------


def _scenario_surface(
    model: GPLaplaceClassifier,
    plane: str,
    slice_value: float | None,
    x_min: float | None = None,
    x_max: float | None = None,
) -> dict[str, Any]:
    from blindspots.api.routes_data import resolve_plane_params

    p = resolve_plane_params(plane, slice_value, 61, 41, x_min, x_max, None, None)
    x0, x1 = p["x_range"]
    y0, y1 = p["y_range"]
    xs = np.linspace(x0, x1, 61)
    if plane == "o2_flow":
        ys = np.geomspace(y0, y1, 41)
        gx, gy = np.meshgrid(xs, ys)
        pts = to_coords(gx.ravel(), p["slice_value"], gy.ravel())
    else:
        ys = np.linspace(y0, y1, 41)
        gx, gy = np.meshgrid(xs, ys)
        pts = to_coords(gx.ravel(), gy.ravel(), p["slice_value"])
    u = model.uncertainty(pts)
    shape = gx.shape
    return {
        "p_sustained": np.round(np.asarray(u["p_mean"]).reshape(shape), 3).tolist(),
        "latent_std_ratio": np.round(np.asarray(u["latent_std_ratio"]).reshape(shape), 3).tolist(),
    }


def counterfactual_response(
    group_id: str,
    target: Target,
    cand: Any,
    plane: str | None,
    slice_value: float | None,
    x_min: float | None = None,
    x_max: float | None = None,
) -> dict[str, Any]:
    if plane is not None:
        from blindspots.api.routes_data import resolve_plane_params

        # Validate the axis parameters before any model work (422 on bad ranges).
        resolve_plane_params(plane, slice_value, 61, 41, x_min, x_max, None, None)
    ctx = require_ctx(group_id, target)
    x = to_coords(cand.oxygen_percent, cand.pressure_kpa, cand.airflow_cm_s)
    res = counterfactual(ctx.model, x, ctx.t, ctx.w)
    cur = res["current"]
    var0 = cur["target_latent_var"]
    scenarios = []
    for s in res["scenarios"]:
        outcome = "sustained" if s["outcome"] == 1 else "not_sustained"
        surface = None
        if plane is not None:
            m2 = ctx.model.condition_on(x, np.array([s["outcome"]]))
            surface = _scenario_surface(m2, plane, slice_value, x_min, x_max)
        scenarios.append(
            {
                "outcome": outcome,
                "label": "Hypothetical outcome: flame "
                + ("sustained" if s["outcome"] == 1 else "not sustained"),
                "probability": s["probability"],
                "target_p_mean": s["target_p_mean"],
                "target_latent_var": s["target_latent_var"],
                "target_epistemic": s["target_epistemic_mi"],
                "variance_reduction_fraction": 1.0 - s["target_latent_var"] / var0 if var0 > 0 else 0.0,
                "surface": surface,
            }
        )
    # P(sustained) only over the currently supported target points, and at the candidate only when the
    # candidate itself is supported (LEAD_DECISIONS D2); null otherwise.
    a_t = modeling.assess_points(ctx.model, ctx.t)
    ev_t = modeling.explain_points(ctx.t, ctx.evidence, a_t["ratio"], a_t["aleatoric"], a_t["total"])
    sup = np.asarray(ev_t["verdict"]) == "supported"
    p_sup: dict[str, float] | None = None
    if sup.any():
        res_s = counterfactual(ctx.model, x, ctx.t[sup], ctx.w[sup])
        p_sup = {"current": res_s["current"]["target_p_mean"]}
        for s_ in res_s["scenarios"]:
            p_sup[str(s_["outcome"])] = s_["target_p_mean"]
    for sc, raw_s in zip(scenarios, res["scenarios"], strict=True):
        sc["target_p_mean"] = None if p_sup is None else p_sup[str(raw_s["outcome"])]
    u_c = ctx.model.uncertainty(x)
    ev_c = modeling.explain_points(
        x,
        ctx.evidence,
        np.asarray(u_c["latent_std_ratio"]),
        np.asarray(u_c["aleatoric"]),
        np.asarray(u_c["total"]),
    )
    cand_supported = ev_c["verdict"][0] == "supported"
    return {
        "p_sustained_at_candidate": res["p_sustained_at_candidate"] if cand_supported else None,
        "target_p_supported": bool(sup.any()),
        "target_points_supported": int(sup.sum()),
        "n_target_points": len(ctx.t),
        "current": {
            "target_p_mean": None if p_sup is None else p_sup["current"],
            "target_latent_var": cur["target_latent_var"],
            "target_epistemic": cur["target_epistemic_mi"],
        },
        "scenarios": scenarios,
        "expected_variance_reduction_fraction": 1.0 - res["expected_posterior_target_var"] / var0
        if var0 > 0
        else 0.0,
        "note": "Hypothetical outcomes and model updates; not experimental results.",
    }


def default_slice(plane: str) -> float:
    return DEFAULT_SLICE[plane]
