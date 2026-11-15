"""Grouped cross-validation study per modelled group (shape of GET /api/model/validation `groups`).

Protocol (docs/decisions.d/model-study.md): repeated grouped K-fold by experiment (k = min(5, n_experiments),
repeats with seeds 0..4), hyperparameters refit inside every training fold. Headline metrics are computed on
the out-of-fold predictions of all repeats stacked, with 95 % percentile intervals from a group bootstrap
(whole experiments resampled with all their rows and repeats). Models: GP (chosen mean function), logistic on
O2 + flow, logistic on O2, majority class, bootstrap logistic ensemble.
"""

from __future__ import annotations

import time
from concurrent.futures import ProcessPoolExecutor
from datetime import UTC, datetime
from typing import Any

import numpy as np
import pandas as pd
from numpy.typing import NDArray

from blindspots.evaluation.blindspot_test import pointwise_log_loss, run_blindspot_test
from blindspots.evaluation.cv import CVResult, cross_validate, grouped_kfold, leave_one_group_out
from blindspots.evaluation.metrics import brier, ece_value, log_loss, reliability_curve, roc_auc
from blindspots.models.baselines import BootstrapLogisticEnsemble, LogisticO2, LogisticO2Flow, MajorityClass
from blindspots.models.features import TrainingSet
from blindspots.models.registry import (
    GroupModel,
    Registry,
    TrainConfig,
    group_frame,
    group_training_set,
    side_info,
)

FloatArray = NDArray[np.float64]
MODEL_NAMES = ("gp", "logistic_o2_flow", "logistic_o2", "majority_class", "bootstrap_logistic_ensemble")
METRICS = ("brier", "log_loss", "auc", "ece")
ERROR_BINS = 10
CV_SCHEME_FMT = "grouped {k}-fold by experiment x {r} repeats"


# --------------------------------------------------------------------------------------------- CV runs
def n_folds(ts: TrainingSet, config: TrainConfig) -> int:
    return min(config.cv_k_max, ts.n_groups)


def run_repeated_cv(
    factory: Any, ts: TrainingSet, config: TrainConfig, seeds: tuple[int, ...] | None = None
) -> list[CVResult]:
    k = n_folds(ts, config)
    out = []
    for s in seeds if seeds is not None else config.cv_seeds[: config.cv_repeats]:
        out.append(cross_validate(factory, ts, grouped_kfold(ts.groups, k, seed=s)))
    return out


def stack(results: list[CVResult], key: str = "p_mean") -> FloatArray:
    """(R, n) array of out-of-fold values for `key` over repeats."""
    return np.vstack([r.oof[key] for r in results])


def _metric_values(y: FloatArray, p: FloatArray, constant: bool = False) -> dict[str, float | None]:
    # A constant predictor has no discrimination: AUC is 0.5 by definition. Pooling per-fold constants would
    # instead give a spurious AUC (fold prevalence is anti-correlated with the held-out labels).
    auc = 0.5 if constant else roc_auc(y, p)
    return {"brier": brier(y, p), "log_loss": log_loss(y, p), "auc": auc, "ece": ece_value(y, p)}


def _quantile_ci(vals: list[float]) -> list[float] | None:
    if not vals:
        return None
    lo, hi = np.quantile(vals, [0.025, 0.975])
    return [float(lo), float(hi)]


