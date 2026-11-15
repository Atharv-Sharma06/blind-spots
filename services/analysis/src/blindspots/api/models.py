"""Request/response models for every endpoint in docs/API.md.

Records reuse ``blindspots.schemas`` (CONTRACTS section 3). The model-backed endpoints (surface, predict,
target/assess, candidates, model, brief) are defined here so one module is the single source for
``apps/web/lib/types.ts``; their routes live in other modules.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from blindspots.schemas import (
    AtmosphereProfile,
    ExperimentRecord,
    Investigation,
    Observation,
    Range,
    SourceRef,
)

__all__ = [
    "AtmosphereProfile",
    "Investigation",
    "Range",
    "SourceRef",
]

Verdict = Literal["supported", "extrapolation", "insufficient_evidence"]
ModelStatus = Literal["modeled", "insufficient_data"]
Plane = Literal["o2_flow", "o2_pressure"]


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LooseModel(BaseModel):
    """Validation artifacts carry extra diagnostics beyond docs/API.md; they pass through unchanged."""

    model_config = ConfigDict(extra="allow")


# --- shared ---------------------------------------------------------------------------------------


class Reason(ApiModel):
    code: str
    message: str
    value: float | None = None


class Point(ApiModel):
    oxygen_percent: float = Field(ge=0, le=100)
    airflow_cm_s: float = Field(ge=0)
    pressure_kpa: float = Field(gt=0)


# --- health / records ------------------------------------------------------------------------------


class Artifacts(ApiModel):
    dataset: bool
    models: bool
    validation: bool


class HealthResponse(ApiModel):
    status: Literal["ok", "degraded"]
    dataset_version: str | None
    model_version: str | None
    artifacts: Artifacts
    api_version: str = "1"


class ExperimentWithGroup(ExperimentRecord):
    group_id: str | None = None


class ObservationWithGroup(Observation):
    group_id: str | None = None


class ExperimentDetail(ApiModel):
    experiment: ExperimentWithGroup
    observations: list[ObservationWithGroup]


class LabelCounts(ApiModel):
    sustained: int
    not_sustained: int


class GroupSummary(ApiModel):
    group_id: str
    material_family: str
    flame_configuration: str
    label: str
    campaigns: list[str]
    n_experiments: int
    n_observations: int
    n_training: int
    label_counts: LabelCounts
    oxygen_percent_range: list[float] | None
    airflow_cm_s_range: list[float] | None
    pressure_kpa_range: list[float] | None
    pressure_measured: bool
    model_status: ModelStatus
    model_reason: str | None


# --- targets / context -----------------------------------------------------------------------------


class Ventilation(ApiModel):
    min_cm_s: float
    max_cm_s: float
    sources: list[SourceRef]


class TargetsResponse(ApiModel):
    profiles: list[AtmosphereProfile]
    ventilation: Ventilation | None


class QuoteRef(ApiModel):
    url: str | None = None
    quote: str | None = None


class NotIntegratedInvestigation(ApiModel):
    id: str
    name: str
    agency: str | None = None
    platform: str | None = None
    years: str | None = None
    oxygen_percent_range: list[float] | None = None
    pressure_kpa_range: list[float] | None = None
    flow_cm_s_range: list[float] | None = None
    data_availability: str | None = None
    reason_not_integrated: str | None = None
    sources: list[QuoteRef]


class GroundFlammabilityRecord(ApiModel):
    material: str
    total_pressure_kpa: float | None = None
    oxygen_percent: float | None = None
    result: str | None = None
    result_definition: str | None = None
    source_title: str | None = None
    source_url: str | None = None
    ntrs_id: str | None = None
    page: str | None = None
    table: str | None = None


class ContextResponse(ApiModel):
    not_integrated: list[NotIntegratedInvestigation]
    ground_flammability: list[GroundFlammabilityRecord]
    context_experiments: list[ExperimentWithGroup]


# --- coverage / surface ----------------------------------------------------------------------------


class SliceSpec(ApiModel):
    variable: str
    value: float
    unit: str


class AxisSpec(ApiModel):
    variable: str
    unit: str
    scale: Literal["linear", "log"]
    values: list[float]


Grid = list[list[float | None]]


class CoverageResponse(ApiModel):
    group_id: str
    plane: Plane
    slice: SliceSpec
    x: AxisSpec
    y: AxisSpec
    nn_distance: Grid
    comparable_count: list[list[int]]
    inside_hull: list[list[bool]]
    sparse_threshold: float
    scales: dict[str, float]
    observations_in_slice: list[str]
    n_evidence_observations: int


class SurfaceResponse(ApiModel):
    group_id: str
    plane: Plane
    slice: SliceSpec
    x: AxisSpec
    y: AxisSpec
    p_sustained: Grid | None
    latent_std_ratio: Grid | None
    epistemic: Grid | None
    aleatoric: Grid | None
    total: Grid | None
    verdict: list[list[Verdict]] | None
    nn_distance: Grid | None = None
    comparable_count: list[list[int]] | None = None
    inside_hull: list[list[bool]] | None = None
    model_id: str | None
    model_version: str | None
    model_status: ModelStatus


# --- predict ---------------------------------------------------------------------------------------


class PredictRequest(ApiModel):
    group_id: str
    points: list[Point] = Field(max_length=2000)


class Prediction(ApiModel):
    point: Point
    p_sustained: float | None
    latent_mean: float | None
    latent_std: float | None
    latent_std_ratio: float | None
    epistemic: float | None
    aleatoric: float | None
    total: float | None
    verdict: Verdict
    reasons: list[Reason]


class PredictResponse(ApiModel):
    group_id: str
    model_version: str | None
    predictions: list[Prediction]


# --- target -----------------------------------------------------------------------------------------


class CustomTarget(ApiModel):
    label: str
    oxygen_percent: Range
    total_pressure_kpa: Range
    airflow_cm_s: Range | None = None

    @model_validator(mode="after")
    def _nominals(self) -> CustomTarget:
        for name in ("oxygen_percent", "total_pressure_kpa"):
            if getattr(self, name).nominal is None:
                raise ValueError(f"custom target {name} needs a nominal value")
        return self


class Target(ApiModel):
    """Exactly one of ``profile_id`` or ``custom``."""

    profile_id: str | None = None
    custom: CustomTarget | None = None

    @model_validator(mode="after")
    def _exactly_one(self) -> Target:
        if (self.profile_id is None) == (self.custom is None):
            raise ValueError("target needs exactly one of profile_id or custom")
        return self


AirflowBandSource = Literal[
    "profile",
    "ventilation_standard",
    "ventilation_standard_with_near_quiescent_extension",
    "default_band",
    "custom",
]


class ResolvedTarget(ApiModel):
    label: str
    profile_id: str | None = None
    status: str
    kind: str = "operating_point"
    oxygen_percent: Range
    total_pressure_kpa: Range
    airflow_cm_s: Range
    airflow_band_source: AirflowBandSource
    airflow_band_note: str | None = None
    flags: list[str] = []
    sources: list[SourceRef]


class NearestObservation(ApiModel):
    observation_id: str
    experiment_id: str
    distance: float
    oxygen_percent: float
    airflow_cm_s: float
    pressure_kpa: float
    label: int | None


class TargetCoverage(ApiModel):
    n_target_points: int
    comparable_observations: int
    points_with_comparable: int
    nn_distance_min: float | None
    nn_distance_median: float | None
    fraction_inside_hull: float
    nearest_observations: list[NearestObservation]


class TargetModelSummary(ApiModel):
    model_status: ModelStatus
    p_sustained_mean: float | None = None
    p_sustained_min: float | None = None
    p_sustained_max: float | None = None
    latent_std_ratio_mean: float | None = None
    epistemic_mean: float | None = None
    aleatoric_mean: float | None = None


class DocumentedContext(ApiModel):
    id: str
    name: str
    overlap: Literal["contains_target_nominal", "overlaps_target_region"]
    data_availability: str | None = None
    reason_not_integrated: str | None = None


class AssessRequest(ApiModel):
    group_id: str
    target: Target


class AssessResponse(ApiModel):
    group_id: str
    target: ResolvedTarget
    coverage: TargetCoverage
    model: TargetModelSummary
    verdict: Verdict
    reasons: list[Reason]
    documented_context: list[DocumentedContext]
    summary: str


# --- candidates -------------------------------------------------------------------------------------


class Assumptions(ApiModel):
    pressure_length_scale: float = Field(default=0.3, ge=0.05, le=3.0)


class RankRequest(ApiModel):
    group_id: str
    target: Target
    k: int = Field(default=3, ge=1, le=10)
    assumptions: Assumptions = Assumptions()


class RelatedInvestigation(ApiModel):
    id: str
    name: str
    data_availability: str | None = None
    note: str


class Candidate(ApiModel):
    candidate_id: str
    rank: int | None = None
    oxygen_percent: float
    pressure_kpa: float
    airflow_cm_s: float
    evr: float
    evr_fraction: float
    marginal_evr_fraction: float | None = None
    mi_reduction_fraction: float | None = None
    p_sustained: float | None = None
    latent_std_ratio: float | None = None
    nn_distance: float | None = None
    feasibility_status: Literal["within_demonstrated_envelope", "outside_demonstrated_envelope"]
    feasibility_note: str
    reasons: list[Reason] = []
    explanation: str = ""
    related_documented_investigations: list[RelatedInvestigation] = []


class CandidateBaselines(ApiModel):
    random: Candidate | None = None
    uncertainty_sampling: Candidate | None = None
    nearest_gap: Candidate | None = None


class SensitivityEntry(ApiModel):
    pressure_length_scale: float
    top_candidate: Candidate | None
    same_top_as_default: bool


class RankResponse(ApiModel):
    group_id: str
    target: ResolvedTarget
    status: Literal["ok", "no_eligible_candidates", "model_unavailable"]
    candidates: list[Candidate]
    baselines: CandidateBaselines | None = None
    sensitivity: list[SensitivityEntry] = []
    assumptions: list[str] = []
    candidate_domain: dict[str, list[float]] = {}
    disclaimer: str


class CompareRequest(ApiModel):
    group_id: str
    target: Target
    a: Point
    b: Point


class CompareResponse(ApiModel):
    a: Candidate
    b: Candidate
    both_evr_fraction: float
    preferred: Literal["a", "b", "indistinguishable"]
    reasons: list[Reason]
    assumptions: list[str]


class CounterfactualRequest(ApiModel):
    group_id: str
    target: Target
    candidate: Point
    plane: Plane | None = None
    slice: float | None = None


class ScenarioSurface(ApiModel):
    p_sustained: Grid
    latent_std_ratio: Grid


class CounterfactualCurrent(ApiModel):
    target_p_mean: float
    target_latent_var: float
    target_epistemic: float


class Scenario(ApiModel):
    outcome: Literal["sustained", "not_sustained"]
    label: str
    probability: float
    target_p_mean: float
    target_latent_var: float
    target_epistemic: float
    variance_reduction_fraction: float
    surface: ScenarioSurface | None = None


class CounterfactualResponse(ApiModel):
    p_sustained_at_candidate: float
    current: CounterfactualCurrent
    scenarios: list[Scenario]
    expected_variance_reduction_fraction: float
    note: str


# --- model card / validation -----------------------------------------------------------------------


class ModelTraining(ApiModel):
    n_observations: int
    n_experiments: int
    label_counts: LabelCounts
    confidence_included: list[str]
    filters: list[str] | dict[str, Any] | str


class ModelMetadata(ApiModel):
    model_id: str
    model_version: str
    group_id: str
    algorithm: str
    features: list[str]
    hyperparameters: dict[str, Any]
    fixed_hyperparameters: dict[str, Any] | list[str]
    priors: dict[str, Any]
    training: ModelTraining
    seed: int | None
    trained_at: str | None
    dataset_version: str | None
    limitations: list[str]


class Metric(LooseModel):
    value: float | None
    ci95: list[float | None] | None = None


class CvModel(LooseModel):
    name: str
    brier: Metric
    log_loss: Metric
    auc: Metric
    ece: Metric


class CvReport(LooseModel):
    scheme: str
    models: list[CvModel]


class LogoFold(LooseModel):
    held_out: str
    n: int
    brier: float | None
    log_loss: float | None
    auc: float | None


class LogoReport(LooseModel):
    applicable: bool
    folds: list[LogoFold]


class ReliabilityBin(LooseModel):
    lo: float
    hi: float
    count: int
    mean_predicted: float | None
    observed_frequency: float | None


class Reliability(LooseModel):
    model: str
    bins: list[ReliabilityBin]


class ErrorDistribution(LooseModel):
    bins: list[float]
    counts: list[int]


class Subgroup(LooseModel):
    name: str
    n: int
    brier: float | None
    log_loss: float | None


class SensitivityVariant(LooseModel):
    variant: str
    n_training: int
    brier: float | None
    log_loss: float | None
    auc: float | None
    delta_vs_primary: float | None


class BlindspotPointLevel(LooseModel):
    n: int
    spearman_rho: float | None
    p_value: float | None
    auroc_error_detection: float | None


class BlindspotPair(LooseModel):
    experiment_id: str
    pre_reveal_uncertainty: float
    error: float


class BlindspotGroupLevel(LooseModel):
    n_groups: int
    spearman_rho: float | None
    p_value: float | None
    pairs: list[BlindspotPair]


class BlindspotTest(LooseModel):
    point_level: BlindspotPointLevel
    group_level: BlindspotGroupLevel
    verdict: Literal["supported", "not_supported", "inconclusive"]
    interpretation: str


class GroupValidation(LooseModel):
    group_id: str
    n_experiments: int
    n_observations: int
    cv: CvReport
    logo: LogoReport
    reliability: Reliability
    error_distribution: ErrorDistribution
    subgroups: list[Subgroup]
    sensitivity: list[SensitivityVariant]
    blindspot_test: BlindspotTest


class CurvePoint(LooseModel):
    n_acquired: int
    mean: float
    ci95: list[float]


class RetroScenario(LooseModel):
    name: str
    group_id: str
    target_definition: str
    n_seeds: int
    n_rounds: int
    metric: str
    curves: dict[str, list[CurvePoint]]
    area_under_curve: dict[str, float]
    interpretation: str


class AcquisitionRetrospective(LooseModel):
    scenarios: list[RetroScenario]


class ValidationReport(LooseModel):
    generated_at: str
    dataset_version: str | None
    model_version: str | None
    groups: list[GroupValidation]
    acquisition_retrospective: AcquisitionRetrospective


# --- methodology / sources -------------------------------------------------------------------------


class MethodVersions(ApiModel):
    dataset_version: str | None
    model_version: str | None
    pipeline_version: str
    api_version: str


class MethodConfig(ApiModel):
    training_filter: dict[str, Any]
    coverage_scales: dict[str, float]
    support_thresholds: dict[str, Any]
    candidate_domain: dict[str, list[float]]
    seeds: dict[str, Any] | None
    pressure_length_scale_default: float
    pressure_length_scale_sensitivity: list[float]
    pressure_length_scale_fixed: bool


class MethodDates(ApiModel):
    data_retrieved: str | None
    last_analysis: str | None


class MethodologyResponse(ApiModel):
    versions: MethodVersions
    config: MethodConfig
    dates: MethodDates
    limitations: list[str]
    repository_url: str | None


class Publication(ApiModel):
    title: str
    doi: str | None
    url: str | None
    investigation_id: str | None


class RawFileRef(ApiModel):
    path: str
    psi_file_name: str | None
    sha256: str | None
    investigation_id: str | None


class GroundDataSource(ApiModel):
    title: str
    url: str | None
    ntrs_id: str | None
    n_records: int


class SourcesResponse(ApiModel):
    investigations: list[Investigation]
    publications: list[Publication]
    atmosphere_sources: list[SourceRef]
    other_investigations: list[NotIntegratedInvestigation]
    ground_data_sources: list[GroundDataSource]
    raw_files: list[RawFileRef]


# --- brief -----------------------------------------------------------------------------------------


class BriefRequest(ApiModel):
    group_id: str
    target: Target
    candidate: Point | None = None


class BriefSections(ApiModel):
    target: str
    coverage: str
    model: str
    candidate: str
    historical_investigations: str
    citations: str
    limitations: str


class BriefResponse(ApiModel):
    title: str
    generated_at: str
    dataset_version: str | None
    model_version: str | None
    markdown: str
    sections: BriefSections
