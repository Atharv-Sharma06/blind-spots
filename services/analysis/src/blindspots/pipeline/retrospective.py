"""Run the acquisition retrospective and write models/retrospective/<dataset_version>.json."""

from __future__ import annotations

import json
import os
import time
from concurrent.futures import ProcessPoolExecutor
from datetime import date
from typing import Any

import pandas as pd

from blindspots import config
from blindspots.evaluation.retrospective import (
    STRATEGIES,
    Scenario,
    aggregate_scenario,
    define_scenarios,
    run_seed,
    summarize,
)
from blindspots.models.features import TrainingSet, build_training_set
from blindspots.models.groups import assign_group_ids, parse_group_id, summarize_groups

N_SEEDS = 20
MIN_EXPERIMENTS = 12


def _task(args: tuple[TrainingSet, tuple[str, ...], int]) -> dict[str, Any] | None:
    ts, targets, seed = args
    return run_seed(ts, targets, seed)


def load_observations() -> pd.DataFrame:
    return pd.read_csv(config.NORMALIZED_DIR / "observations.csv", low_memory=False)


def main(n_seeds: int = N_SEEDS) -> None:
    t0 = time.time()
    obs = load_observations()
    obs["included_in_training"] = obs["included_in_training"].astype(str).str.lower().eq("true")
    version = config.dataset_version() or "unknown"
    summaries = [g for g in summarize_groups(obs) if g["model_status"] == "modeled"]
    obs["group_id"] = assign_group_ids(obs)
    jobs: list[tuple[str, Scenario, TrainingSet]] = []
    skipped: list[dict[str, str]] = []
    groups_used = []
    for g in summaries:
        gid = g["group_id"]
        fam, cfg = parse_group_id(gid)
        ts = build_training_set(obs, fam, cfg)
        n_exp = ts.n_groups
        if n_exp < MIN_EXPERIMENTS:
            skipped.append({"group_id": gid, "reason": f"{n_exp} training experiments (< {MIN_EXPERIMENTS})"})
            continue
        groups_used.append(
            {"group_id": gid, "n_training_experiments": n_exp, "n_training_observations": ts.n}
        )
        scens, sk = define_scenarios(ts)
        skipped += [{"group_id": gid, **s} for s in sk]
        jobs += [(gid, s, ts) for s in scens]
    tasks = [(ts, s.target_experiments, seed) for _, s, ts in jobs for seed in range(n_seeds)]
    workers = max(1, min(os.cpu_count() or 1, 8))
    with ProcessPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(_task, tasks, chunksize=1))
    scenarios = []
    for i, (gid, s, ts) in enumerate(jobs):
        chunk = [r for r in results[i * n_seeds : (i + 1) * n_seeds] if r is not None]
        if not chunk:
            skipped.append(
                {
                    "group_id": gid,
                    "name": s.name,
                    "reason": "no seed produced an initial set with both labels",
                }
            )
            continue
        scenarios.append(aggregate_scenario(s, gid, ts, chunk, n_seeds))
    runtime = time.time() - t0
    payload = {
        "dataset_version": version,
        "generated_on": date.today().isoformat(),
        "runtime_seconds": round(runtime, 1),
        "design": {
            "strategies": list(STRATEGIES),
            "seeds": n_seeds,
            "groups_used": groups_used,
            "skipped": skipped,
            "description": (
                "Per modelled group with >= 12 training experiments, target experiments (a lowest-O2 "
                "quartile, "
                "a lowest-minimum-airflow quartile and one campaign) are held out of the pool. Each seed "
                "draws "
                "3 random pool experiments (both labels present, <= 50 redraws) as the initial training set; "
                "then up to 10 rounds, each strategy picking one whole experiment from the remaining pool. "
                "EVR value of an experiment = joint block expected variance reduction of its observation "
                "points over the target points (uniform weights = held-out observation coordinates). "
                "Baselines: uncertainty_sampling (mean epistemic MI over the experiment's points), "
                "nearest_gap (experiment centroid closest to target centroid in standardized units among "
                "experiments with mean nn distance to training > 1; fallback closest), random (seeded). "
                "Evaluation: log loss and Brier on held-out target observations (never in training). "
                "Hyperparameters: MAP-II on the current training set only (3 restarts initially, then "
                "warm-started single-restart refits); pressure length scale fixed at 0.3."
            ),
            "limitations": [
                "Every observation is at ~1 atm, so pressure plays no role in this evaluation.",
                "Targets are real experiments of the same groups and may be easy or hard for reasons "
                "unrelated to acquisition; classes are imbalanced (mostly sustained).",
                "Scenarios in one group share experiments and are not independent; seeds are not independent "
                "samples of the world, only of initial sets.",
                "Experiments are the acquisition unit; the real candidate set (single points) differs.",
            ],
        },
        "acquisition_retrospective": {
            "scenarios": scenarios,
            "summary": summarize(scenarios) if scenarios else None,
        },
    }
    out_dir = config.MODELS_DIR / "retrospective"
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{version}.json"
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {path} ({len(scenarios)} scenarios, {runtime:.0f}s)")
    if scenarios:
        print(summarize(scenarios)["interpretation"])
