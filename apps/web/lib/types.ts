/**
 * Types mirroring docs/CONTRACTS.md section 3 (normalized schemas) and docs/API.md (exact HTTP shapes).
 *
 * docs/API.md is the source of truth for requests/responses; services/analysis/src/blindspots/api/models.py
 * did not exist when this file was written, so any field the lead's docs leave open is marked
 * `optional` (`?`) rather than guessed. Re-reconcile once models.py lands.
 *
 * Conventions: Python `None` -> `null` (never `undefined`, never 0). Dates are ISO 8601 strings.
 * Units are in field names (`_percent`, `_kpa`, `_cm_s`).
 */

// ---- CONTRACTS section 3: enums ---------------------------------------------------------

export type ExtractionMethod =
  | "structured_nasa_data"
  | "extracted_from_documentation"
  | "manually_transcribed"
  | "derived_computation";

export type Confidence = "high" | "medium" | "low";

export type InvestigationRole = "integrated_model" | "integrated_context" | "catalogued_not_integrated";

export type AtmosphereStatus =
  | "documented_nasa"
  | "historical_nasa"
  | "nasa_design_recommendation"
  | "user_hypothetical";

export type AirflowBasis = "air_display" | "fan_calibration" | "pot_calibration" | "stated_cm_s" | "none";

/** Curation vocabularies (CONTRACTS section 2.1). */
export type MaterialFamily =
  | "pmma_thin_film"
  | "pmma_slab"
  | "pmma_rod"
  | "pmma_sphere"
  | "sibal_fabric"
  | "nomex_fabric"
  | "ultem_sheet"
  | "wax_candle"
  | "paraffin_slab"
  | "other";

export type FlameConfiguration = "opposed" | "concurrent" | "stagnation" | "wake" | "mixed" | "unknown";

export type FlameState = "sustained" | "extinguished" | "brief_flame_no_sustain" | "not_ignited";

// ---- CONTRACTS section 3: records -------------------------------------------------------

export interface Investigation {
  investigation_id: string;
  acronym: string;
  title: string;
  doi: string | null;
  landing_url: string;
  license: string;
  platform: string;
  gravity_environment: string;
  role: InvestigationRole;
  role_reason: string;
  n_experiments: number;
  n_observations: number;
}

/** One physical test. API responses add `group_id`. */
export interface ExperimentRecord {
  experiment_id: string;
  investigation_id: string;
  investigation_name: string;
  investigation_acronym: string;
  campaign_group: string;
  test_label: string;
  sample_id: string | null;
  test_date: string | null;
  oxygen_percent: number | null;
  oxygen_percent_initial: number | null;
  oxygen_percent_final: number | null;
  total_pressure_kpa: number | null;
  total_pressure_atm_raw: number | null;
  pressure_assumed_kpa: number | null;
  pressure_assumption_source: string | null;
  airflow_cm_s: number | null;
  airflow_min_cm_s: number | null;
  airflow_max_cm_s: number | null;
  material_type: string | null;
  material_family: MaterialFamily | string | null;
  specimen_geometry: string | null;
  material_thickness_mm: number | null;
  specimen_diameter_mm: number | null;
  specimen_width_mm: number | null;
  flame_configuration: FlameConfiguration | string;
  gravity_environment: string;
  experimental_platform: string | null;
  flow_restrictor: number | null;
  observed_outcome: string | null;
  outcome_definition: string | null;
  measurement_method: string | null;
  co2_percent_initial: number | null;
  co2_percent_final: number | null;
  co_ppm_initial: number | null;
  co_ppm_final: number | null;
  notes_raw: string | null;
  source_url: string;
  source_doi: string | null;
  source_file: string | null;
  source_sheet: string | null;
  source_row: number | null;
  extraction_method: ExtractionMethod;
  extraction_confidence: Confidence;
  quality_flags: string[];
  included_in_training: boolean;
  exclusion_reason: string | null;
  n_observations: number;
}