def bootstrap_models(
    y: FloatArray,
    preds: dict[str, FloatArray],
    groups: NDArray[np.str_],
    B: int,
    seed: int,
    contrast: tuple[str, str] | None = ("gp", "majority_class"),
) -> dict[str, Any]:
    """Point estimates and paired group-bootstrap 95 % CIs for every model and metric.

    `preds[name]` has shape (R, n) (repeats stacked). Experiments are resampled with replacement, taking all
    of their rows in every repeat. Also returns paired differences (first minus second of `contrast`).
    """
    R = next(iter(preds.values())).shape[0]
    uniq = np.unique(groups)
    rows = [np.flatnonzero(groups == g) for g in uniq]
    rng = np.random.default_rng(seed)
    est = {m: _metric_values(np.tile(y, R), p.reshape(-1), m == "majority_class") for m, p in preds.items()}
    draws: dict[str, dict[str, list[float]]] = {m: {k: [] for k in METRICS} for m in preds}
    diffs: dict[str, list[float]] = {"brier": [], "log_loss": []}
    for _ in range(B):
        pick = rng.integers(0, len(rows), size=len(rows))
        idx = np.concatenate([rows[i] for i in pick])
        yy = np.tile(y[idx], R)
        vals: dict[str, dict[str, float | None]] = {}
        for m, p in preds.items():
            vals[m] = _metric_values(yy, p[:, idx].reshape(-1), m == "majority_class")
            for k in METRICS:
                v = vals[m][k]
                if v is not None and np.isfinite(v):
                    draws[m][k].append(float(v))
        if contrast is not None:
            a, b = contrast
            for k in diffs:
                va, vb = vals[a][k], vals[b][k]
                if va is not None and vb is not None:
                    diffs[k].append(float(va) - float(vb))
    out: dict[str, Any] = {
        m: {k: {"value": est[m][k], "ci95": _quantile_ci(draws[m][k])} for k in METRICS} for m in preds
    }
    contrast_out = None
    if contrast is not None:
        a, b = contrast
        contrast_out = {
            "comparison": f"{a} minus {b} (negative favours {a})",
            **{
                k: {
                    "value": None
                    if est[a][k] is None or est[b][k] is None
                    else float(est[a][k]) - float(est[b][k]),  # type: ignore[arg-type]
                    "ci95": _quantile_ci(diffs[k]),
                }
                for k in diffs
            },
        }
    return {"models": out, "contrast": contrast_out}


# ---------------------------------------------------------------------------------------- mean function
def choose_mean_function(ts: TrainingSet, config: TrainConfig) -> dict[str, Any]:
    """Choose 'constant' vs 'linear_o2' by grouped-CV log loss; keep constant unless linear is clearly better.

    Rule: linear_o2 only when the group-bootstrap 95 % CI of (linear - constant) mean log loss is entirely
    below zero. Otherwise constant (the simpler mean) is kept.
    """
    per_row: dict[str, FloatArray] = {}
    ll: dict[str, float] = {}
    for mean in config.mean_options:
        res = run_repeated_cv(lambda m=mean: config.gp_factory(m), ts, config)
        P = stack(res)
        losses = np.vstack([pointwise_log_loss(ts.y.astype(float), p) for p in P])
        per_row[mean] = losses.mean(axis=0)
        ll[mean] = float(losses.mean())
    chosen = "constant"
    ci: list[float] | None = None
    diff: float | None = None
    if "linear_o2" in per_row and "constant" in per_row:
        d = per_row["linear_o2"] - per_row["constant"]
        uniq = np.unique(ts.groups)
        rows = [np.flatnonzero(ts.groups == g) for g in uniq]
        rng = np.random.default_rng(config.seed)
        boots = []
        for _ in range(config.n_bootstrap):
            pick = rng.integers(0, len(rows), size=len(rows))
            boots.append(float(d[np.concatenate([rows[i] for i in pick])].mean()))
        diff = float(d.mean())
        ci = _quantile_ci(boots)
        if ci is not None and ci[1] < 0.0:
            chosen = "linear_o2"
    return {
        "chosen": chosen,
        "cv_log_loss": ll,
        "diff_log_loss_linear_minus_constant": diff,
        "diff_ci95": ci,
        "rule": "keep 'constant' unless the 95% group-bootstrap CI of (linear_o2 - constant) log loss < 0",
    }


# ----------------------------------------------------------------------------------------- sub-analyses
def _subgroups(ts: TrainingSet, side: dict[str, np.ndarray], P_gp: FloatArray) -> list[dict[str, Any]]:
    y = ts.y.astype(float)
    o2 = ts.X[:, 0]
    flow = np.expm1(ts.X[:, 1])
    conf = side["confidence"]
    defs: list[tuple[str, np.ndarray]] = [
        ("O2 < 17 %", o2 < 17.0),
        ("O2 17-20 %", (o2 >= 17.0) & (o2 <= 20.0)),
        ("O2 > 20 %", o2 > 20.0),
        ("airflow < 3 cm/s", flow < 3.0),
        ("airflow 3-10 cm/s", (flow >= 3.0) & (flow <= 10.0)),
        ("airflow > 10 cm/s", flow > 10.0),
        ("confidence high", conf == "high"),
        ("confidence medium", conf == "medium"),
    ]
    out = []
    for name, mask in defs:
        n = int(mask.sum())
        if n == 0:
            out.append({"name": name, "n": 0, "n_not_sustained": 0, "brier": None, "log_loss": None})
            continue
        yy = np.tile(y[mask], P_gp.shape[0])
        pp = P_gp[:, mask].reshape(-1)
        out.append(
            {
                "name": name,
                "n": n,
                "n_not_sustained": int((y[mask] == 0).sum()),
                "brier": brier(yy, pp),
                "log_loss": log_loss(yy, pp),
            }
        )
    return out


