"""Collect every number used in the docs from the generated artifacts (no hand-typed numbers)."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

# Airflow bases (data/normalized/observations.json `airflow_basis`) grouped for the provenance sentence.
RECORDED_BASES = ("air_display", "stated_cm_s")
CONVERTED_BASES = ("pot_calibration", "fan_calibration")


def _json(root: Path, rel: str) -> Any:
    return json.loads((root / rel).read_text())


def load(root: Path) -> dict:
    latest = (root / "models/LATEST").read_text().strip()
    mdir = root / "models" / latest
    F: dict = {"root": root, "latest": latest}
    F["report"] = _json(root, "data/normalized/dataset_report.json")
    F["dataset_version"] = (root / "data/normalized/VERSION").read_text().strip()
    F["manifest"] = json.loads((mdir / "manifest.json").read_text())
    F["val"] = json.loads((mdir / "validation.json").read_text())
    retro = root / "models/retrospective" / f"{F['dataset_version']}.json"
    F["retro"] = json.loads(retro.read_text()) if retro.exists() else None
    F["retro_path"] = f"models/retrospective/{F['dataset_version']}.json"
    F["obs"] = _json(root, "data/normalized/observations.json")
    F["exp"] = _json(root, "data/normalized/experiments.json")
    F["inv"] = _json(root, "data/normalized/investigations.json")
    F["psi_catalog"] = _json(root, "data/manifests/psi_investigations.json")
    F["profiles"] = _json(root, "data/manifests/atmosphere_profiles.json")
    F["not_integrated"] = _json(root, "data/manifests/known_investigations_not_integrated.json")
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
    neg_modes = Counter((o.get("extinction_mode") or o["flame_state"]) for o in t if o["label"] == 0)
    s = {
        "n": n,
        "pos": pos,
        "neg": neg,
        "frac_pos": pos / n,
        "n_exp": len({o["experiment_id"] for o in t}),
        "confidence": dict(Counter(o["confidence"] for o in t)),
        "neg_modes": dict(neg_modes),
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


def flow_provenance(F: dict) -> dict:
    """How the airflow of each training step was obtained (D5 provenance sentence)."""
    t = training_rows(F)
    basis = Counter(o["airflow_basis"] for o in t)
    converted = [o for o in t if o["airflow_basis"] in CONVERTED_BASES]
    conv_inv = sorted({o["investigation_id"] for o in converted})
    other = {k: v for k, v in basis.items() if k not in RECORDED_BASES + CONVERTED_BASES}
    return {
        "n": len(t),
        "air": basis.get("air_display", 0),
        "stated": basis.get("stated_cm_s", 0),
        "recorded": sum(basis.get(k, 0) for k in RECORDED_BASES),
        "converted": len(converted),
        "converted_investigations": conv_inv,
        "borrowed": sum(1 for o in t if has_flag(o, "calibration_borrowed_from_bass2")),
        "borrowed_all": sum(1 for o in F["obs"] if has_flag(o, "calibration_borrowed_from_bass2")),
        "other": other,
    }


def integrated_envelope(F: dict) -> dict:
    """O2 and pressure range of every integrated model-data observation (BASS and BASS-II, all rows)."""
    model_inv = {i["investigation_id"] for i in F["inv"] if i["role"] == "integrated_model"}
    rows = [o for o in F["obs"] if o["investigation_id"] in model_inv]
    o2 = [o["oxygen_percent"] for o in rows if o.get("oxygen_percent") is not None]
    p = [o["pressure_for_analysis_kpa"] for o in rows if o.get("pressure_for_analysis_kpa") is not None]
    exps = {e["experiment_id"] for e in F["exp"] if e["investigation_id"] in model_inv}
    return {
        "n_obs": len(rows),
        "n_exp": len(exps),
        "o2_min": min(o2),
        "o2_max": max(o2),
        "p_min": min(p),
        "p_max": max(p),
        "investigations": sorted(model_inv),
    }