/** ExperimentRecord as returned by /api/experiments (docs/API.md adds `group_id`). */
export interface ApiExperiment extends ExperimentRecord {
  group_id: string | null;
}

/** One flow step (model row). */
export interface Observation {
  observation_id: string;
  experiment_id: string;
  investigation_id: string;
  campaign_group: string;
  material_family: MaterialFamily | string | null;
  flame_configuration: FlameConfiguration | string;
  step_index: number;
  oxygen_percent: number | null;
  airflow_cm_s: number | null;
  airflow_uncertainty_cm_s: number | null;
  airflow_basis: AirflowBasis;
  flow_raw_value: string | null;
  flow_raw_unit: string;
  flow_calibration_ref: string | null;
  total_pressure_kpa: number | null;
  pressure_for_analysis_kpa: number | null;
  flame_state: FlameState | string;
  extinction_mode: string | null;
  /** 1 sustained, 0 not sustained, null excluded. */
  label: 0 | 1 | null;
  raw_token: string;
  raw_column: string;
  source_row: number;
  confidence: Confidence;
  quality_flags: string[];
  included_in_training: boolean;
  exclusion_reason: string | null;
}

/** Observation as returned by /api/observations and /api/experiments/{id} (adds `group_id`). */
export interface ApiObservation extends Observation {
  group_id: string | null;
}

/** `nominal` may be null (e.g. ISS O2 documents only an upper bound); never invent one. */
export interface Range {
  nominal: number | null;
  min: number | null;
  max: number | null;
}

export interface SourceRef {
  ref_id: string;
  title: string;
  url: string | null;
  doc_number: string | null;
  page: string | null;
  quote: string | null;
}

export interface AtmosphereProfile {
  profile_id: string;
  name: string;
  context: string;
  status: AtmosphereStatus;
  /** 'envelope' (NASA-STD-3001 crew envelope) is context only, not an analysis target. */
  kind?: "envelope" | string | null;
  oxygen_percent: Range;
  total_pressure_kpa: Range;
  total_pressure_psia?: Range | null;
  o2_partial_pressure_kpa?: Range | null;
  airflow_cm_s: Range | null;
  sources: SourceRef[];
  notes: string | null;
}

// ---- Verdicts and reasons (CONTRACTS section 4, docs/API.md Concepts) -------------------

/** Scientific limits are 200 responses with a verdict, never errors. */
export type Verdict = "supported" | "extrapolation" | "insufficient_evidence";

export type ReasonCode =
  | "sparse_observations"
  | "outside_hull"
  | "unobserved_pressure"
  | "outcome_variability"
  | "model_instability"
  | "other_family_evidence_only"
  | "no_model";

export type CandidateReasonCode =
  | "high_target_covariance"
  | "high_candidate_uncertainty"
  | "near_decision_boundary"
  | "fills_coverage_gap"
  | "assumption_dependent";

export interface Reason<C extends string = ReasonCode> {
  code: C;
  message: string;
  value: number | null;
}

// ---- Errors -----------------------------------------------------------------------------

/**
 * Server codes (docs/API.md) plus `backend_unavailable`, which the client also produces for network
 * failures and proxy 5xx without an envelope. Kept in step with ERROR_COPY in components/ui/error-state.tsx.
 *
 * A missing snapshot entry ("requires the live analysis service") is reported as
 * `backend_unavailable` with `ApiError.snapshotUnavailable === true` (see isSnapshotUnavailable in
 * lib/api.ts) until error-state.tsx gains a dedicated `snapshot_unavailable` entry.
 */
export type ApiErrorCode =
  | "validation_error" // 422
  | "not_found" // 404
  | "artifact_missing" // 503
  | "ingestion_failure" // 500
  | "backend_unavailable" // client-side / proxy
  | "internal"; // 500

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown> | null;
  };
}

// ---- Data modes / response metadata -----------------------------------------------------

export type DataMode = "live" | "snapshot" | "auto";
export type DataSource = "live" | "snapshot";

