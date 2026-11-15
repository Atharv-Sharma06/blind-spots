"""Retrospective evaluation of target-aware acquisition on historical experiments.

Pseudo-target scenarios hold a set of real experiments out of the pool. Each strategy then picks whole
experiments (a real experiment is a flow schedule, so its value is the joint expected variance reduction
of all its observation points) and the model is refitted on the acquired data only. Quality is the
log loss / Brier score on the held-out target observations. Hyperparameters never see target data.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import numpy as np
from numpy.typing import NDArray

from blindspots.acquisition.evr import effective_curvature, epistemic_mi
from blindspots.coverage.coverage import SCALES, nn_distance
from blindspots.evaluation.metrics import brier, log_loss
from blindspots.models.features import TrainingSet
from blindspots.models.gp_laplace import GPLaplaceClassifier

STRATEGIES = ("evr", "uncertainty_sampling", "nearest_gap", "random")
N_INITIAL = 3
MAX_REDRAWS = 50
INITIAL_RESTARTS = 3  # MAP-II restarts on the initial training set
WARM_RESTARTS = 1  # warm-started refits (starts from the previous hyperparameters)

FloatArray = NDArray[np.float64]


@dataclass(frozen=True)
class Scenario:
    name: str
    target_definition: str
    target_experiments: tuple[str, ...]


def experiment_table(ts: TrainingSet) -> dict[str, dict[str, Any]]:
    """Per-experiment summary: row indices, mean O2, minimum airflow (cm/s), campaign."""
    out: dict[str, dict[str, Any]] = {}
    for e in sorted({str(g) for g in ts.groups}):
        idx = np.flatnonzero(ts.groups == e)
        out[e] = {
            "rows": idx,
            "mean_o2": float(ts.X[idx, 0].mean()),
            "min_flow": float(np.expm1(ts.X[idx, 1].min())),
            "campaign": str(ts.campaign_group[idx[0]]),
        }
    return out


def define_scenarios(ts: TrainingSet, min_pool: int = 6) -> tuple[list[Scenario], list[dict[str, str]]]:
    """Return (scenarios, skipped) for one group's training set; skips carry a reason."""
    table = experiment_table(ts)
    exps = list(table)
    scenarios: list[Scenario] = []
    skipped: list[dict[str, str]] = []

    def add(name: str, definition: str, members: list[str]) -> None:
        if not members:
            skipped.append({"name": name, "reason": "no target experiments"})
        elif len(exps) - len(members) < min_pool:
            skipped.append({"name": name, "reason": f"pool would have < {min_pool} experiments"})
        else:
            scenarios.append(Scenario(name, definition, tuple(members)))

    o2 = np.array([table[e]["mean_o2"] for e in exps])
    q_o2 = float(np.quantile(o2, 0.25))
    low_o2 = [e for e, v in zip(exps, o2, strict=True) if v <= q_o2]
    add(
        "lowest_o2_quartile",
        f"experiments whose mean O2 is in the group's lowest quartile (<= {q_o2:.2f} %)",
        low_o2,
    )
    flow = np.array([table[e]["min_flow"] for e in exps])
    q_f = float(np.quantile(flow, 0.25))
    low_flow = [e for e, v in zip(exps, flow, strict=True) if v <= q_f]
    overlap = len(set(low_flow) & set(low_o2)) / len(low_flow) if low_flow else 0.0
    if overlap > 0.5:
        skipped.append(
            {
                "name": "low_airflow_frontier",
                "reason": f"overlaps lowest_o2_quartile by {overlap:.0%} (> 50%)",
            }
        )
    else:
        add(
            "low_airflow_frontier",
            f"experiments whose minimum recorded airflow is in the lowest quartile (<= {q_f:.2f} cm/s)",
            low_flow,
        )
    campaigns: dict[str, list[str]] = {}
    for e in exps:
        campaigns.setdefault(table[e]["campaign"], []).append(e)
    if len(campaigns) >= 2:
        name, members = sorted(campaigns.items(), key=lambda kv: (-len(kv[1]), kv[0]))[0]
        add(f"campaign_holdout:{name}", f"all experiments of campaign '{name}'", members)
    return scenarios, skipped


# ------------------------------------------------------------------------------------------ strategies
def _fit_initial(X: FloatArray, y: FloatArray, seed: int) -> GPLaplaceClassifier:
    gp = GPLaplaceClassifier.default(n_restarts=INITIAL_RESTARTS, seed=seed)
    return gp.fit(X, y)


