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


VERDICT_RULE = (
    "Supported when Spearman rho > 0 with one-sided p < 0.05 at both the point level and the experiment "
    "level, and the point-level partial rho of knowledge (epistemic) uncertainty with log loss, controlling "
    "for outcome-variability (aleatoric) uncertainty, is > 0 with p < 0.05; not supported when rho <= 0 at "
    "both levels; otherwise inconclusive."
)
CRITERIA_LABELS = {
    "point_level": "point-level correlation positive and significant",
    "experiment_level": "experiment-level correlation positive and significant",
    "partial": "point-level association persists after controlling for outcome variability",
}


def _positive(d: dict[str, Any]) -> bool:
    return d["spearman_rho"] is not None and d["spearman_rho"] > 0 and (d["p_value"] or 1.0) < ALPHA


def _nonpositive(d: dict[str, Any]) -> bool:
    return d["spearman_rho"] is not None and d["spearman_rho"] <= 0


def criteria(
    point: dict[str, Any], group: dict[str, Any], diag: dict[str, Any] | None = None
) -> dict[str, bool | None]:
    """Each criterion of :data:`VERDICT_RULE`; ``partial`` is None when it was not computed."""
    partial: bool | None = None
    if diag is not None and "partial_p_value" in diag:
        pr, pp = diag.get("partial_rho_epistemic_given_aleatoric"), diag.get("partial_p_value")
        partial = pr is not None and pr > 0 and pp is not None and pp < ALPHA
    return {"point_level": _positive(point), "experiment_level": _positive(group), "partial": partial}


def verdict_from(point: dict[str, Any], group: dict[str, Any], diag: dict[str, Any] | None = None) -> str:
    """See :data:`VERDICT_RULE`. Without the partial criterion, an association of epistemic uncertainty with
    error could come from outcome variability alone (independent numerical review, 2026-11-15)."""
    c = criteria(point, group, diag)
    if c["point_level"] and c["experiment_level"] and c["partial"] is not False:
        return "supported"
    if _nonpositive(point) and _nonpositive(group):
        return "not_supported"
    return "inconclusive"


def _fmt(v: float | None, nd: int = 2) -> str:
    return "n/a" if v is None else f"{v:.{nd}f}"


def _p(v: float | None) -> str:
    """'p = 0.028' or 'p < 0.001'."""
    if v is None:
        return "p = n/a"
    return "p < 0.001" if v < 0.001 else f"p = {v:.3f}"


def _count(n: int, noun: str) -> str:
    return f"{n} {noun}" + ("" if n == 1 else "s")


def _auroc_text(point: dict[str, Any]) -> str:
    n_mis = point["n_misclassified"]
    if n_mis == 0 or point["auroc_error_detection"] is None:
        return "no point is misclassified, so error detection (AUROC) is undefined"
    return (
        f"AUROC for flagging the {_count(n_mis, 'misclassified point')} = "
        f"{_fmt(point['auroc_error_detection'])}"
    )


def _level_failure(name: str, d: dict[str, Any]) -> str:
    if d["spearman_rho"] is None:
        return f"the {name} correlation could not be computed"
    if d["spearman_rho"] <= 0:
        return f"the {name} correlation is not positive (rho = {_fmt(d['spearman_rho'])})"
    return f"the {name} correlation is positive but not significant ({_p(d['p_value'])})"


