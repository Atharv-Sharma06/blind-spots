/**
 * Types mirroring docs/CONTRACTS.md section 3 (normalized schemas) and section 8 (HTTP API).
 *
 * TODO(reconcile): these must be reconciled field-by-field with
 * services/analysis/src/blindspots/api/models.py and blindspots/schemas.py once the API
 * models exist. Until then, CONTRACTS.md is the source of truth. Anything marked
 * "provisional" is a guess about a response shape that CONTRACTS.md does not spell out.
 *
 * Conventions: Python `None` -> `null` (never `undefined`, never 0). Dates are ISO 8601 strings.
 */

// ---- Section 3: enums -------------------------------------------------------------------

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

// ---- Section 3: records -----------------------------------------------------------------

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

/** One physical test. */
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

export interface Range {
  nominal: number;
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
  oxygen_percent: Range;
  total_pressure_kpa: Range;
  airflow_cm_s: Range | null;
  sources: SourceRef[];
  notes: string | null;
}

// ---- Section 4: model support verdict -------------------------------------------------------

/** Scientific limits are 200 responses with a verdict, never errors (CONTRACTS section 8). */
export type Verdict = "supported" | "extrapolation" | "insufficient_evidence";

// ---- Section 8: HTTP API ----------------------------------------------------------------------

export type ApiErrorCode =
  | "validation_error" // 422
  | "not_found" // 404
  | "artifact_missing" // 503
  | "ingestion_failure" // 500
  | "backend_unavailable" // 503 from the web proxy (also produced client-side)
  | "internal"; // 500

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown> | null;
  };
}

/** GET /api/health. `artifacts` shape is provisional (CONTRACTS only says `{...}`). */
export interface HealthResponse {
  status: "ok" | "degraded";
  dataset_version: string | null;
  model_version: string | null;
  artifacts: Record<string, unknown>;
}

/** GET /api/families (provisional field types). */
export interface FamilySummary {
  family_id: string;
  label: string;
  n_experiments: number;
  n_observations: number;
  n_training: number;
  model_status: string;
  configurations: string[];
}

/** GET /api/experiments/{id}. */
export interface ExperimentDetail {
  experiment: ExperimentRecord;
  observations: Observation[];
}

/** GET /api/experiments query parameters. */
export interface ExperimentsQuery {
  investigation?: string;
  family?: string;
  q?: string;
  included?: boolean;
}