export interface ResponseMeta {
  source: DataSource;
  /** Snapshot only: manifest.generated_at. */
  generated_at?: string;
  /** Snapshot only: manifest.model_version. */
  model_version?: string | null;
}

/** Every api.* function resolves to this: the payload plus where it came from. */
export interface ApiResponse<T> {
  data: T;
  meta: ResponseMeta;
}

export interface SnapshotManifest {
  generated_at: string;
  dataset_version: string | null;
  model_version: string | null;
  slices: { o2_flow: number[]; o2_pressure: number[] };
  /** "<KEY>" -> relative file under /snapshot/. */
  entries: Record<string, string>;
}

// ---- GET /api/health --------------------------------------------------------------------

export interface HealthResponse {
  status: "ok" | "degraded";
  dataset_version: string | null;
  model_version: string | null;
  /** The backend may omit `validation` until the artifact exists. */
  artifacts: { dataset: boolean; models: boolean; validation?: boolean };
  api_version?: string;
}

// ---- GET /api/groups --------------------------------------------------------------------

export type ModelStatus = "modeled" | "insufficient_data";

export interface GroupSummary {
  group_id: string;
  material_family: string;
  flame_configuration: string;
  label: string;
  campaigns: string[];
  n_experiments: number;
  n_observations: number;
  n_training: number;
  label_counts: { sustained: number; not_sustained: number };
  oxygen_percent_range: [number, number] | null;
  airflow_cm_s_range: [number, number] | null;
  pressure_kpa_range: [number, number] | null;
  pressure_measured: boolean;
  model_status: ModelStatus;
  model_reason: string | null;
  /** Data-driven UI default from the API (services/analysis/src/blindspots/api/deps.py default_group_id). */
  is_default?: boolean;
}

// ---- Experiments / observations ---------------------------------------------------------

export interface ExperimentsQuery {
  investigation?: string;
  group?: string;
  q?: string;
  included?: boolean;
}

/** GET /api/experiments/{id}. */
export interface ExperimentDetail {
  experiment: ApiExperiment;
  observations: ApiObservation[];
}

// ---- Targets ----------------------------------------------------------------------------

export interface VentilationBand {
  min_cm_s: number;
  max_cm_s: number;
  sources: SourceRef[];
}

/** GET /api/targets. */
export interface TargetsResponse {
  profiles: AtmosphereProfile[];
  ventilation: VentilationBand | null;
}

export interface CustomTarget {
  label: string;
  oxygen_percent: Range;
  total_pressure_kpa: Range;
  airflow_cm_s: Range | null;
}

export type Target = { profile_id: string } | { custom: CustomTarget };

export interface Point {
  oxygen_percent: number;
  airflow_cm_s: number;
  pressure_kpa: number;
}

// ---- GET /api/context -------------------------------------------------------------------

export interface QuotedSource {
  url: string;
  quote: string;
}

export interface NotIntegratedInvestigation {
  id: string;
  name: string;
  agency: string;
  platform: string;
  years: string;
  oxygen_percent_range: [number, number] | null;
  pressure_kpa_range: [number, number] | null;
  flow_cm_s_range: [number, number] | null;
  data_availability: string;
  reason_not_integrated: string;
  sources: QuotedSource[];
}

export interface GroundFlammability {
  material: string;
  total_pressure_kpa: number | null;
  oxygen_percent: number | null;
  result: string;
  result_definition: string | null;
  source_title: string;
  source_url: string | null;
  page: string | null;
  table: string | null;
}

export interface ContextResponse {
  not_integrated: NotIntegratedInvestigation[];
  ground_flammability: GroundFlammability[];
  /** Experiments with investigation role integrated_context: shown on the map, never modelled. */
  context_experiments: ApiExperiment[];
}

// ---- Coverage / surface -----------------------------------------------------------------

export type Plane = "o2_flow" | "o2_pressure";

/** Query for /api/coverage and /api/surface. Axis params are optional (defaults in docs/API.md). */
export interface GridQuery {
  group: string;
  plane?: Plane;
  slice?: number;
  nx?: number;
  ny?: number;
  x_min?: number;
  x_max?: number;
  y_min?: number;
  y_max?: number;
}