def _refit(prev: GPLaplaceClassifier, X: FloatArray, y: FloatArray, seed: int) -> GPLaplaceClassifier:
    gp = GPLaplaceClassifier(
        prev.length_scales,
        prev.signal_var,
        mean=prev.mean,
        fixed=("l_p",),
        n_restarts=WARM_RESTARTS,
        seed=seed,
        mean_params=prev.mean_params,
    )
    return gp.fit(X, y)


def block_evr(model: GPLaplaceClassifier, T: FloatArray, C: FloatArray) -> float:
    """Uniform-weight joint EVR of observing all points C: mean_t [S_TC (S_CC + W^-1)^-1 S_CT]_tt."""
    mu_c, var_c = model.latent(C)
    wbar = np.maximum(effective_curvature(mu_c, var_c), 1e-9)
    s_cc = model.latent_cov(C, C) + np.diag(1.0 / wbar)
    s_tc = model.latent_cov(T, C)
    sol = np.linalg.solve(s_cc, s_tc.T)
    return float(np.mean(np.sum(s_tc.T * sol, axis=0)))


def pick_evr(model: Any, T: FloatArray, pool: dict[str, FloatArray], **_: Any) -> str:
    scores = {e: block_evr(model, T, C) for e, C in pool.items()}
    return max(scores, key=lambda e: (scores[e], -sorted(pool).index(e)))


def pick_uncertainty(model: Any, T: FloatArray, pool: dict[str, FloatArray], **_: Any) -> str:
    scores = {}
    for e, C in pool.items():
        mu, var = model.latent(C)
        scores[e] = float(epistemic_mi(mu, var).mean())
    return max(scores, key=lambda e: (scores[e], -sorted(pool).index(e)))


def pick_nearest_gap(
    model: Any, T: FloatArray, pool: dict[str, FloatArray], train_X: FloatArray | None = None, **_: Any
) -> str:
    assert train_X is not None
    centroid = T.mean(axis=0)
    dist, eligible = {}, []
    for e, C in pool.items():
        dist[e] = float(np.linalg.norm((C.mean(axis=0) - centroid) / SCALES))
        if float(nn_distance(C, train_X).mean()) > 1.0:
            eligible.append(e)
    cands = eligible or list(pool)  # fallback: closest overall
    return min(cands, key=lambda e: (dist[e], e))


def pick_random(model: Any, T: FloatArray, pool: dict[str, FloatArray], rng: Any = None, **_: Any) -> str:
    keys = sorted(pool)
    return keys[int(rng.integers(0, len(keys)))]


PICKERS: dict[str, Callable[..., str]] = {
    "evr": pick_evr,
    "uncertainty_sampling": pick_uncertainty,
    "nearest_gap": pick_nearest_gap,
    "random": pick_random,
}


def draw_initial(
    table: dict[str, dict[str, Any]], pool_exps: list[str], y: NDArray[Any], seed: int
) -> list[str] | None:
    rng = np.random.default_rng(seed)
    for _ in range(MAX_REDRAWS):
        pick = [str(e) for e in rng.choice(pool_exps, size=N_INITIAL, replace=False)]
        labels = np.concatenate([y[table[e]["rows"]] for e in pick])
        if 0 in labels and 1 in labels:
            return sorted(pick)
    return None


