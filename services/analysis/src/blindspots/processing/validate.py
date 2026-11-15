"""Record validation: Pydantic re-validation, range checks (flags, never silent fixes), missing values."""

from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from typing import Any

from pydantic import BaseModel, ValidationError

from blindspots.schemas import ExperimentRecord, Investigation, Observation

#: (field, low, high, flag) - values outside [low, high] get the flag; values are never altered
EXPERIMENT_RANGES: tuple[tuple[str, float, float, str], ...] = (
    ("oxygen_percent", 10.0, 40.0, "o2_out_of_range"),
    ("oxygen_percent_initial", 10.0, 40.0, "o2_initial_out_of_range"),
    ("oxygen_percent_final", 10.0, 40.0, "o2_final_out_of_range"),
    ("total_pressure_kpa", 20.0, 150.0, "pressure_out_of_range"),
    ("pressure_assumed_kpa", 20.0, 150.0, "pressure_assumed_out_of_range"),
    ("airflow_cm_s", 0.0, 60.0, "airflow_out_of_range"),
    ("airflow_min_cm_s", 0.0, 60.0, "airflow_min_out_of_range"),
    ("airflow_max_cm_s", 0.0, 60.0, "airflow_max_out_of_range"),
    ("co2_percent_initial", 0.0, 5.0, "co2_initial_out_of_range"),
    ("co2_percent_final", 0.0, 5.0, "co2_final_out_of_range"),
    ("co_ppm_initial", 0.0, 2000.0, "co_initial_out_of_range"),
    ("co_ppm_final", 0.0, 2000.0, "co_final_out_of_range"),
)
OBSERVATION_RANGES: tuple[tuple[str, float, float, str], ...] = (
    ("oxygen_percent", 10.0, 40.0, "o2_out_of_range"),
    ("airflow_cm_s", 0.0, 60.0, "airflow_out_of_range"),
    ("pressure_for_analysis_kpa", 20.0, 150.0, "pressure_out_of_range"),
)


def add_flag(model: BaseModel, flag: str) -> None:
    flags: list[str] = model.quality_flags  # type: ignore[attr-defined]
    if flag not in flags:
        flags.append(flag)


def apply_range_checks(
    experiments: Sequence[ExperimentRecord], observations: Sequence[Observation]
) -> dict[str, int]:
    """Flag out-of-range values; return counts per flag."""
    counts: Counter[str] = Counter()
    for models, ranges in ((experiments, EXPERIMENT_RANGES), (observations, OBSERVATION_RANGES)):
        for m in models:
            for field_name, lo, hi, flag in ranges:
                v = getattr(m, field_name)
                if v is not None and not lo <= v <= hi:
                    add_flag(m, flag)
                    counts[flag] += 1
    return dict(sorted(counts.items()))


def revalidate(
    investigations: Sequence[Investigation],
    experiments: Sequence[ExperimentRecord],
    observations: Sequence[Observation],
) -> list[str]:
    """Round-trip every record through its Pydantic model; returns error messages (empty when valid)."""
    errors: list[str] = []
    for kind, models in (
        ("investigation", investigations),
        ("experiment", experiments),
        ("observation", observations),
    ):
        for m in models:
            try:
                type(m).model_validate(m.model_dump())
            except ValidationError as exc:
                ident = getattr(m, "experiment_id", None) or getattr(m, "investigation_id", "?")
                errors.append(f"{kind} {ident}: {exc.errors()[0]['msg']}")
    return errors


def missing_value_table(
    models: Sequence[BaseModel], fields: Sequence[str] | None = None
) -> dict[str, dict[str, Any]]:
    """Per field: how many of the records have it missing (None)."""
    total = len(models)
    names = list(fields) if fields else (list(type(models[0]).model_fields) if models else [])
    table: dict[str, dict[str, Any]] = {}
    for name in names:
        missing = sum(1 for m in models if getattr(m, name) is None)
        table[name] = {
            "missing": missing,
            "total": total,
            "fraction_missing": round(missing / total, 4) if total else None,
        }
    return table