export interface GridAxis {
  variable: string;
  unit: string;
  scale: "linear" | "log";
  values: number[];
}

export interface GridSlice {
  variable: "pressure_kpa" | "airflow_cm_s" | string;
  value: number;
  unit: string;
}

/** ny rows x nx columns. */
export type Grid<T = number> = T[][];

export interface CoverageResponse {
  group_id: string;
  plane: Plane;
  slice: GridSlice;
  x: GridAxis;
  y: GridAxis;
  nn_distance: Grid;
  comparable_count: Grid;
  inside_hull: Grid<boolean | number>;
  sparse_threshold: number;
  scales: { o2: number; flow: number; p: number };
  observations_in_slice: string[];
}

export interface SurfaceResponse extends Omit<CoverageResponse, "nn_distance" | "comparable_count" | "inside_hull"> {
  nn_distance?: Grid | null;
  comparable_count?: Grid | null;
  inside_hull?: Grid<boolean | number> | null;
  /** All model grids are null when model_status != "modeled". */
  p_sustained: Grid | null;
  latent_std_ratio: Grid | null;
  epistemic: Grid | null;
  aleatoric: Grid | null;
  total: Grid | null;
  verdict: Grid<Verdict> | null;
  model_id: string | null;
  model_version: string | null;
  model_status: ModelStatus;
}

// ---- POST /api/predict ------------------------------------------------------------------

export interface PredictRequest {
  group_id: string;
  /** <= 2000 points. */
  points: Point[];
}

export interface Prediction {
  point: Point;
  p_sustained: number | null;
  latent_mean: number | null;
  latent_std: number | null;
  latent_std_ratio: number | null;
  epistemic: number | null;
  aleatoric: number | null;
  total: number | null;
  verdict: Verdict;
  reasons: Reason[];
}

export interface PredictResponse {
  group_id: string;
  model_version: string | null;
  predictions: Prediction[];
}

// ---- POST /api/target/assess ------------------------------------------------------------

export interface AssessRequest {
  group_id: string;
  target: Target;
}

/**
 * `ventilation_standard_with_near_quiescent_extension`: band is [0.5, ventilation max]; the part below
 * the standard's 7.62 cm/s is an analysis choice (ventilation loss / dead zones), not a NASA requirement.
 * `ventilation_standard` and `default_band` are kept for older payloads (docs/API.md).
 */
export type AirflowBandSource =
  | "profile"
  | "ventilation_standard_with_near_quiescent_extension"
  | "ventilation_standard"
  | "default_band";

export interface ResolvedTarget {
  label: string;
  status: AtmosphereStatus | string;
  oxygen_percent: Range;
  total_pressure_kpa: Range;
  airflow_cm_s: Range;
  airflow_band_source: AirflowBandSource;
  /** e.g. "documented_upper_bound_used". Present when the backend adds flags. */
  flags?: string[];
  sources: SourceRef[];
}

export interface NearestObservation {
  observation_id: string;
  experiment_id: string;
  distance: number;
  oxygen_percent: number | null;
  airflow_cm_s: number | null;
  pressure_kpa: number | null;
  label: 0 | 1 | null;
}

export interface TargetCoverage {
  n_target_points: number;
  comparable_observations: number;
  points_with_comparable: number;
  nn_distance_min: number | null;
  nn_distance_median: number | null;
  fraction_inside_hull: number | null;
  nearest_observations: NearestObservation[];
}

export interface TargetModelSummary {
  model_status: ModelStatus;
  p_sustained_mean: number | null;
  p_sustained_min: number | null;
  p_sustained_max: number | null;
  latent_std_ratio_mean: number | null;
  epistemic_mean: number | null;
  aleatoric_mean: number | null;
}

export interface DocumentedContextItem {
  id: string;
  name: string;
  overlap: "contains_target_nominal" | "overlaps_target_region";
  data_availability: string;
  reason_not_integrated: string;
}