def run_seed(
    ts: TrainingSet, target_experiments: tuple[str, ...], seed: int, n_rounds: int | None = None
) -> dict[str, Any] | None:
    """One seed of one scenario; None when no initial set with both labels could be drawn."""
    table = experiment_table(ts)
    target_set = set(target_experiments)
    pool_exps = [e for e in table if e not in target_set]
    t_idx = np.concatenate([table[e]["rows"] for e in target_experiments])
    T, yT = ts.X[t_idx], ts.y[t_idx].astype(float)
    initial = draw_initial(table, pool_exps, ts.y, seed)
    if initial is None:
        return None
    rows = lambda es: np.concatenate([table[e]["rows"] for e in es])  # noqa: E731
    r0 = rows(initial)
    model0 = _fit_initial(ts.X[r0], ts.y[r0].astype(float), seed)
    remaining0 = [e for e in pool_exps if e not in initial]
    R = min(10, len(remaining0)) if n_rounds is None else min(n_rounds, len(remaining0))

    def score(m: GPLaplaceClassifier) -> tuple[float, float]:
        p = m.predict_proba(T)
        return log_loss(yT, p), brier(yT, p)

    ll0, br0 = score(model0)
    out: dict[str, Any] = {"initial": initial, "initial_pool_prevalence": float(ts.y[r0].mean())}
    for strat in STRATEGIES:
        model, have, remaining = model0, list(initial), list(remaining0)
        rng = np.random.default_rng(seed * 1000 + 7)
        ll, br, picks, dists = [ll0], [br0], [], []
        for _ in range(R):
            pool = {e: ts.X[table[e]["rows"]] for e in remaining}
            train_X = ts.X[rows(have)]
            e = PICKERS[strat](model, T, pool, train_X=train_X, rng=rng)
            if e not in remaining or e in target_set:
                raise RuntimeError("strategy picked an experiment outside the pool")
            dists.append(float(np.min(np.linalg.norm((pool[e][:, None, :] - T[None]) / SCALES, axis=2))))
            have.append(e)
            remaining.remove(e)
            picks.append(e)
            r = rows(have)
            model = _refit(model, ts.X[r], ts.y[r].astype(float), seed)
            a, b = score(model)
            ll.append(a)
            br.append(b)
        out[strat] = {
            "log_loss": ll,
            "brier": br,
            "picks": picks,
            "pick_distance_to_target": dists,
            "training_experiments": sorted(have),
        }
    return out


# --------------------------------------------------------------------------------------- aggregation
def _auc(curve: FloatArray) -> float:
    """Area under the curve over n_acquired (trapezoid, x = 0..R)."""
    return float(np.sum((curve[1:] + curve[:-1]) / 2.0))


def _mean_ci(a: FloatArray) -> tuple[float, list[float]]:
    n = a.shape[0]
    m = float(a.mean())
    if n < 2:
        return m, [m, m]
    h = 1.96 * float(a.std(ddof=1)) / np.sqrt(n)
    return m, [m - h, m + h]


def boot_ci(d: FloatArray, B: int = 2000, seed: int = 0) -> list[float]:
    rng = np.random.default_rng(seed)
    means = [float(d[rng.integers(0, len(d), len(d))].mean()) for _ in range(B)]
    lo, hi = np.quantile(means, [0.025, 0.975])
    return [float(lo), float(hi)]


def aggregate_scenario(
    scenario: Scenario,
    group_id: str,
    ts: TrainingSet,
    seed_results: list[dict[str, Any]],
    n_seeds_requested: int,
) -> dict[str, Any]:
    ll = {s: np.array([r[s]["log_loss"] for r in seed_results]) for s in STRATEGIES}
    br = {s: np.array([r[s]["brier"] for r in seed_results]) for s in STRATEGIES}
    n_rounds = ll["evr"].shape[1] - 1

    def curves(arr: dict[str, FloatArray]) -> dict[str, list[dict[str, Any]]]:
        res = {}
        for s in STRATEGIES:
            rows = []
            for k in range(n_rounds + 1):
                m, ci = _mean_ci(arr[s][:, k])
                rows.append({"n_acquired": k, "mean": m, "ci95": ci})
            res[s] = rows
        return res

    auc = {s: float(np.mean([_auc(c) for c in ll[s]])) for s in STRATEGIES}
    auc_b = {s: float(np.mean([_auc(c) for c in br[s]])) for s in STRATEGIES}
    table = experiment_table(ts)
    t_idx = np.concatenate([table[e]["rows"] for e in scenario.target_experiments])
    y_t = ts.y[t_idx]
    prev = float(np.mean([r["initial_pool_prevalence"] for r in seed_results]))
    paired: dict[str, Any] = {}
    for other in ("random", "uncertainty_sampling", "nearest_gap"):
        d = np.array([_auc(a) - _auc(b) for a, b in zip(ll["evr"], ll[other], strict=True)])
        dfin = ll["evr"][:, -1] - ll[other][:, -1]
        db = np.array([_auc(a) - _auc(b) for a, b in zip(br["evr"], br[other], strict=True)])
        paired[f"evr_minus_{other}"] = {
            "metric": "area under target log-loss curve (negative favours EVR)",
            "mean_auc_difference": float(d.mean()),
            "ci95": boot_ci(d),
            "final_round_log_loss_difference": float(dfin.mean()),
            "final_round_ci95": boot_ci(dfin),
            "brier_auc_difference": float(db.mean()),
            "brier_auc_ci95": boot_ci(db),
            "fraction_seeds_evr_better": float(np.mean(d < 0)),
            "n_seeds": len(d),
        }
    diag = {
        s: {
            "mean_pick_distance_to_target_std_units": float(
                np.mean([np.mean(r[s]["pick_distance_to_target"]) for r in seed_results])
            )
        }
        for s in STRATEGIES
    }
    const_p = float(np.clip(prev, 1e-6, 1 - 1e-6))
    base_ll = log_loss(y_t.astype(float), np.full(len(y_t), const_p))
    base_br = brier(y_t.astype(float), np.full(len(y_t), const_p))
    return {
        "name": scenario.name,
        "group_id": group_id,
        "target_definition": scenario.target_definition,
        "target_experiments": list(scenario.target_experiments),
        "n_target_experiments": len(scenario.target_experiments),
        "n_target_observations": len(y_t),
        "target_class_balance": {
            "sustained": int((y_t == 1).sum()),
            "not_sustained": int((y_t == 0).sum()),
        },
        "n_pool_experiments": len(table) - len(scenario.target_experiments),
        "n_seeds": len(seed_results),
        "n_seeds_requested": n_seeds_requested,
        "n_rounds": n_rounds,
        "metric": "target log loss",
        "curves": curves(ll),
        "brier_curves": curves(br),
        "area_under_curve": auc,
        "brier_area_under_curve": auc_b,
        "majority_class_baseline": {
            "constant_probability": const_p,
            "note": "constant prediction equal to the mean seed initial-training prevalence; "
            "for reference only",
            "target_log_loss": base_ll,
            "target_brier": base_br,
            "final_round_log_loss_below_baseline": {
                st: float(ll[st][:, -1].mean()) < base_ll for st in STRATEGIES
            },
        },
        "paired_differences": paired,
        "diagnostics": diag,
        "interpretation": interpret(
            scenario.name, paired, n_rounds, len(seed_results), base_ll, float(ll["evr"][:, -1].mean())
        ),
    }