def _logo(ts: TrainingSet, config: TrainConfig, mean: str) -> dict[str, Any]:
    campaigns = np.unique(ts.campaign_group)
    if campaigns.size < 2:
        return {"applicable": False, "reason": "group spans a single campaign", "folds": []}
    splits = leave_one_group_out(ts.campaign_group)
    gp = cross_validate(lambda: config.gp_factory(mean), ts, splits)
    maj = cross_validate(MajorityClass, ts, splits)
    folds = []
    for fm, mm, camp in zip(gp.fold_metrics, maj.fold_metrics, campaigns, strict=True):
        te = ts.campaign_group == camp
        folds.append(
            {
                "held_out": str(camp),
                "n": int(fm["n_test"]),
                "n_experiments": len(set(ts.groups[te].tolist())),
                "n_not_sustained": int((ts.y[te] == 0).sum()),
                "brier": fm["brier"],
                "log_loss": fm["log_loss"],
                "auc": fm["roc_auc"],
                "majority_brier": mm["brier"],
                "majority_log_loss": mm["log_loss"],
            }
        )
    return {"applicable": True, "folds": folds}


def _sensitivity(
    obs: pd.DataFrame,
    exp: pd.DataFrame,
    group_id: str,
    config: TrainConfig,
    mean: str,
    primary: dict[str, float | None],
    primary_n: int,
) -> list[dict[str, Any]]:
    variants: list[tuple[str, dict[str, Any], TrainConfig]] = [
        ("add low-confidence rows", {"add_low_confidence": True}, config),
        ("O2 initial value only", {"o2_initial_only": True, "experiments": exp}, config),
        ("drop below_calibration_range rows", {"drop_flags": ("below_calibration_range",)}, config),
        ("drop flow_off_transient rows", {"drop_flags": ("flow_off_transient",)}, config),
        ("drop no_sustained_propagation rows", {"drop_flags": ("no_sustained_propagation",)}, config),
    ]
    out: list[dict[str, Any]] = []
    for name, kw, cfg in variants:
        frame = group_frame(obs, group_id, cfg, **kw)
        out.append(_eval_variant(name, frame, group_id, cfg, mean, primary, primary_n))
    frame = group_frame(obs, group_id, config)
    for lp in (0.15, 0.3, 0.6):
        if lp == config.pressure_length_scale:
            continue
        cfg = TrainConfig.from_dict({**config.to_dict(), "pressure_length_scale": lp})
        out.append(
            _eval_variant(
                f"pressure length scale {lp} (ln units)", frame, group_id, cfg, mean, primary, primary_n
            )
        )
    return out


