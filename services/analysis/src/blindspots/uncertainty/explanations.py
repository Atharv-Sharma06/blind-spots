"""Deterministic reason codes, verdicts and target-level aggregation (no LLM; template sentences).

Canonical terms (LEAD_DECISIONS D5): comparable observation, reference distance, observed region, knowledge
uncertainty (epistemic), outcome variability (aleatoric), remaining uncertainty (latent std ratio).
A point that is not supported always gets at least one reason (``high_knowledge_uncertainty`` covers the
case where the latent std ratio is what fails).
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from typing import Any

import numpy as np

from blindspots.config import COVERAGE_SCALES
from blindspots.coverage.coverage import count_within, inside_hull, nn_distance

INSUFFICIENT_SENTENCE = "Insufficient experimental evidence for a reliable estimate."
VERDICT_SENTENCES = {
    "supported": "ISS tests nearby support this estimate.",
    "extrapolation": "This estimate goes beyond nearby ISS tests and relies on model assumptions.",
    "insufficient_evidence": INSUFFICIENT_SENTENCE,
}
SPARSE_MIN_COUNT = 3
SUPPORT_RATIO_MAX = 0.6  # supported only when the latent std ratio is below this
INSUFFICIENT_RATIO_MIN = 0.85  # insufficient only with no comparable observation and a ratio above this
OUTCOME_SHARE_MIN = 0.6
OUTCOME_RATIO_MAX = 0.5
TARGET_SUPPORTED_FRACTION = 0.5  # LEAD_DECISIONS D2
REASON_FRACTION = 0.5


def _plural(n: int, noun: str) -> str:
    return f"{n} {noun}" + ("" if n == 1 else "s")


def sparse_message(count: int) -> str:
    if count == 0:
        return "No ISS tests nearby."
    return f"Only {_plural(count, 'ISS test result')} nearby."


OUTSIDE_MESSAGE = "Beyond the range the ISS tests covered."


def pressure_message(dp: float) -> str:
    return f"The nearest tested pressure differs by a factor of {np.exp(dp):.2f}."


def outcome_message(frac: float) -> str:
    return f"Nearby results are mixed; {100 * frac:.0f}% of the uncertainty comes from that."


def knowledge_message(ratio: float) -> str:
    return (
        f"The model is still unsure: {ratio:.2f} of its starting uncertainty remains; "
        f"under {SUPPORT_RATIO_MAX:.2f} is needed."
    )


def point_verdict(hull: bool, count: int, ratio: float) -> str:
    if (hull or count >= SPARSE_MIN_COUNT) and ratio < SUPPORT_RATIO_MAX:
        return "supported"
    if count == 0 and ratio > INSUFFICIENT_RATIO_MIN:
        return "insufficient_evidence"
    return "extrapolation"


def _point_reasons(
    count: int, hull: bool, dp: float | None, n_obs: int, ratio: float, frac: float | None, verdict: str
) -> list[dict[str, Any]]:
    r: list[dict[str, Any]] = []
    if count < SPARSE_MIN_COUNT:
        r.append({"code": "sparse_observations", "message": sparse_message(count), "value": float(count)})
    if not hull:
        r.append({"code": "outside_hull", "message": OUTSIDE_MESSAGE, "value": None})
    if n_obs == 0:
        msg = "No ISS tests at any pressure."
        r.append({"code": "unobserved_pressure", "message": msg, "value": None})
    elif dp is not None and dp > COVERAGE_SCALES["p"]:
        r.append({"code": "unobserved_pressure", "message": pressure_message(dp), "value": float(dp)})
    if frac is not None and frac > OUTCOME_SHARE_MIN and ratio < OUTCOME_RATIO_MAX:
        r.append({"code": "outcome_variability", "message": outcome_message(frac), "value": frac})
    if verdict != "supported" and ratio >= SUPPORT_RATIO_MAX:
        r.append({"code": "high_knowledge_uncertainty", "message": knowledge_message(ratio), "value": ratio})
    return r


def explain_points(
    pts: np.ndarray,
    obs: np.ndarray,
    ratio: np.ndarray,
    aleatoric: np.ndarray | None = None,
    total: np.ndarray | None = None,
) -> dict[str, Any]:
    """Vectorised verdicts and reasons; same return shape as ``api.services.modeling.explain_points``.

    Arrays ``count``, ``nn``, ``hull``, ``pressure_gap``, list ``verdict`` and per-point reasons
    ``{"code", "message", "value"}``. A point that is not supported always has at least one reason.
    """
    x = np.atleast_2d(pts)
    o = np.asarray(obs, dtype=float).reshape(-1, 3)
    n = len(x)
    ratio = np.asarray(ratio, dtype=float).reshape(n)
    count = count_within(x, o)
    nn = nn_distance(x, o)
    hull = inside_hull(x, o)
    dp = np.min(np.abs(o[None, :, 2] - x[:, None, 2]), axis=1) if len(o) else np.full(n, np.nan)
    verdicts: list[str] = []
    reasons: list[list[dict[str, Any]]] = []
    for i in range(n):
        v = point_verdict(bool(hull[i]), int(count[i]), float(ratio[i]))
        frac = None
        if aleatoric is not None and total is not None and total[i] > 0:
            frac = float(aleatoric[i] / total[i])
        gap = float(dp[i]) if len(o) else None
        verdicts.append(v)
        reasons.append(_point_reasons(int(count[i]), bool(hull[i]), gap, len(o), float(ratio[i]), frac, v))
    return {
        "count": count,
        "nn": nn,
        "hull": hull,
        "pressure_gap": dp,
        "verdict": verdicts,
        "reasons": reasons,
    }


def explain_point(
    point: np.ndarray,
    obs: np.ndarray,
    *,
    latent_std_ratio: float,
    aleatoric: float | None = None,
    total: float | None = None,
    fold_spread: float | None = None,
    fold_spread_threshold: float = 0.15,
    other_family_obs: np.ndarray | None = None,
) -> dict[str, Any]:
    """Reason codes with numbers and a verdict for one point in analysis coordinates."""
    ev = explain_points(
        np.atleast_2d(point),
        obs,
        np.array([latent_std_ratio]),
        None if aleatoric is None else np.array([aleatoric]),
        None if total is None else np.array([total]),
    )
    verdict = ev["verdict"][0]
    reasons = list(ev["reasons"][0])
    count = int(ev["count"][0])
    if fold_spread is not None and fold_spread > fold_spread_threshold:
        reasons.append(
            {
                "code": "model_instability",
                "message": f"Models trained on different tests disagree here (spread {fold_spread:.2f}).",
                "value": fold_spread,
            }
        )
    if count == 0 and other_family_obs is not None:
        n_other = int(count_within(np.atleast_2d(point), np.asarray(other_family_obs).reshape(-1, 3))[0])
        if n_other > 0:
            reasons.append(
                {
                    "code": "other_family_evidence_only",
                    "message": f"Only other materials have nearby ISS tests ({n_other}); "
                    "the model ignores them.",
                    "value": float(n_other),
                }
            )
    nn = float(ev["nn"][0])
    return {
        "verdict": verdict,
        "sentence": VERDICT_SENTENCES[verdict],
        "reasons": reasons,
        "metrics": {
            "comparable_count": count,
            "nn_d": nn if np.isfinite(nn) else None,
            "inside_hull": bool(ev["hull"][0]),
            "latent_std_ratio": float(latent_std_ratio),
        },
    }


# --- target level (LEAD_DECISIONS D2) --------------------------------------------------------------


def aggregate_target(
    verdicts: Sequence[str],
    comparable_counts: Sequence[int] | np.ndarray,
    reasons: Sequence[Sequence[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    """Target verdict from its points: supported when >= 50 % of points are supported; insufficient_evidence
    when no point has a comparable observation; otherwise extrapolation. Reasons that apply to >= 50 % of the
    points are listed with their share; when the target is not supported the list is never empty."""
    n = len(verdicts)
    c = Counter(verdicts)
    k = c["supported"]
    with_comparable = int(np.sum(np.asarray(comparable_counts) > 0))
    if n and k / n >= TARGET_SUPPORTED_FRACTION:
        verdict = "supported"
    elif with_comparable == 0:
        verdict = "insufficient_evidence"
    else:
        verdict = "extrapolation"
    codes: Counter[str] = Counter()
    messages: dict[str, str] = {}
    for per_point in reasons or []:
        for r in {r["code"]: r for r in per_point}.values():
            codes[r["code"]] += 1
            messages.setdefault(r["code"], r["message"])
    ranked = sorted(codes.items(), key=lambda kv: (-kv[1], kv[0]))
    out = [
        {"code": code, "message": f"{messages[code].rstrip('.')} (at {100 * cnt / n:.0f}% of points).",
         "value": round(cnt / n, 4)}
        for code, cnt in ranked
        if n and cnt / n >= REASON_FRACTION
    ]  # fmt: skip
    if verdict != "supported" and not out and n:
        out.append(
            {
                "code": "target_points_not_supported",
                "message": f"{n - k} of {n} points in this air are not well covered.",
                "value": round((n - k) / n, 4),
            }
        )
    return {
        "verdict": verdict,
        "n_target_points": n,
        "points_supported": k,
        "points_with_comparable": with_comparable,
        "verdict_counts": {v: c[v] for v in ("supported", "extrapolation", "insufficient_evidence")},
        "reasons": out,
        "sentence": target_sentence(verdict, k, n, with_comparable),
    }


def supported_probability(p: np.ndarray, w: np.ndarray, verdicts: Sequence[str]) -> dict[str, float | None]:
    """P(sustained) summary over supported points only (weights renormalised); all None if none is."""
    mask = np.asarray(verdicts) == "supported"
    if not mask.any():
        return {"p_sustained_mean": None, "p_sustained_min": None, "p_sustained_max": None}
    pp, ww = np.asarray(p, dtype=float)[mask], np.asarray(w, dtype=float)[mask]
    return {
        "p_sustained_mean": float((ww * pp).sum() / ww.sum()),
        "p_sustained_min": float(pp.min()),
        "p_sustained_max": float(pp.max()),
    }


def target_sentence(verdict: str, points_supported: int, n: int, points_with_comparable: int) -> str:
    """One canonical sentence; 'not represented in the integrated records' only when nothing is comparable."""
    if points_with_comparable == 0:
        return (
            f"{INSUFFICIENT_SENTENCE} These conditions are not represented in the integrated records: none "
            f"of the {n} points in this air has a nearby ISS test."
        )
    head = f"{points_supported} of {n} points in this air are backed by nearby ISS tests"
    if verdict == "supported":
        return head + "."
    return (
        f"{head}; {points_with_comparable} of {n} have at least one nearby ISS test. "
        "Estimates for the other points rely on model assumptions."
    )
