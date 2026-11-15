"""Curation CSV loading, the CONTRACTS 2.3 label rule, oxygen per step and the training filter."""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path
from typing import Final

TESTS_HEADER: Final = [
    "investigation_id",
    "test_label",
    "source_file",
    "source_sheet",
    "source_row",
    "material_family",
    "specimen_geometry",
    "thickness_mm",
    "diameter_mm",
    "width_mm",
    "sides_burning",
    "pmma_color",
    "flame_configuration",
    "configuration_evidence",
    "terminal_event",
    "o2_anomaly",
    "confidence",
    "note",
]
STEPS_HEADER: Final = [
    "investigation_id",
    "test_label",
    "source_file",
    "source_sheet",
    "source_row",
    "step_index",
    "flow_value",
    "flow_unit",
    "flow_qualifier",
    "flame_state",
    "extinction_mode",
    "raw_token",
    "raw_column",
    "token_row",
    "confidence",
    "note",
]

#: optional trailing step columns (TM Appendix A evidence); a chunk may omit all of them
STEPS_OPTIONAL: Final = ["evidence_source", "evidence_page", "evidence_quote"]

LABEL_ZERO_MODES = {"quench_low_flow", "blowoff_high_flow", "at_constant_flow"}
TRAINING_CONFIDENCE = {"high", "medium"}
CONFIDENCE_ORDER = {"low": 0, "medium": 1, "high": 2}


@dataclass
class CurationTest:
    row: dict[str, str]
    chunk: str

    @property
    def key(self) -> tuple[str, str]:
        return self.row["investigation_id"], self.row["test_label"]


@dataclass
class CurationStep:
    row: dict[str, str]
    chunk: str

    @property
    def test_key(self) -> tuple[str, str]:
        return self.row["investigation_id"], self.row["test_label"]


@dataclass
class CurationData:
    tests: dict[tuple[str, str], CurationTest] = field(default_factory=dict)
    steps: dict[tuple[str, str], list[CurationStep]] = field(default_factory=dict)
    test_chunks: list[str] = field(default_factory=list)
    step_chunks: list[str] = field(default_factory=list)
    problems: list[str] = field(default_factory=list)


def _read_csv(
    path: Path, expected: list[str], problems: list[str], optional: list[str] | None = None
) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        got = list(reader.fieldnames or [])
        extras = [c for c in (optional or []) if c in got]
        if got != expected and got != expected + extras:
            problems.append(f"{path.name}: header differs from the contract (got {got})")
            missing = [c for c in expected if c not in got]
            if missing:
                problems.append(f"{path.name}: missing columns {missing}; file skipped")
                return []
        return [{k: (v or "") for k, v in row.items() if k is not None} for row in reader]


def load_curation(curation_dir: Path) -> CurationData:
    """Load every ``tests/*.csv`` and ``steps/*.csv`` chunk that exists (sorted by file name)."""
    data = CurationData()
    for path in sorted((curation_dir / "tests").glob("*.csv")):
        data.test_chunks.append(path.stem)
        for row in _read_csv(path, TESTS_HEADER, data.problems):
            t = CurationTest(row, path.stem)
            if t.key in data.tests:
                data.problems.append(f"{path.name}: duplicate test row {t.key} (first one kept)")
                continue
            data.tests[t.key] = t
    seen: set[tuple[str, str, str]] = set()
    for path in sorted((curation_dir / "steps").glob("*.csv")):
        data.step_chunks.append(path.stem)
        for row in _read_csv(path, STEPS_HEADER, data.problems, STEPS_OPTIONAL):
            s = CurationStep(row, path.stem)
            ident = (*s.test_key, row["step_index"])
            if ident in seen:
                data.problems.append(f"{path.name}: duplicate step {ident} (later one dropped)")
                continue
            seen.add(ident)
            data.steps.setdefault(s.test_key, []).append(s)
    for steps in data.steps.values():
        steps.sort(key=lambda s: int(s.row["step_index"] or 0))
    return data


def label_step(flame_state: str, extinction_mode: str) -> tuple[int | None, list[str], str | None]:
    """CONTRACTS 2.3. Returns (label, flags, exclusion_reason)."""
    if flame_state == "sustained":
        return 1, [], None
    if flame_state == "extinguished":
        if extinction_mode in LABEL_ZERO_MODES:
            return 0, [], None
        if extinction_mode == "flow_turned_off":
            return 0, ["flow_off_transient"], None
        if extinction_mode == "n2_suppression":
            return None, [], "n2_suppression"
        return None, [], "extinction_mode_missing"
    if flame_state == "brief_flame_no_sustain":
        return 0, ["no_sustained_propagation"], None
    if flame_state == "not_ignited":
        return None, [], "not_ignited"
    return None, [], "unknown_flame_state"


def oxygen_for_step(
    initial: float | None, final: float | None, step_index: int, n_steps: int, o2_anomaly: bool
) -> tuple[float | None, list[str]]:
    """Oxygen for one step: linear initial -> final across the test's steps when both are valid.

    Falls back to the initial value (flag ``o2_initial_only``) when final is missing, the curation
    marks the O2 cells as an anomaly, or the test has a single step.
    """
    if initial is None:
        return None, ["o2_missing"]
    if final is not None and not o2_anomaly and n_steps >= 2:
        frac = step_index / (n_steps - 1)
        return initial + (final - initial) * frac, ["o2_interpolated"]
    return initial, ["o2_initial_only"]


def lowest_confidence(*values: str) -> str:
    return min(values, key=lambda v: CONFIDENCE_ORDER.get(v, 0))


def training_exclusion(
    *,
    label: int | None,
    label_reason: str | None,
    airflow: float | None,
    provenance_ok: bool,
    confidence: str,
    material_family: str | None,
    oxygen: float | None,
) -> str | None:
    """Default training filter; returns the first exclusion reason or None when the row is included.

    A row is included when: label is not null, airflow is numeric, provenance is ok, confidence is high
    or medium, a material family is assigned, and an oxygen value exists.
    """
    if label is None:
        return label_reason or "no_label"
    if not provenance_ok:
        return "provenance_mismatch"
    if airflow is None:
        return "no_numeric_airflow"
    if material_family is None:
        return "no_material_family"
    if oxygen is None:
        return "no_oxygen"
    if confidence not in TRAINING_CONFIDENCE:
        return "low_confidence"
    return None