def verdict(p: dict[str, Any]) -> str:
    lo, hi = p["ci95"]
    if hi < 0:
        return "better"
    if lo > 0:
        return "worse"
    return "indistinguishable"


def interpret(
    name: str, paired: dict[str, Any], n_rounds: int, n_seeds: int, baseline: float, final_evr: float
) -> str:
    parts = []
    for other, label in (("random", "random selection"), ("uncertainty_sampling", "uncertainty sampling")):
        p = paired[f"evr_minus_{other}"]
        v = verdict(p)
        word = {
            "better": "lower (better) than",
            "worse": "higher (worse) than",
            "indistinguishable": "not distinguishable from",
        }[v]
        lo, hi = p["ci95"]
        parts.append(
            f"target log-loss area under the curve was {word} {label} "
            f"(paired difference {p['mean_auc_difference']:+.3f}, 95% bootstrap CI {lo:+.3f} to {hi:+.3f})"
        )
    return (
        f"Scenario {name}, {n_seeds} seeds, {n_rounds} acquisition rounds: "
        + "; ".join(parts)
        + f". Majority-class constant baseline log loss on the target: {baseline:.3f}; mean final EVR "
        f"log loss: {final_evr:.3f}. Small samples; interpret as indicative only."
    )


def summarize(scenarios: list[dict[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {"n_scenarios": len(scenarios)}
    for other in ("random", "uncertainty_sampling", "nearest_gap"):
        verdicts = [verdict(s["paired_differences"][f"evr_minus_{other}"]) for s in scenarios]
        out[f"evr_vs_{other}"] = {v: verdicts.count(v) for v in ("better", "indistinguishable", "worse")}
    r = out["evr_vs_random"]
    u = out["evr_vs_uncertainty_sampling"]
    n = len(scenarios)
    out["interpretation"] = (
        f"Across {n} pseudo-target scenarios, EVR had a lower target log-loss area than random selection in "
        f"{r['better']}, was indistinguishable in {r['indistinguishable']} and was worse in {r['worse']}; "
        f"versus uncertainty sampling: better in {u['better']}, indistinguishable in "
        f"{u['indistinguishable']}, worse in {u['worse']} (95% bootstrap CIs over seeds). "
        + (
            "EVR did not clearly outperform the baselines; see diagnostics. "
            if r["better"] <= r["worse"] or u["better"] <= u["worse"]
            else "The advantage is small-sample evidence only. "
        )
        + "Scenarios share the same groups and are not independent."
    )
    return out
