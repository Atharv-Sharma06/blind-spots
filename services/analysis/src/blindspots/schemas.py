"""Normalized Pydantic v2 schemas (CONTRACTS section 3) and enums (section 2)."""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator

MaterialFamily = Literal[
    "pmma_thin_film",
    "pmma_slab",
    "pmma_rod",
    "pmma_sphere",
    "sibal_fabric",
    "nomex_fabric",
    "ultem_sheet",
    "wax_candle",
    "paraffin_slab",
    "other",
]
SpecimenGeometry = Literal[
    "flat_sheet", "slab", "rod", "sphere", "spherical_section", "fabric_strip", "candle"
]
FlameConfiguration = Literal["opposed", "concurrent", "stagnation", "wake", "mixed", "unknown"]
TerminalEvent = Literal[
    "burnout",
    "extinguished_low_flow",
    "blowoff",
    "self_extinguished",
    "flow_turned_off",
    "n2_suppressed",
    "ignition_failed",
    "brief_flame_only",
    "test_aborted",
    "unknown",
]
FlameState = Literal["sustained", "extinguished", "brief_flame_no_sustain", "not_ignited"]
ExtinctionMode = Literal[
    "quench_low_flow", "blowoff_high_flow", "at_constant_flow", "flow_turned_off", "n2_suppression"
]
FlowUnit = Literal["air_cm_s", "fan_display", "pot", "none"]
FlowQualifier = Literal["<", "~", "max"]
Confidence = Literal["high", "medium", "low"]
ExtractionMethod = Literal[
    "structured_nasa_data", "extracted_from_documentation", "manually_transcribed", "derived_computation"
]
InvestigationRole = Literal["integrated_model", "integrated_context", "catalogued_not_integrated"]
AirflowBasis = Literal["air_display", "fan_calibration", "pot_calibration", "stated_cm_s", "none"]
ProfileStatus = Literal[
    "documented_nasa", "historical_nasa", "nasa_design_recommendation", "user_hypothetical"
]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Range(_Strict):
    """A documented value: nominal and/or bounds. Some NASA sources state only a bound (e.g. O2 <= 30 %)."""

    nominal: float | None = None
    min: float | None = None
    max: float | None = None

    @model_validator(mode="after")
    def _needs_a_value(self) -> Range:
        if self.nominal is None and self.min is None and self.max is None:
            raise ValueError("a range needs a nominal value or at least one bound")
        return self


class SourceRef(_Strict):
    ref_id: str
    title: str
    url: str | None = None
    doc_number: str | None = None
    page: str | None = None
    quote: str | None = None


class Investigation(_Strict):
    investigation_id: str
    acronym: str
    title: str
    doi: str | None = None
    landing_url: str
    license: str
    platform: str
    gravity_environment: str
    role: InvestigationRole
    role_reason: str
    n_experiments: int
    n_observations: int


class ExperimentRecord(_Strict):
    """One physical test."""

    experiment_id: str
    investigation_id: str
    investigation_name: str
    investigation_acronym: str
    campaign_group: str
    test_label: str
    sample_id: str | None = None
    test_date: date | None = None
    oxygen_percent: float | None = None
    oxygen_percent_initial: float | None = None
    oxygen_percent_final: float | None = None
    total_pressure_kpa: float | None = None
    total_pressure_atm_raw: float | None = None
    pressure_assumed_kpa: float | None = None
    pressure_assumption_source: str | None = None
    airflow_cm_s: float | None = None
    airflow_min_cm_s: float | None = None
    airflow_max_cm_s: float | None = None
    material_type: str | None = None
    material_family: str | None = None
    specimen_geometry: str | None = None
    material_thickness_mm: float | None = None
    specimen_diameter_mm: float | None = None
    specimen_width_mm: float | None = None
    flame_configuration: str
    gravity_environment: str
    experimental_platform: str | None = None
    flow_restrictor: int | None = None
    observed_outcome: str | None = None
    outcome_definition: str | None = None
    measurement_method: str | None = None
    co2_percent_initial: float | None = None
    co2_percent_final: float | None = None
    co_ppm_initial: float | None = None
    co_ppm_final: float | None = None
    notes_raw: str | None = None
    source_url: str
    source_doi: str | None = None
    source_file: str | None = None
    source_sheet: str | None = None
    source_row: int | None = None
    extraction_method: ExtractionMethod
    extraction_confidence: Confidence
    quality_flags: list[str]
    included_in_training: bool
    exclusion_reason: str | None = None
    n_observations: int


class Observation(_Strict):
    """One flow step (model row)."""

    observation_id: str
    experiment_id: str
    investigation_id: str
    campaign_group: str
    material_family: str | None = None
    flame_configuration: str
    step_index: int
    oxygen_percent: float | None = None
    airflow_cm_s: float | None = None
    airflow_uncertainty_cm_s: float | None = None
    airflow_basis: AirflowBasis
    flow_raw_value: str | None = None
    flow_raw_unit: str
    flow_calibration_ref: str | None = None
    total_pressure_kpa: float | None = None
    pressure_for_analysis_kpa: float | None = None
    flame_state: str
    extinction_mode: str | None = None
    label: int | None = None
    raw_token: str
    raw_column: str
    source_row: int
    confidence: Confidence
    quality_flags: list[str]
    included_in_training: bool
    exclusion_reason: str | None = None


class AtmosphereProfile(_Strict):
    profile_id: str
    name: str
    context: str
    status: ProfileStatus
    oxygen_percent: Range
    total_pressure_kpa: Range
    total_pressure_psia: Range | None = None
    o2_partial_pressure_kpa: Range | None = None
    airflow_cm_s: Range | None = None
    # "operating_point" profiles can be analysis targets; "envelope" profiles (e.g. a standard's allowed
    # range) are shown as context only.
    kind: Literal["operating_point", "envelope"] = "operating_point"
    sources: list[SourceRef]
    notes: str | None = None
