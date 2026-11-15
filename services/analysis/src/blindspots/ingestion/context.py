"""Context records from ``data/curation/context_microgravity/*.csv`` (never used for training).

One ExperimentRecord per printed test/sample row of a published table from another apparatus or test
duration (SAFFIRE-IV/V/VI, DARTFire, drop-tower limits). Values are copied as printed; nothing is
assumed. ``observed_outcome`` is set only from explicit outcome words; otherwise ``unknown``.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path

from blindspots.schemas import ExperimentRecord, Investigation

CONTEXT_COLUMNS = [
    "context_id", "investigation_short", "investigation_name", "platform", "gravity_environment",
    "years", "material", "specimen_geometry", "sample_dimensions", "flame_configuration",
    "oxygen_percent", "total_pressure_kpa", "total_pressure_raw", "airflow_cm_s", "airflow_raw",
    "outcome_text", "source_title", "source_url", "ntrs_id", "page", "table", "raw_text",
]  # fmt: skip
EXCLUSION = "context only: different apparatus or test duration"
LICENSE = "NASA Technical Reports Server document; see source"
CONFIGURATIONS = {"opposed", "concurrent", "stagnation", "wake", "mixed", "unknown"}
#: explicit outcome words only (whole outcome_text, case-insensitive); anything else -> "unknown"
OUTCOME_WORDS = {
    "burns": "burns",
    "extinguishes": "extinguished",
    "extinguished": "extinguished",
    "no ignition": "ignition_failed",
}


def investigation_id_for(ntrs_id: str) -> str:
    return f"NTRS-{ntrs_id}"


def _f(text: str) -> float | None:
    try:
        return float(text) if text.strip() != "" else None
    except ValueError:
        return None


def material_family_for(material: str, geometry: str) -> str:
    m = material.lower()
    if "sibal" in m:
        return "sibal_fabric"
    if "nomex" in m:
        return "nomex_fabric"
    if "ultem" in m:
        return "ultem_sheet"
    if "pmma" in m and (geometry == "slab" or geometry.startswith("flat")):
        return "pmma_slab"
    return "other"


def geometry_for(geometry: str) -> str | None:
    g = geometry.lower()
    if g == "slab" or g.startswith("flat"):
        return "slab"
    if g.startswith("fabric"):
        return "fabric_strip"
    if g == "film":
        return "flat_sheet"
    return None


def outcome_for(outcome_text: str) -> str:
    return OUTCOME_WORDS.get(" ".join(outcome_text.lower().split()), "unknown")


@dataclass
class _Doc:
    first: dict[str, str]
    shorts: list[str] = field(default_factory=list)


def load_context(
    context_dir: Path,
) -> tuple[list[ExperimentRecord], list[Investigation], list[str]]:
    """Records, one Investigation per NTRS document, and problems (never raises on bad rows)."""
    records: list[ExperimentRecord] = []
    problems: list[str] = []
    docs: dict[str, _Doc] = {}
    seen: set[str] = set()
    for path in sorted(context_dir.glob("*.csv")) if context_dir.is_dir() else []:
        with path.open(newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            if list(reader.fieldnames or []) != CONTEXT_COLUMNS:
                problems.append(f"{path.name}: header differs from the context format; file skipped")
                continue
            for row in reader:
                cid = row["context_id"]
                if cid in seen or ":" not in cid:
                    problems.append(f"{path.name}: duplicate or malformed context_id {cid!r}; row skipped")
                    continue
                seen.add(cid)
                short = row["investigation_short"]
                label = cid.split(":", 1)[1]
                inv_id = investigation_id_for(row["ntrs_id"])
                d = docs.setdefault(inv_id, _Doc(first=row))
                if short not in d.shorts:
                    d.shorts.append(short)
                geometry = row["specimen_geometry"]
                config = (
                    row["flame_configuration"] if row["flame_configuration"] in CONFIGURATIONS else "unknown"
                )
                flags = ["context_record"]
                p = _f(row["total_pressure_kpa"])
                if p is None:
                    flags.append("pressure_missing")
                o2 = _f(row["oxygen_percent"])
                if o2 is None:
                    flags.append("o2_missing")
                notes = " | ".join(t for t in (row["outcome_text"], row["raw_text"]) if t)
                records.append(
                    ExperimentRecord(
                        experiment_id=f"{short}:{label}",
                        investigation_id=inv_id,
                        investigation_name=row["investigation_name"],
                        investigation_acronym=short,
                        campaign_group=short,
                        test_label=label,
                        sample_id=None,
                        test_date=None,
                        oxygen_percent=o2,
                        oxygen_percent_initial=o2,
                        total_pressure_kpa=p,
                        airflow_cm_s=_f(row["airflow_cm_s"]),
                        material_type=row["material"] or None,
                        material_family=material_family_for(row["material"], geometry),
                        specimen_geometry=geometry_for(geometry),
                        flame_configuration=config,
                        gravity_environment=row["gravity_environment"],
                        experimental_platform=row["platform"] or None,
                        observed_outcome=outcome_for(row["outcome_text"]),
                        outcome_definition="Outcome words as printed in the cited table or paragraph.",
                        measurement_method=(
                            f"Values transcribed from {row['table']} ({row['source_title']}), "
                            f"page {row['page']}."
                        ),
                        notes_raw=notes or None,
                        source_url=row["source_url"],
                        source_doi=None,
                        extraction_method="manually_transcribed",
                        extraction_confidence="medium",
                        quality_flags=flags,
                        included_in_training=False,
                        exclusion_reason=EXCLUSION,
                        n_observations=0,
                    )
                )
    invs: list[Investigation] = []
    for inv_id, d in sorted(docs.items()):
        row = d.first
        invs.append(
            Investigation(
                investigation_id=inv_id,
                acronym=", ".join(d.shorts),
                title=row["source_title"],
                doi=None,
                landing_url=row["source_url"],
                license=LICENSE,
                platform=row["platform"],
                gravity_environment=row["gravity_environment"],
                role="integrated_context",
                role_reason=(
                    "Published test table from another apparatus or duration: "
                    "context only, never training data."
                ),
                n_experiments=0,
                n_observations=0,
            )
        )
    return records, invs, problems
