"""Duplicate detection: repeated experiment ids are errors; identical conditions are flagged."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass, field

from blindspots.processing.validate import add_flag
from blindspots.schemas import ExperimentRecord

POSSIBLE_DUPLICATE = "possible_duplicate"


@dataclass
class DuplicateReport:
    id_errors: list[str] = field(default_factory=list)
    possible_duplicates: list[list[str]] = field(default_factory=list)


def _conditions(e: ExperimentRecord) -> tuple[object, ...]:
    return (
        e.investigation_id,
        e.sample_id,
        e.test_date,
        e.oxygen_percent_initial,
        e.oxygen_percent_final,
        e.total_pressure_atm_raw,
        e.flow_restrictor,
        e.material_type,
        e.flame_configuration,
        e.airflow_min_cm_s,
        e.airflow_max_cm_s,
        e.n_observations,
    )


def find_duplicates(experiments: Sequence[ExperimentRecord]) -> DuplicateReport:
    """Report repeated ``experiment_id`` values (errors) and groups with the same sample, date and
    identical conditions (flagged ``possible_duplicate``; nothing is removed)."""
    report = DuplicateReport()
    by_id: dict[str, int] = defaultdict(int)
    for e in experiments:
        by_id[e.experiment_id] += 1
    report.id_errors = [
        f"duplicate experiment_id {k!r} ({n} records)" for k, n in sorted(by_id.items()) if n > 1
    ]
    groups: dict[tuple[object, ...], list[ExperimentRecord]] = defaultdict(list)
    for e in experiments:
        if e.sample_id is not None and e.test_date is not None:
            groups[_conditions(e)].append(e)
    for members in groups.values():
        if len(members) > 1:
            report.possible_duplicates.append(sorted(m.experiment_id for m in members))
            for m in members:
                add_flag(m, POSSIBLE_DUPLICATE)
    report.possible_duplicates.sort()
    return report