def _eval_variant(
    name: str,
    frame: pd.DataFrame,
    group_id: str,
    config: TrainConfig,
    mean: str,
    primary: dict[str, float | None],
    primary_n: int,
) -> dict[str, Any]:
    base: dict[str, Any] = {"variant": name, "n_training": len(frame)}
    if frame.empty:
        empty: dict[str, Any] = dict.fromkeys(("brier", "log_loss", "auc", "delta_vs_primary"))
        return {**base, **empty, "n_experiments": 0, "note": "no rows"}
    ts = group_training_set(frame, group_id)
    base["n_experiments"] = ts.n_groups
    base["n_not_sustained"] = int((ts.y == 0).sum())
    if ts.n_groups < 3 or np.unique(ts.y).size < 2:
        return {**base, "brier": None, "log_loss": None, "auc": None, "delta_vs_primary": None,
                "note": "too few experiments or a single class; not evaluated"}  # fmt: skip
    res = run_repeated_cv(lambda: config.gp_factory(mean), ts, config)
    P = stack(res)
    m = _metric_values(np.tile(ts.y.astype(float), P.shape[0]), P.reshape(-1))
    maj = stack(run_repeated_cv(MajorityClass, ts, config))
    mm = _metric_values(np.tile(ts.y.astype(float), maj.shape[0]), maj.reshape(-1))
    d_ll = (
        None if primary["log_loss"] is None or m["log_loss"] is None else m["log_loss"] - primary["log_loss"]
    )
    d_b = None if primary["brier"] is None or m["brier"] is None else m["brier"] - primary["brier"]
    d_a = None if primary["auc"] is None or m["auc"] is None else m["auc"] - primary["auc"]
    return {
        **base,
        "brier": m["brier"],
        "log_loss": m["log_loss"],
        "auc": m["auc"],
        "delta_vs_primary": d_ll,
        "delta_log_loss": d_ll,
        "delta_brier": d_b,
        "delta_auc": d_a,
        "majority_log_loss": mm["log_loss"],
        "note": (
            f"evaluated on its own {ts.n} rows (primary: {primary_n}); delta is variant minus primary "
            "log loss, not a like-for-like comparison when the row set differs"
        ),
    }


def _error_distribution(y: FloatArray, p_gp: FloatArray) -> dict[str, Any]:
    err = np.abs(np.tile(y, p_gp.shape[0]) - p_gp.reshape(-1))
    counts, edges = np.histogram(err, bins=ERROR_BINS, range=(0.0, 1.0))
    return {
        "variable": "absolute error |y - p| of out-of-fold GP predictions",
        "bins": [float(e) for e in edges],
        "counts": [int(c) for c in counts],
        "note": "bins are the ERROR_BINS+1 bin edges; counts pool all repeats",
    }


# --------------------------------------------------------------------------------------------- one group
def validate_group(
    obs: pd.DataFrame,
    exp: pd.DataFrame,
    gm_meta: dict[str, Any],
    config: TrainConfig,
    with_blindspot: bool = True,
) -> dict[str, Any]:
    t0 = time.time()
    group_id = gm_meta["group_id"]
    mean = gm_meta["mean_function"]
    frame = group_frame(obs, group_id, config)
    ts = group_training_set(frame, group_id)
    side = side_info(frame, ts)
    y = ts.y.astype(float)
    k = n_folds(ts, config)

    cv_gp = run_repeated_cv(lambda: config.gp_factory(mean), ts, config)
    preds: dict[str, FloatArray] = {"gp": stack(cv_gp)}
    for name, fac in (
        ("logistic_o2_flow", LogisticO2Flow),
        ("logistic_o2", LogisticO2),
        ("majority_class", MajorityClass),
        (
            "bootstrap_logistic_ensemble",
            lambda: BootstrapLogisticEnsemble(n_boot=config.ensemble_members, seed=config.seed),
        ),
    ):
        preds[name] = stack(run_repeated_cv(fac, ts, config))
    boot = bootstrap_models(y, preds, ts.groups, config.n_bootstrap, config.seed)
    n1, n0 = int((ts.y == 1).sum()), int((ts.y == 0).sum())
    cv = {
        "scheme": CV_SCHEME_FMT.format(k=k, r=len(cv_gp)),
        "k": k,
        "repeats": len(cv_gp),
        "seeds": list(config.cv_seeds[: len(cv_gp)]),
        "gp_mean_function": mean,
        "n_pooled_predictions": int(preds["gp"].size),
        "models": [{"name": name, **boot["models"][name]} for name in MODEL_NAMES],
        "gp_vs_majority": boot["contrast"],
        "ci_method": f"percentile, group bootstrap over experiments (B={config.n_bootstrap})",
    }
    primary = {m: boot["models"]["gp"][m]["value"] for m in METRICS}

    curve = reliability_curve(np.tile(y, preds["gp"].shape[0]), preds["gp"].reshape(-1))
    reliability = {
        "model": "GP",
        "n_pooled_predictions": int(preds["gp"].size),
        "bins": [
            {
                "lo": float(curve["bin_edges"][i]),
                "hi": float(curve["bin_edges"][i + 1]),
                "count": int(curve["counts"][i]),
                "mean_predicted": _nan_none(curve["mean_predicted"][i]),
                "observed_frequency": _nan_none(curve["observed_frequency"][i]),
            }
            for i in range(len(curve["counts"]))
        ],
    }
    result: dict[str, Any] = {
        "group_id": group_id,
        "label": gm_meta.get("label"),
        "n_experiments": ts.n_groups,
        "n_observations": ts.n,
        "label_counts": {"sustained": n1, "not_sustained": n0},
        "majority_class_fraction": max(n1, n0) / ts.n,
        "campaigns": sorted(set(ts.campaign_group.tolist())),
        "small_sample_warning": _small_sample(ts.n_groups, n0),
        "cv": cv,
        "logo": _logo(ts, config, mean),
        "reliability": reliability,
        "error_distribution": _error_distribution(y, preds["gp"]),
        "subgroups": _subgroups(ts, side, preds["gp"]),
        "sensitivity": _sensitivity(obs, exp, group_id, config, mean, primary, ts.n),
    }
    if with_blindspot:
        oof_mean = {
            key: np.vstack([r.oof[key] for r in cv_gp]).mean(axis=0)
            for key in ("p_mean", "epistemic", "aleatoric")
        }
        loss = np.vstack([pointwise_log_loss(y, r.oof["p_mean"]) for r in cv_gp]).mean(axis=0)
        result["blindspot_test"] = run_blindspot_test(
            ts, oof_mean, config, mean, side["flow_off_transient"], loss
        )
    result["runtime_s"] = round(time.time() - t0, 1)
    return result


