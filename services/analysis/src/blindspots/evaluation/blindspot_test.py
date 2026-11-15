"""Blind-spot test: does pre-reveal epistemic uncertainty flag where withheld experiments are mispredicted?

Question: "Can the model identify uncertainty in regions where it makes larger errors on withheld
experiments?"  Two levels, both using only predictions made without the evaluated experiment:

* point level: Spearman rho between epistemic uncertainty (mutual information, nats) and per-point log loss
  over pooled out-of-fold predictions, with a one-sided (rho > 0) permutation p-value, plus the AUROC of
  epistemic uncertainty for detecting misclassified points (|y - p| > 0.5);
* experiment level: leave-one-experiment-out refits; mean epistemic uncertainty vs mean log loss per held-out
  experiment, Spearman rho and one-sided permutation p-value.

The point-level permutation test treats points as exchangeable although points of one experiment are
correlated, so its p-value is optimistic; the experiment-level test is the cluster-respecting one.
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, Any

import numpy as np
from numpy.typing import NDArray
from scipy.stats import rankdata

from blindspots.evaluation.metrics import LOG_LOSS_CLIP, roc_auc

if TYPE_CHECKING:
    from blindspots.models.features import TrainingSet
    from blindspots.models.registry import TrainConfig

FloatArray = NDArray[np.float64]
ALPHA = 0.05


def pointwise_log_loss(y: FloatArray, p: FloatArray) -> FloatArray:
    pc = np.clip(p, LOG_LOSS_CLIP, 1.0 - LOG_LOSS_CLIP)
    return np.asarray(-(y * np.log(pc) + (1.0 - y) * np.log1p(-pc)), dtype=float)


def _pearson(a: FloatArray, b: FloatArray) -> float:
    a = a - a.mean()
    b = b - b.mean()
    den = float(np.sqrt((a @ a) * (b @ b)))
    return float("nan") if den == 0.0 else float(a @ b) / den


def spearman_permutation(
    x: FloatArray, y: FloatArray, n_perm: int = 2000, seed: int = 0
) -> tuple[float | None, float | None]:
    """Spearman rho and one-sided (greater) permutation p-value = (1 + #{rho_perm >= rho}) / (1 + n_perm)."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    ok = np.isfinite(x) & np.isfinite(y)
    x, y = x[ok], y[ok]
    if x.size < 3:
        return None, None
    rx, ry = rankdata(x), rankdata(y)
    rho = _pearson(rx, ry)
    if not np.isfinite(rho):
        return None, None
    rng = np.random.default_rng(seed)
    rx_c = rx - rx.mean()
    ry_c = ry - ry.mean()
    den = float(np.sqrt((rx_c @ rx_c) * (ry_c @ ry_c)))
    perms = np.vstack([rng.permutation(ry_c) for _ in range(n_perm)])
    null = (perms @ rx_c) / den
    p = (1.0 + float(np.sum(null >= rho - 1e-12))) / (1.0 + n_perm)
    return float(rho), float(p)


def partial_spearman(x: FloatArray, y: FloatArray, z: FloatArray) -> float | None:
    """Rank-based partial correlation of x and y controlling for z (residuals of ranks on rank z)."""
    rx, ry, rz = rankdata(x), rankdata(y), rankdata(z)
    rz_c = rz - rz.mean()
    den = float(rz_c @ rz_c)
    if den == 0.0:
        return None

    def resid(r: FloatArray) -> FloatArray:
        r_c = r - r.mean()
        return np.asarray(r_c - (float(r_c @ rz_c) / den) * rz_c, dtype=float)

    val = _pearson(resid(rx), resid(ry))
    return float(val) if np.isfinite(val) else None


def partial_spearman_permutation(
    x: FloatArray, y: FloatArray, z: FloatArray, n_perm: int = 2000, seed: int = 0
) -> tuple[float | None, float | None]:
    """Partial rank correlation of x and y given z, with a one-sided permutation p-value.

    Ranks of x and y are residualized on ranks of z; the y-residuals are permuted (approximate test).
    """
    x, y, z = (np.asarray(a, dtype=float) for a in (x, y, z))
    ok = np.isfinite(x) & np.isfinite(y) & np.isfinite(z)
    x, y, z = x[ok], y[ok], z[ok]
    if x.size < 4:
        return None, None
    rz = rankdata(z)
    rz_c = rz - rz.mean()
    den_z = float(rz_c @ rz_c)
    if den_z == 0.0:
        return None, None

    def resid(r: FloatArray) -> FloatArray:
        r_c = r - r.mean()
        return np.asarray(r_c - (float(r_c @ rz_c) / den_z) * rz_c, dtype=float)

    ex, ey = resid(rankdata(x)), resid(rankdata(y))
    den = float(np.sqrt((ex @ ex) * (ey @ ey)))
    if den == 0.0:
        return None, None
    rho = float(ex @ ey) / den
    rng = np.random.default_rng(seed)
    null = np.vstack([rng.permutation(ey) for _ in range(n_perm)]) @ ex / den
    pval = (1.0 + float(np.sum(null >= rho - 1e-12))) / (1.0 + n_perm)
    return rho, pval


def point_level(
    y: FloatArray,
    p: FloatArray,
    epistemic: FloatArray,
    loss: FloatArray,
    n_perm: int = 2000,
    seed: int = 0,
) -> dict[str, Any]:
    rho, pval = spearman_permutation(epistemic, loss, n_perm, seed)
    wrong = ((p >= 0.5).astype(float) != y).astype(float)
    auroc = roc_auc(wrong, epistemic)
    return {
        "n": int(y.size),
        "n_misclassified": int(wrong.sum()),
        "spearman_rho": rho,
        "p_value": pval,
        "p_value_note": "one-sided permutation test (rho > 0); points treated as exchangeable",
        "auroc_error_detection": auroc,
    }


def experiment_level(
    ts: TrainingSet,
    config: TrainConfig,
    mean: str,
    n_perm: int = 2000,
    seed: int = 0,
) -> dict[str, Any]:
    """Leave-one-experiment-out: refit (hyperparameters included), predict the held-out experiment."""
    experiments = np.unique(ts.groups)
    y = ts.y.astype(float)
    t0 = time.time()
    fallback_used = False
    pairs: list[dict[str, Any]] = []
    for i, exp in enumerate(experiments):
        te = np.flatnonzero(ts.groups == exp)
        tr = np.flatnonzero(ts.groups != exp)
        if np.unique(y[tr]).size < 2:
            continue
        if not fallback_used and i == 3:
            projected = (time.time() - t0) / 3.0 * len(experiments)
            # Over budget: keep refitting hyperparameters WITHOUT the held-out experiment, but with a
            # single optimizer start (never fit on rows that include the held-out experiment).
            fallback_used = projected > config.loeo_refit_budget_s
        m = config.gp_factory(mean, n_restarts=1 if fallback_used else None).fit(ts.X[tr], ts.y[tr])
        unc = m.uncertainty(ts.X[te])
        loss = pointwise_log_loss(y[te], unc["p_mean"])
        pairs.append(
            {
                "experiment_id": str(exp),
                "n_points": int(te.size),
                "pre_reveal_uncertainty": float(np.mean(unc["epistemic"])),
                "error": float(np.mean(loss)),
            }
        )
    u = np.array([p["pre_reveal_uncertainty"] for p in pairs])
    e = np.array([p["error"] for p in pairs])
    rho, pval = spearman_permutation(u, e, n_perm, seed + 1)
    return {
        "n_groups": len(pairs),
        "spearman_rho": rho,
        "p_value": pval,
        "p_value_note": "one-sided permutation test (rho > 0) across held-out experiments",
        "pairs": pairs,
        "hyperparameters_refit_per_experiment": not fallback_used,
        "runtime_s": round(time.time() - t0, 1),
    }


def verdict_from(point: dict[str, Any], group: dict[str, Any], diag: dict[str, Any] | None = None) -> str:
    """supported = positive at both levels AND (when computed) epistemic uncertainty still tracks error after
    controlling for aleatoric uncertainty (partial rho > 0, p < 0.05): otherwise the association could
    come from predictive entropy alone (independent numerical review, 2026-11-15)."""

    def positive(d: dict[str, Any]) -> bool:
        return d["spearman_rho"] is not None and d["spearman_rho"] > 0 and (d["p_value"] or 1.0) < ALPHA

    def nonpositive(d: dict[str, Any]) -> bool:
        return d["spearman_rho"] is not None and d["spearman_rho"] <= 0

    partial_ok = True
    if diag is not None and "partial_p_value" in diag:
        pr, pp = diag.get("partial_rho_epistemic_given_aleatoric"), diag.get("partial_p_value")
        partial_ok = pr is not None and pr > 0 and pp is not None and pp < ALPHA
    if positive(point) and positive(group) and partial_ok:
        return "supported"
    if nonpositive(point) and nonpositive(group):
        return "not_supported"
    return "inconclusive"


def _fmt(v: float | None, nd: int = 2) -> str:
    if v is None:
        return "n/a"
    return f"<{10**-nd:.{nd}f}" if nd >= 3 and 0 < v < 10**-nd else f"{v:.{nd}f}"


def interpretation(verdict: str, point: dict[str, Any], group: dict[str, Any], diag: dict[str, Any]) -> str:
    base = (
        f"Point level (n={point['n']}): Spearman rho={_fmt(point['spearman_rho'])} "
        f"(one-sided p={_fmt(point['p_value'], 3)}) between pre-reveal epistemic uncertainty and log loss; "
        f"AUROC for flagging {point['n_misclassified']} misclassified points = "
        f"{_fmt(point['auroc_error_detection'])}. "
        f"Experiment level (n={group['n_groups']} held-out experiments): rho={_fmt(group['spearman_rho'])} "
        f"(p={_fmt(group['p_value'], 3)}). "
    )
    if verdict == "supported":
        tail = (
            "Withheld experiments with higher pre-reveal epistemic uncertainty tended to be predicted worse "
            "at both levels; this is an association in a small, imbalanced sample, not a guarantee."
        )
    elif verdict == "not_supported":
        tail = "Epistemic uncertainty did not track error at either level."
    else:
        tail = (
            "The two levels do not agree, or the evidence is below the 0.05 threshold; treat as inconclusive."
        )
    ra_all = diag.get("rho_aleatoric_point")
    part = diag.get("partial_rho_epistemic_given_aleatoric")
    if (
        verdict == "supported"
        and ra_all is not None
        and point["spearman_rho"] is not None
        and ra_all >= point["spearman_rho"]
    ):
        tail += (
            f" Caveat: aleatoric (predictive-entropy) uncertainty tracks log loss at least as strongly "
            f"(rho={_fmt(ra_all)}), and the epistemic-loss association controlling for it is "
            f"{_fmt(part)}; so this does not show that epistemic uncertainty adds information beyond "
            "the model's overall predictive uncertainty."
        )
    pr, pp = diag.get("partial_rho_epistemic_given_aleatoric"), diag.get("partial_p_value")
    if pr is not None:
        tail += (
            f" Controlling for aleatoric uncertainty, the point-level association is "
            f"{_fmt(pr)} (p={_fmt(pp, 3)})."
        )
    if verdict != "supported":
        reasons = []
        ra = diag.get("rho_aleatoric_point")
        re = point["spearman_rho"]
        if ra is not None and re is not None and ra > re:
            reasons.append(
                f"aleatoric (outcome-variability) uncertainty tracks log loss more strongly "
                f"(rho={_fmt(ra)}), "
                "so errors concentrate where the model already expects mixed outcomes "
                "rather than where data are sparse"
            )
        share = diag.get("share_misclassified_flow_off_transient")
        if share:
            reasons.append(
                f"{share:.0%} of misclassified points are flow-turned-off transient labels, which are not a "
                "physical quench boundary"
            )
        if reasons:
            tail += " Possible reasons: " + "; ".join(reasons) + "."
    return base + tail


def run_blindspot_test(
    ts: TrainingSet,
    oof: dict[str, FloatArray],
    config: TrainConfig,
    mean: str,
    flow_off: NDArray[np.bool_] | None = None,
    loss_by_repeat: FloatArray | None = None,
) -> dict[str, Any]:
    """`oof` holds per-row arrays averaged over CV repeats (p_mean, epistemic, aleatoric)."""
    y = ts.y.astype(float)
    p = oof["p_mean"]
    loss = loss_by_repeat if loss_by_repeat is not None else pointwise_log_loss(y, p)
    pt = point_level(y, p, oof["epistemic"], loss, config.n_permutations, config.seed)
    grp = experiment_level(ts, config, mean, config.n_permutations, config.seed)
    rho_al, _ = spearman_permutation(oof["aleatoric"], loss, 10, 0)
    wrong = (p >= 0.5).astype(float) != y
    partial_rho, partial_p = partial_spearman_permutation(
        oof["epistemic"], loss, oof["aleatoric"], config.n_permutations, config.seed
    )
    diag: dict[str, Any] = {
        "rho_aleatoric_point": rho_al,
        "partial_rho_epistemic_given_aleatoric": partial_rho,
        "partial_p_value": partial_p,
        "partial_note": "point-level partial Spearman of epistemic uncertainty vs log loss given aleatoric",
    }
    if flow_off is not None and wrong.any():
        diag["share_misclassified_flow_off_transient"] = float(np.mean(flow_off[wrong]))
    verdict = verdict_from(pt, grp, diag)
    return {
        "point_level": pt,
        "group_level": grp,
        "verdict": verdict,
        "interpretation": interpretation(verdict, pt, grp, diag),
        "diagnostics": diag,
    }
