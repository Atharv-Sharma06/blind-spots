"""Candidate ranking, comparison and counterfactuals (docs/API.md), all deterministic."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any

import numpy as np

from blindspots import config
from blindspots.acquisition.batch import JointPosterior, _record
from blindspots.acquisition.candidates import STATUS_TEXT, CandidateSet, build_candidates
from blindspots.acquisition.counterfactual import counterfactual
from blindspots.acquisition.evr import expected_target_mi_reduction
from blindspots.acquisition.targets import target_points
from blindspots.api import deps
from blindspots.api.errors import ApiError
from blindspots.api.models import Target
from blindspots.api.services import context as ctxmod
from blindspots.api.services import modeling
from blindspots.api.services.targets import ResolvedSpec, resolve_target
from blindspots.coverage.coverage import SCALES, nn_distance, to_coords
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
    return {
        "p": float(u["p_mean"][0]),
        "ratio": float(u["latent_std_ratio"][0]),
        "corr": corr,
        "mi_frac": mi_frac,
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
) -> dict[str, Any]:
    o2, p, u = rec["o2"], rec["pressure_kpa"], rec["airflow_cm_s"]
    x = to_coords(o2, p, u)
    st = _candidate_stats(model, ctx.t, ctx.w, x)
    nn = rec["reasons"]["coverage_nn_d"]
    # Far from every integrated observation the predicted probability only reverts to the training base
    # rate (fixed pressure length scale), so it is not reported as an estimate.
    p_supported = nn is not None and nn <= GAP_NN_DISTANCE
    reasons: list[dict[str, Any]] = []
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
    frac, marg = rec["standalone_fraction"], rec["marginal_fraction"]
    name = f"Candidate {cid}"
    sentence = (
        f"{name} (O2 {o2:.1f} %, {p:.1f} kPa, {u:.2f} cm/s) has an expected reduction of "
        f"{_pct(frac)} of the weighted latent variance over the target region"
    )
    if rank is not None and rank > 1:
        sentence += f" ({_pct(marg)} after the higher-ranked picks)"
    if p_supported:
        sentence += (
            f"; the model estimates P(sustained) = {st['p']:.2f} with latent std ratio {st['ratio']:.2f}"
        )
    else:
        sentence += (
            f"; no supported estimate of P(sustained) is given here (predictions this far from the data "
            f"revert to the training base rate), latent std ratio {st['ratio']:.2f}"
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


def _greedy(jp: JointPosterior, cs: CandidateSet, k: int) -> list[dict[str, Any]]:
    remaining = np.arange(len(cs))
    out = []
    for rank in range(1, min(k, len(cs)) + 1):
        gains = jp.evr(remaining)
        j = int(np.argmax(gains))
        i = int(remaining[j])
        out.append(_record(jp, cs, i, rank, float(gains[j]), "greedy_evr"))
        jp.downdate(i)
        remaining = np.delete(remaining, j)
    return out


def _assumptions(ctx: Ctx) -> list[str]:
    lo, hi = modeling.observed_pressure_range_kpa(ctx.model)
    spec = ctx.spec
    out = [
        f"The GP pressure length scale is fixed at {ctx.lp:g} (ln-pressure units) and cannot be learned: "
        f"the training observations of this group span only {lo:.1f}-{hi:.1f} kPa. Any candidate or "
        "prediction at other pressures is assumption-driven.",
        "Expected variance reduction (EVR) is the expected drop in the weighted latent variance over the "
        "target region from one hypothetical new observation, as a fraction of the current variance "
        "(Gaussian surrogate of the Laplace posterior; hyperparameters held fixed).",
        f"Target airflow band {spec.airflow_min_cm_s:g}-{spec.airflow_max_cm_s:g} cm/s "
        f"(airflow_band_source: {spec.airflow_band_source}).",
    ]
    note = ctx.resolved.payload.get("airflow_band_note")
    if note:
        out.append(note)
    for flag in ctx.resolved.flags:
        if flag == "documented_upper_bound_used":
            out.append(
                "The target oxygen nominal is not documented; the documented upper bound is analysed "
                "(higher O2 is the worst case for flammability) [flag: documented_upper_bound_used]."
            )
        elif flag in ("documented_bound_used", "documented_lower_bound_used"):
            out.append(f"A documented bound is used where no nominal value exists [flag: {flag}].")
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
            picks = _greedy(jp, cs, k)
        else:
            picks = [_record(jp, cs, top_i, 1, float(gains[top_i]), "greedy_evr")]
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
        )
        for rec in default_picks
    ]
    # baselines, scored with the same standalone EVR fraction
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
        rec = _record(jp_default, cs, i, 1, jp_default.evr_initial(i), name)
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
    notes.append(
        "Top candidate is unchanged across pressure length scales 0.15 / 0.3 / 0.6."
        if not changed
        else "The top candidate changes under pressure length scale(s) "
        + ", ".join(f"{c:g}" for c in changed)
        + " (see sensitivity)."
    )
    if all(c["rank"] is not None for c in candidates):
        notes.append(
            f"Ranked {len(candidates)} of {len(cs)} grid candidates by greedy batch expected variance "
            "reduction; baselines are random (seeded by a hash of the request), uncertainty sampling and "
            "nearest gap."
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
        rec = _record(jp, cs, i, 1, jp.evr_initial(i), "compare")
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
    rec = _record(jp, cs, 0, 1, jp.evr_initial(0), "selected")
    return build_candidate(ctx, ctx.model, rec, cid=cid, rank=None)


# --- counterfactual --------------------------------------------------------------------------------


def _scenario_surface(model: GPLaplaceClassifier, plane: str, slice_value: float | None) -> dict[str, Any]:
    from blindspots.api.routes_data import resolve_plane_params

    p = resolve_plane_params(plane, slice_value, 61, 41, None, None, None, None)
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
    group_id: str, target: Target, cand: Any, plane: str | None, slice_value: float | None
) -> dict[str, Any]:
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
            surface = _scenario_surface(m2, plane, slice_value)
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
    from blindspots.api.services.assess import target_verdict

    target_supported = target_verdict(ctx.gm, ctx.t) != "insufficient_evidence"
    nn_c = float(nn_distance(x, ctx.evidence)[0]) if len(ctx.evidence) else None
    cand_supported = nn_c is not None and nn_c <= GAP_NN_DISTANCE
    return {
        "p_sustained_at_candidate": res["p_sustained_at_candidate"] if cand_supported else None,
        "target_p_supported": target_supported,
        "current": {
            "target_p_mean": cur["target_p_mean"],
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