def _nan_none(v: Any) -> float | None:
    f = float(v)
    return f if np.isfinite(f) else None


def _small_sample(n_experiments: int, n_not_sustained: int) -> str | None:
    msgs = []
    if n_experiments < 30:
        msgs.append(f"{n_experiments} experiments")
    if n_not_sustained < 20:
        msgs.append(f"only {n_not_sustained} not-sustained observations")
    return (
        ("Small sample: " + "; ".join(msgs) + ". Intervals are wide and metrics are unstable.")
        if msgs
        else None
    )


def _job(args: tuple[pd.DataFrame, pd.DataFrame, dict[str, Any], TrainConfig, bool]) -> dict[str, Any]:
    return validate_group(*args)


def _gm_meta(gm: GroupModel) -> dict[str, Any]:
    return {"group_id": gm.group_id, "mean_function": gm.mean_function, "label": gm.label}


def run_validation(
    reg: Registry,
    observations: pd.DataFrame,
    experiments: pd.DataFrame,
    workers: int = 1,
    with_blindspot: bool = True,
) -> dict[str, Any]:
    """Validate every modelled group of `reg`; stores the result on `reg.validation` and returns it."""
    t0 = time.time()
    modelled = [gm for gm in reg.groups.values() if gm.model_status == "modeled" and gm.model is not None]
    jobs = [(observations, experiments, _gm_meta(gm), reg.config, with_blindspot) for gm in modelled]
    if workers > 1 and len(jobs) > 1:
        with ProcessPoolExecutor(max_workers=min(workers, len(jobs))) as pool:
            results = list(pool.map(_job, jobs))
    else:
        results = [_job(j) for j in jobs]
    results.sort(key=lambda r: (-r["n_observations"], r["group_id"]))
    for r in results:
        gm = reg.groups[r["group_id"]]
        gp = next(m for m in r["cv"]["models"] if m["name"] == "gp")
        maj = next(m for m in r["cv"]["models"] if m["name"] == "majority_class")
        gm.metrics_summary.update(
            {
                "cv_scheme": r["cv"]["scheme"],
                "gp": {k: gp[k] for k in METRICS},
                "majority_class": {k: maj[k] for k in METRICS},
                "gp_vs_majority": r["cv"]["gp_vs_majority"],
                "n_experiments": r["n_experiments"],
                "label_counts": r["label_counts"],
                "small_sample_warning": r["small_sample_warning"],
            }
        )
    validation = {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "dataset_version": reg.dataset_version,
        "model_version": reg.model_version,
        "groups": results,
        "not_modelled": {
            gid: gm.model_reason for gid, gm in sorted(reg.groups.items()) if gm.model_status != "modeled"
        },
        "acquisition_retrospective": None if reg.retrospective is None else reg.retrospective,
        "runtime_s": round(time.time() - t0, 1),
    }
    reg.validation = validation
    return validation
