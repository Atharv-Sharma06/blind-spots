"""Collect every number used in the docs from the generated artifacts (no hand-typed numbers)."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path


def load(root: Path) -> dict:
    j = lambda p: json.loads((root / p).read_text())  # noqa: E731
    latest = (root / "models/LATEST").read_text().strip()
    mdir = root / "models" / latest
    F: dict = {"root": root, "latest": latest}
    F["report"] = j("data/normalized/dataset_report.json")
    F["dataset_version"] = (root / "data/normalized/VERSION").read_text().strip()
    F["manifest"] = json.loads((mdir / "manifest.json").read_text())
    F["val"] = json.loads((mdir / "validation.json").read_text())
    retro = root / "models/retrospective" / f"{F['dataset_version']}.json"
    F["retro"] = json.loads(retro.read_text()) if retro.exists() else None
    F["retro_path"] = f"models/retrospective/{F['dataset_version']}.json"
    F["obs"] = j("data/normalized/observations.json")
    F["exp"] = j("data/normalized/experiments.json")
    F["inv"] = j("data/normalized/investigations.json")
    F["profiles"] = j("data/manifests/atmosphere_profiles.json")
    F["not_integrated"] = j("data/manifests/known_investigations_not_integrated.json")
    F["mdir"] = f"models/{latest}"
    return F


def training_rows(F: dict) -> list[dict]:
    return [o for o in F["obs"] if o.get("included_in_training") and o.get("label") is not None]


def has_flag(o: dict, flag: str) -> bool:
    q = o.get("quality_flags") or []
    if isinstance(q, str):
        q = [x.strip() for x in q.split(";")]
    return flag in q


def training_summary(F: dict) -> dict:
    t = training_rows(F)
    n = len(t)
    pos = sum(1 for o in t if o["label"] == 1)
    neg = n - pos
    s = {
        "n": n,
        "pos": pos,
        "neg": neg,
        "frac_pos": pos / n,
        "n_exp": len({o["experiment_id"] for o in t}),
        "confidence": dict(Counter(o["confidence"] for o in t)),
        "neg_modes": dict(
            Counter(
                (o.get("extinction_mode") or o["flame_state"]) for o in t if o["label"] == 0
            )
        ),
        "flow_off": sum(1 for o in t if o["label"] == 0 and has_flag(o, "flow_off_transient")),
        "below_cal": sum(1 for o in t if has_flag(o, "below_calibration_range")),
        "o2_interp": sum(1 for o in t if has_flag(o, "o2_interpolated")),
        "o2_initial_only": sum(1 for o in t if has_flag(o, "o2_initial_only")),
        "calib_borrowed": sum(1 for o in t if has_flag(o, "calibration_borrowed_from_bass2")),
        "basis": dict(Counter(o["airflow_basis"] for o in t)),
        "campaign": dict(Counter(o["campaign_group"] for o in t)),
        "p_min": min(o["pressure_for_analysis_kpa"] for o in t),
        "p_max": max(o["pressure_for_analysis_kpa"] for o in t),
        "o2_min": min(o["oxygen_percent"] for o in t),
        "o2_max": max(o["oxygen_percent"] for o in t),
        "u_min": min(o["airflow_cm_s"] for o in t),
        "u_max": max(o["airflow_cm_s"] for o in t),
        "pressure_assumed": sum(1 for o in t if has_flag(o, "pressure_assumed")),
    }
    return s
