"""`blindspots train`: fit per-group GP models, validate them, run the blind-spot test, save artifacts."""

from __future__ import annotations

import os
import time

from blindspots.models.registry import (
    Registry,
    TrainConfig,
    load_dataset,
    save_registry,
    train_registry,
)


def _fmt(v: float | None) -> str:
    return "  n/a " if v is None else f"{v:6.3f}"


def summary_table(reg: Registry) -> str:
    lines = [
        f"model_version {reg.model_version}   dataset_version {reg.dataset_version}",
        f"{'group':28s} {'exp':>4s} {'n':>4s} {'neg':>4s} {'mean':>9s} {'GP ll':>7s} {'maj ll':>7s} "
        f"{'GP brier':>8s} {'maj br':>7s} {'GP auc':>7s}  blind-spot",
    ]
    val = (reg.validation or {}).get("groups", [])
    by_id = {g["group_id"]: g for g in val}
    for gid, gm in sorted(reg.groups.items()):
        if gid not in by_id:
            lines.append(f"{gid:28s} {gm.model_status}: {gm.model_reason}")
            continue
        g = by_id[gid]
        models = {m["name"]: m for m in g["cv"]["models"]}
        gp, mj = models["gp"], models["majority_class"]
        bt = g.get("blindspot_test", {}).get("verdict", "-")
        lines.append(
            f"{gid:28s} {g['n_experiments']:4d} {g['n_observations']:4d} "
            f"{g['label_counts']['not_sustained']:4d} {gm.mean_function or '-':>9s} "
            f"{_fmt(gp['log_loss']['value']):>7s} {_fmt(mj['log_loss']['value']):>7s} "
            f"{_fmt(gp['brier']['value']):>8s} {_fmt(mj['brier']['value']):>7s} "
            f"{_fmt(gp['auc']['value']):>7s}  {bt}"
        )
    return "\n".join(lines)


def main() -> None:
    from blindspots.evaluation.validation import run_validation

    t0 = time.time()
    config = TrainConfig()
    workers = max(1, min(6, (os.cpu_count() or 2) - 1))
    obs, exp, dsv = load_dataset()
    print(f"dataset {dsv}: {len(obs)} observations, {len(exp)} experiments; workers={workers}", flush=True)
    reg = train_registry(config, obs, exp, dsv, workers=workers)
    n_mod = sum(g.model_status == "modeled" for g in reg.groups.values())
    print(f"fitted {n_mod}/{len(reg.groups)} modelled groups in {reg.timings_s['fit']} s", flush=True)
    val = run_validation(reg, obs, exp, workers=workers)
    reg.timings_s["validation"] = val["runtime_s"]
    reg.timings_s["total"] = round(time.time() - t0, 1)
    vdir = save_registry(reg)
    print(summary_table(reg))
    print(f"timings (s): {reg.timings_s}")
    print(f"saved {vdir}")
