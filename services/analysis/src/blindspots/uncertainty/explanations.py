"""Deterministic reason codes and verdicts for a query point (no LLM; template sentences)."""

from __future__ import annotations

from typing import Any

import numpy as np

from blindspots.config import COVERAGE_SCALES
from blindspots.coverage.coverage import count_within, inside_hull, nn_distance

INSUFFICIENT_SENTENCE = "Insufficient experimental evidence for a reliable estimate."
VERDICT_SENTENCES = {
    "supported": "The estimate is supported by comparable experimental observations.",
    "extrapolation": "The estimate extrapolates beyond the closest experimental observations.",
    "insufficient_evidence": INSUFFICIENT_SENTENCE,
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
    sparse_min_count: int = 3,
) -> dict[str, Any]:
    """Reason codes with numbers and a verdict for one point in analysis coordinates."""
    x = np.atleast_2d(point)
    o = np.asarray(obs, dtype=float).reshape(-1, 3)
    count = int(count_within(x, o)[0])
    nn = float(nn_distance(x, o)[0])
    hull = bool(inside_hull(x, o)[0])
    reasons: list[dict[str, Any]] = []

    def add(code: str, text: str, **values: Any) -> None:
        reasons.append({"code": code, "text": text, **values})

    if count < sparse_min_count:
        add(
            "sparse_observations",
            f"Only {count} comparable observation(s) within one reference distance "
            f"(fewer than {sparse_min_count}).",
            comparable_count=count,
        )
    if not hull:
        add("outside_hull", "The point lies outside the region spanned by the observed conditions.")
    if len(o):
        dp = float(np.min(np.abs(o[:, 2] - x[0, 2])))
        if dp > COVERAGE_SCALES["p"]:
            add(
                "unobserved_pressure",
                f"Nearest observed pressure differs by {dp:.2f} in ln-pressure units "
                f"(reference scale {COVERAGE_SCALES['p']}).",
                pressure_gap_z=dp,
            )
    elif len(o) == 0:
        add("unobserved_pressure", "No observations are available at any pressure.", pressure_gap_z=None)
    if aleatoric is not None and total is not None and total > 0:
        frac = aleatoric / total
        if frac > 0.6 and latent_std_ratio < 0.5:
            add(
                "outcome_variability",
                f"Outcomes at similar conditions vary: aleatoric share of predictive "
                f"uncertainty is {frac:.2f}.",
                aleatoric_fraction=frac,
            )
    if fold_spread is not None and fold_spread > fold_spread_threshold:
        add(
            "model_instability",
            f"Predictions differ across cross-validation fold models (spread {fold_spread:.2f}).",
            fold_spread=fold_spread,
        )
    if count == 0 and other_family_obs is not None:
        n_other = int(count_within(x, np.asarray(other_family_obs, dtype=float).reshape(-1, 3))[0])
        if n_other > 0:
            add(
                "other_family_evidence_only",
                f"Only {n_other} comparable observation(s) exist, all for other material families.",
                other_family_count=n_other,
            )

    if (hull or count >= 3) and latent_std_ratio < 0.6:
        verdict = "supported"
    elif count == 0 and latent_std_ratio > 0.85:
        verdict = "insufficient_evidence"
    else:
        verdict = "extrapolation"
    return {
        "verdict": verdict,
        "sentence": VERDICT_SENTENCES[verdict],
        "reasons": reasons,
        "metrics": {
            "comparable_count": count,
            "nn_d": nn if np.isfinite(nn) else None,
            "inside_hull": hull,
            "latent_std_ratio": float(latent_std_ratio),
        },
    }