def interpretation(verdict: str, point: dict[str, Any], group: dict[str, Any], diag: dict[str, Any]) -> str:
    """Plain-language reading generated from the numbers; it never contradicts ``verdict``."""
    c = criteria(point, group, diag)
    pr, pp = diag.get("partial_rho_epistemic_given_aleatoric"), diag.get("partial_p_value")
    ra = diag.get("rho_aleatoric_point")
    base = (
        f"Point level (n = {point['n']}): Spearman rho = {_fmt(point['spearman_rho'])} "
        f"(one-sided {_p(point['p_value'])}) between pre-reveal knowledge (epistemic) uncertainty and log "
        f"loss; {_auroc_text(point)}. "
        f"Experiment level (n = {group['n_groups']} held-out experiments): rho = "
        f"{_fmt(group['spearman_rho'])} ({_p(group['p_value'])}). "
    )
    if pr is not None:
        base += (
            f"Controlling for outcome-variability (aleatoric) uncertainty, the point-level association is "
            f"{_fmt(pr)} ({_p(pp)}). "
        )
    if verdict == "supported":
        tail = (
            "All criteria hold: withheld experiments with higher pre-reveal knowledge uncertainty were "
            "predicted worse at both levels"
        )
        tail += (
            ", and the association persists after controlling for outcome variability."
            if c["partial"]
            else "."
        )
        if (
            ra is not None
            and point["spearman_rho"] is not None
            and ra >= point["spearman_rho"]
            and c["partial"]
        ):
            tail += (
                f" Outcome variability tracks log loss at least as strongly (rho = {_fmt(ra)}); the "
                "significant partial correlation shows knowledge uncertainty adds information beyond it."
            )
        tail += " This is an association in a small, imbalanced sample, not a guarantee."
        n_mis = point["n_misclassified"]
        share_neg = diag.get("share_not_sustained_flow_off_transient")
        if n_mis <= 2 or (share_neg is not None and share_neg >= 0.5):
            caveat = (
                f" Caveat: no point of {point['n']} is misclassified"
                if n_mis == 0
                else f" Caveat: only {_count(n_mis, 'point')} of {point['n']} "
                + ("is" if n_mis == 1 else "are")
                + " misclassified"
            )
            if share_neg is not None and share_neg > 0:
                caveat += (
                    f" and {share_neg:.0%} of the not-sustained observations are flow-turned-off transients"
                )
            tail += (
                caveat + ", so the test says little about physical extinction boundaries; treat it as "
                "unproven there."
            )
        return base + tail
    if verdict == "not_supported":
        return base + "Knowledge uncertainty did not track error at either level (rho <= 0 at both)."
    met = [CRITERIA_LABELS[k] for k, v in c.items() if v]
    failing = []
    if not c["point_level"]:
        failing.append(_level_failure("point-level", point))
    if not c["experiment_level"]:
        failing.append(_level_failure("experiment-level", group))
    if c["partial"] is False:
        what = "not positive" if pr is None or pr <= 0 else "not significant"
        failing.append(
            f"controlling for outcome variability the point-level association is {what} "
            f"({_fmt(pr)}, {_p(pp)}), so it may come from outcome variability alone"
        )
    tail = "Inconclusive. "
    if met:
        tail += "Met: " + "; ".join(met) + ". "
    tail += "Not met: " + "; ".join(failing) + "."
    reasons = []
    if (
        c["partial"] is False
        and ra is not None
        and point["spearman_rho"] is not None
        and ra > point["spearman_rho"]
    ):
        reasons.append(
            f"outcome-variability (aleatoric) uncertainty tracks log loss more strongly (rho = {_fmt(ra)}), "
            "so errors concentrate where the model already expects mixed outcomes"
        )
    share = diag.get("share_misclassified_flow_off_transient")
    if share:
        reasons.append(
            f"{share:.0%} of misclassified points are flow-turned-off transient labels, which are not a "
            "physical extinction boundary"
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
    if flow_off is not None and (y == 0).any():
        diag["share_not_sustained_flow_off_transient"] = float(np.mean(flow_off[y == 0]))
    verdict = verdict_from(pt, grp, diag)
    return {
        "point_level": pt,
        "group_level": grp,
        "verdict": verdict,
        "rule": VERDICT_RULE,
        "criteria": criteria(pt, grp, diag),
        "interpretation": interpretation(verdict, pt, grp, diag),
        "diagnostics": diag,
    }
