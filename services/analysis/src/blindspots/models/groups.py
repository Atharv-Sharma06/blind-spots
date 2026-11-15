"""Analysis groups: the unit of modelling and coverage.

An analysis group is one material family plus one flame configuration (for example PMMA rods in axial
stagnation flow). Observations are only compared, covered and modelled within a group, because material,
geometry and flow configuration change flammability behaviour (CONTRACTS section 4, API.md "Concepts").
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd

GROUP_SEP = "__"

FAMILY_LABELS: dict[str, str] = {
    "pmma_thin_film": "Thin PMMA films",
    "pmma_slab": "PMMA slabs",
    "pmma_rod": "PMMA rods",
    "pmma_sphere": "PMMA spheres",
    "sibal_fabric": "SIBAL cotton/fiberglass fabric",
    "nomex_fabric": "Nomex fabric",
    "ultem_sheet": "Ultem sheet",
    "wax_candle": "Wax candles",
    "paraffin_slab": "Paraffin wax slabs",
    "other": "Other materials",
}

CONFIGURATION_LABELS: dict[str, str] = {
    "opposed": "opposed flow",
    "concurrent": "concurrent flow",
    "stagnation": "axial stagnation flow",
    "wake": "wake ignition",
    "mixed": "mixed configuration",
    "unknown": "configuration not recorded",
}

# Modelability rule (documented in docs/decisions.md D-007): enough independent experiments for grouped
# cross-validation and both outcomes observed in more than one experiment.
MIN_TRAINING_EXPERIMENTS = 6
MIN_SUSTAINED = 3
MIN_NOT_SUSTAINED = 3
MIN_EXPERIMENTS_WITH_NOT_SUSTAINED = 2


@dataclass(frozen=True)
class Modelability:
    status: str  # "modeled" | "insufficient_data"
    reason: str | None


def make_group_id(material_family: str, flame_configuration: str) -> str:
    return f"{material_family}{GROUP_SEP}{flame_configuration}"


def parse_group_id(group_id: str) -> tuple[str, str]:
    family, sep, configuration = group_id.partition(GROUP_SEP)
    if not sep or not family or not configuration:
        raise ValueError(f"not a group id: {group_id!r}")
    return family, configuration


def group_label(material_family: str, flame_configuration: str) -> str:
    family = FAMILY_LABELS.get(material_family, material_family)
    configuration = CONFIGURATION_LABELS.get(flame_configuration, flame_configuration)
    return f"{family} · {configuration}"


def assign_group_ids(frame: pd.DataFrame) -> pd.Series:
    """Group id per row of an experiments or observations table; None when the family is unknown."""

    families = frame["material_family"] if "material_family" in frame else pd.Series(None, index=frame.index)
    configs = (
        frame["flame_configuration"] if "flame_configuration" in frame else pd.Series(None, index=frame.index)
    )
    ids: list[str | None] = []
    for family, configuration in zip(families, configs, strict=True):
        if not isinstance(family, str) or not family:
            ids.append(None)
            continue
        if not isinstance(configuration, str) or not configuration:
            configuration = "unknown"
        ids.append(make_group_id(family, configuration))
    return pd.Series(ids, index=frame.index, dtype=object)


def training_rows(observations: pd.DataFrame) -> pd.DataFrame:
    """Rows usable for training: included by the documented training filter and labelled."""
    mask = observations["included_in_training"].astype(bool) & observations["label"].notna()
    return observations.loc[mask]


def modelability(group_training: pd.DataFrame) -> Modelability:
    """Apply the documented modelability rule to one group's training rows."""
    n_experiments = int(group_training["experiment_id"].nunique()) if not group_training.empty else 0
    labels = group_training["label"].astype(float) if not group_training.empty else pd.Series(dtype=float)
    n_sustained = int((labels == 1).sum())
    n_not = int((labels == 0).sum())
    n_exp_not = (
        int(group_training.loc[labels == 0, "experiment_id"].nunique()) if not group_training.empty else 0
    )
    problems: list[str] = []
    if n_experiments < MIN_TRAINING_EXPERIMENTS:
        problems.append(f"{n_experiments} training experiments (needs ≥ {MIN_TRAINING_EXPERIMENTS})")
    if n_sustained < MIN_SUSTAINED:
        problems.append(f"{n_sustained} sustained observations (needs ≥ {MIN_SUSTAINED})")
    if n_not < MIN_NOT_SUSTAINED:
        problems.append(f"{n_not} not-sustained observations (needs ≥ {MIN_NOT_SUSTAINED})")
    if n_exp_not < MIN_EXPERIMENTS_WITH_NOT_SUSTAINED:
        needed = MIN_EXPERIMENTS_WITH_NOT_SUSTAINED
        problems.append(f"not-sustained outcomes in {n_exp_not} experiment(s) (needs ≥ {needed})")
    if problems:
        return Modelability("insufficient_data", "; ".join(problems))
    return Modelability("modeled", None)


def _range(values: pd.Series) -> list[float] | None:
    finite = pd.to_numeric(values, errors="coerce").dropna()
    if finite.empty:
        return None
    return [float(finite.min()), float(finite.max())]


def summarize_groups(observations: pd.DataFrame) -> list[dict[str, Any]]:
    """Per-group counts, ranges and modelability (the /api/groups payload without registry overrides).

    Expects the normalized observations table (CONTRACTS section 3). Sorted by training size, descending.
    """
    obs = observations.copy()
    obs["group_id"] = assign_group_ids(obs)
    obs = obs.loc[obs["group_id"].notna()]
    out: list[dict[str, Any]] = []
    for gid, rows in obs.groupby("group_id", sort=True):
        family, configuration = parse_group_id(str(gid))
        train = training_rows(rows)
        labels = train["label"].astype(float)
        verdict = modelability(train)
        measured = rows["total_pressure_kpa"].notna() if "total_pressure_kpa" in rows else None
        out.append(
            {
                "group_id": str(gid),
                "material_family": family,
                "flame_configuration": configuration,
                "label": group_label(family, configuration),
                "campaigns": sorted({str(c) for c in rows["campaign_group"].dropna()}),
                "n_experiments": int(rows["experiment_id"].nunique()),
                "n_observations": len(rows),
                "n_training": len(train),
                "label_counts": {
                    "sustained": int((labels == 1).sum()),
                    "not_sustained": int((labels == 0).sum()),
                },
                "oxygen_percent_range": _range(rows["oxygen_percent"]),
                "airflow_cm_s_range": _range(rows["airflow_cm_s"]),
                "pressure_kpa_range": _range(rows["pressure_for_analysis_kpa"]),
                "pressure_measured": bool(measured.all()) if measured is not None and len(rows) else False,
                "model_status": verdict.status,
                "model_reason": verdict.reason,
            }
        )
    out.sort(key=lambda g: (-g["n_training"], g["group_id"]))
    return out
