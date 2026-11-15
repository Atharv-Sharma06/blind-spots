"""Hypothetical-outcome scenarios for one candidate (exact refit with fixed hyperparameters)."""

from __future__ import annotations

from typing import Any

import numpy as np

from blindspots.acquisition.evr import normalize_weights


def _summary(model: Any, target_X: np.ndarray, w: np.ndarray) -> dict[str, Any]:
    p = np.asarray(model.predict_proba(target_X))
    var = np.asarray(model.latent(target_X)[1])
    mi = np.asarray(model.uncertainty(target_X)["epistemic"])
    return {
        "target_p_mean": float((w * p).sum()),
        "target_p_per_point": p.tolist(),
        "target_latent_var": float((w * var).sum()),
        "target_epistemic_mi": float((w * mi).sum()),
    }


def counterfactual(
    model: Any, candidate_x: np.ndarray, target_X: np.ndarray, weights: np.ndarray | None = None
) -> dict[str, Any]:
    cand = np.atleast_2d(candidate_x)
    t = np.atleast_2d(target_X)
    w = normalize_weights(weights, len(t))
    p_c = float(np.asarray(model.predict_proba(cand))[0])
    scenarios = []
    for outcome, prob in ((1, p_c), (0, 1.0 - p_c)):
        m2 = model.condition_on(cand, np.array([outcome]))
        s = _summary(m2, t, w)
        s.update(
            {
                "label": "hypothetical outcome",
                "outcome": outcome,
                "probability": prob,
                "p_at_candidate": float(np.asarray(m2.predict_proba(cand))[0]),
            }
        )
        scenarios.append(s)
    return {
        "p_sustained_at_candidate": p_c,
        "current": _summary(model, t, w),
        "scenarios": scenarios,
        "expected_posterior_target_var": float(
            sum(s["probability"] * s["target_latent_var"] for s in scenarios)
        ),
    }