export interface AssessResponse {
  group_id: string;
  target: ResolvedTarget;
  coverage: TargetCoverage;
  model: TargetModelSummary;
  verdict: Verdict;
  reasons: Reason[];
  documented_context: DocumentedContextItem[];
  summary: string;
}

// ---- POST /api/candidates/* -------------------------------------------------------------

export interface RankAssumptions {
  pressure_length_scale?: number;
}

export interface RankRequest {
  group_id: string;
  target: Target;
  k?: number;
  assumptions?: RankAssumptions;
}

export type FeasibilityStatus = "within_demonstrated_envelope" | "outside_demonstrated_envelope";

export interface RelatedInvestigation {
  id: string;
  name: string;
  data_availability: string;
  note: string;
}

export interface Candidate {
  candidate_id: string;
  rank: number;
  oxygen_percent: number;
  pressure_kpa: number;
  airflow_cm_s: number;
  evr: number;
  evr_fraction: number;
  marginal_evr_fraction: number;
  mi_reduction_fraction: number;
  p_sustained: number;
  latent_std_ratio: number;
  nn_distance: number;
  feasibility_status: FeasibilityStatus;
  feasibility_note: string;
  reasons: Reason<CandidateReasonCode>[];
  explanation: string;
  related_documented_investigations: RelatedInvestigation[];
}

export type RankStatus = "ok" | "no_eligible_candidates" | "model_unavailable";

export interface SensitivityEntry {
  pressure_length_scale: number;
  top_candidate: Candidate | null;
  same_top_as_default: boolean;
}

export interface CandidateDomain {
  oxygen_percent: [number, number];
  pressure_kpa: [number, number];
  airflow_cm_s: [number, number];
}

export interface RankResponse {
  group_id: string;
  target: ResolvedTarget;
  status: RankStatus;
  candidates: Candidate[];
  baselines: {
    random: Candidate | null;
    uncertainty_sampling: Candidate | null;
    nearest_gap: Candidate | null;
  };
  sensitivity: SensitivityEntry[];
  assumptions: string[];
  candidate_domain: CandidateDomain;
  disclaimer: string;
}

export interface CompareRequest {
  group_id: string;
  target: Target;
  a: Point;
  b: Point;
}

export interface CompareResponse {
  a: Candidate;
  b: Candidate;
  both_evr_fraction: number;
  preferred: "a" | "b" | "indistinguishable";
  reasons: Reason<CandidateReasonCode | string>[];
  assumptions: string[];
}

export interface CounterfactualRequest {
  group_id: string;
  target: Target;
  candidate: Point;
  plane: Plane | null;
  slice: number | null;
}

export type HypotheticalOutcome = "sustained" | "not_sustained";

export interface CounterfactualScenario {
  outcome: HypotheticalOutcome;
  label: string;
  probability: number;
  target_p_mean: number;
  target_latent_var: number;
  target_epistemic: number;
  variance_reduction_fraction: number;
  surface: { p_sustained: Grid; latent_std_ratio: Grid } | null;
}

export interface CounterfactualResponse {
  p_sustained_at_candidate: number;
  current: { target_p_mean: number; target_latent_var: number; target_epistemic: number };
  scenarios: CounterfactualScenario[];
  expected_variance_reduction_fraction: number;
  note: string;
}

// ---- GET /api/model/* -------------------------------------------------------------------

export interface ModelMetadata {
  model_id: string;
  model_version: string;
  group_id: string;
  algorithm: string;
  features: string[] | Record<string, unknown>;
  hyperparameters: Record<string, unknown>;
  fixed_hyperparameters: Record<string, unknown>;
  priors: Record<string, unknown>;
  training: {
    n_observations: number;
    n_experiments: number;
    label_counts: { sustained: number; not_sustained: number };
    confidence_included: string[] | string;
    filters: unknown;
  };
  seed: number;
  trained_at: string;
  dataset_version: string;
  limitations: string[];
}

export interface MetricWithCi {
  value: number | null;
  ci95: [number, number] | null;
}

