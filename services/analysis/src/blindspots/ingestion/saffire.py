"""SAFFIRE context records from ``data/curation/saffire_tests.csv`` (never used for training)."""

from __future__ import annotations

import csv
import datetime as dt
import re
from pathlib import Path

from blindspots.schemas import ExperimentRecord, Investigation

SAFFIRE_FILE = "saffire_tests.csv"
EXCLUSION = "different apparatus and scale: context only"
_DATE_RE = re.compile(r"Date (\d{4}-\d{2}-\d{2})")
_FILE_RE = re.compile(r"file: (data/raw/\S+?\.xlsx)")


def _f(text: str | None) -> float | None:
    try:
        return float(text) if text not in (None, "") else None
    except ValueError:
        return None


def load_saffire(path: Path, investigations: dict[str, Investigation]) -> list[ExperimentRecord]:
    """Experiment records for PSI-98/PSI-100 (and any other investigation named in the CSV)."""
    if not path.is_file():
        return []
    out: list[ExperimentRecord] = []
    with path.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            acc = row["investigation_id"]
            inv = investigations.get(acc)
            if inv is None:
                continue
            flags = ["context_only"]
            notes = row.get("notes") or ""
            m = _DATE_RE.search(notes)
            date = dt.date.fromisoformat(m.group(1)) if m else None
            if date:
                flags.append("test_date_from_notes")
            fm = _FILE_RE.search(row.get("value_method") or "")
            o2 = _f(row.get("oxygen_percent"))
            p = _f(row.get("total_pressure_kpa"))
            if o2 is None:
                flags.append("o2_missing")
            if p is None:
                flags.append("pressure_missing")
            out.append(
                ExperimentRecord(
                    experiment_id=f"{acc}:{row['test_label']}",
                    investigation_id=acc,
                    investigation_name=inv.title,
                    investigation_acronym=inv.acronym,
                    campaign_group=f"SAFFIRE/{inv.acronym}",
                    test_label=row["test_label"],
                    sample_id=row.get("sample") or None,
                    test_date=date,
                    oxygen_percent=o2,
                    oxygen_percent_initial=o2,
                    total_pressure_kpa=p,
                    airflow_cm_s=_f(row.get("airflow_cm_s")),
                    material_family=row.get("material_family") or None,
                    specimen_geometry=row.get("specimen_geometry") or None,
                    specimen_width_mm=_f(row.get("sample_width_mm")),
                    flame_configuration=row.get("flame_configuration") or "unknown",
                    gravity_environment=inv.gravity_environment,
                    experimental_platform=inv.platform,
                    observed_outcome=row.get("outcome") or None,
                    outcome_definition=row.get("outcome_source") or None,
                    measurement_method=row.get("value_method") or None,
                    notes_raw=notes or None,
                    source_url=inv.landing_url,
                    source_doi=inv.doi,
                    source_file=fm.group(1) if fm else None,
                    extraction_method="derived_computation",
                    extraction_confidence="medium",
                    quality_flags=flags,
                    included_in_training=False,
                    exclusion_reason=EXCLUSION,
                    n_observations=0,
                )
            )
    return out