export interface ValidationModelMetrics {
  name: string;
  brier: MetricWithCi;
  log_loss: MetricWithCi;
  auc: MetricWithCi;
  ece: MetricWithCi;
}

export interface LogoFold {
  held_out: string;
  n: number;
  brier: number | null;
  log_loss: number | null;
  auc: number | null;
}

export interface ReliabilityBin {
  lo: number;
  hi: number;
  count: number;
  mean_predicted: number | null;
  observed_frequency: number | null;
}

export interface BlindspotTest {
  point_level: { n: number; spearman_rho: number | null; p_value: number | null; auroc_error_detection: number | null };
  group_level: {
    n_groups: number;
    spearman_rho: number | null;
    p_value: number | null;
    pairs: { experiment_id: string; pre_reveal_uncertainty: number; error: number }[];
  };
  verdict: "supported" | "not_supported" | "inconclusive";
  interpretation: string;
}

export interface GroupValidation {
  group_id: string;
  n_experiments: number;
  n_observations: number;
  cv: { scheme: string; models: ValidationModelMetrics[] };
  logo: { applicable: boolean; folds: LogoFold[] };
  reliability: { model: string; bins: ReliabilityBin[] };
  error_distribution: { bins: number[]; counts: number[] };
  subgroups: { name: string; n: number; brier: number | null; log_loss: number | null }[];
  sensitivity: {
    variant: string;
    n_training: number;
    brier: number | null;
    log_loss: number | null;
    auc: number | null;
    delta_vs_primary: number | null;
  }[];
  blindspot_test: BlindspotTest;
}

export interface AcquisitionCurvePoint {
  n_acquired: number;
  mean: number;
  ci95: [number, number] | null;
}

export interface AcquisitionScenario {
  name: string;
  group_id: string;
  target_definition: string;
  n_seeds: number;
  n_rounds: number;
  metric: string;
  curves: {
    evr: AcquisitionCurvePoint[];
    uncertainty_sampling: AcquisitionCurvePoint[];
    nearest_gap: AcquisitionCurvePoint[];
    random: AcquisitionCurvePoint[];
  };
  area_under_curve: Record<string, number>;
  interpretation: string;
}

export interface ValidationResponse {
  generated_at: string;
  dataset_version: string;
  model_version: string;
  groups: GroupValidation[];
  acquisition_retrospective: { scenarios: AcquisitionScenario[] };
}

// ---- GET /api/methodology, /api/sources -------------------------------------------------

export interface MethodologyResponse {
  versions: { dataset_version: string | null; model_version: string | null; pipeline_version: string | null; api_version: string };
  config: {
    training_filter: unknown;
    coverage_scales: unknown;
    support_thresholds: unknown;
    candidate_domain: unknown;
    seeds: unknown;
    pressure_length_scale_default: number;
  };
  dates: { data_retrieved: string; last_analysis: string | null };
  limitations: string[];
  repository_url: string | null;
}

export interface SourcePublication {
  title: string;
  doi: string | null;
  url: string | null;
  investigation_id: string | null;
}

export interface RawFileEntry {
  path: string;
  psi_file_name: string;
  sha256: string;
  investigation_id: string | null;
}

export interface SourcesResponse {
  investigations: Investigation[];
  publications: SourcePublication[];
  atmosphere_sources: SourceRef[];
  /** Shapes for these two are not pinned down in docs/API.md. */
  other_investigations: Record<string, unknown>[];
  ground_data_sources: Record<string, unknown>[];
  raw_files: RawFileEntry[];
}

// ---- POST /api/brief --------------------------------------------------------------------

export interface BriefRequest {
  group_id: string;
  target: Target;
  candidate: Point | null;
}

export interface BriefResponse {
  title: string;
  generated_at: string;
  dataset_version: string;
  model_version: string;
  markdown: string;
  sections: {
    target: string;
    coverage: string;
    model: string;
    candidate: string;
    historical_investigations: string;
    citations: string;
    limitations: string;
  };
}
