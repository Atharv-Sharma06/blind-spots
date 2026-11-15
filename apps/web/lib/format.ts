/**
 * Pure formatting helpers. No runtime relative imports (type imports only) so `node --test` can load it.
 * Numbers are formatted locale-independently (digits are rendered tabular via the `num` CSS class).
 * Missing values (`null`/`undefined`/NaN) render as an em dash, never as 0.
 */
import type {
  AirflowBandSource,
  FeasibilityStatus,
  HypotheticalOutcome,
  ModelStatus,
  Plane,
  Range,
  ReasonCode,
  CandidateReasonCode,
  Verdict,
} from "./types";

export const MISSING = "—"; // em dash
const MINUS = "−";
const KPA_PER_PSI = 6.894757293168361;

export function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Fixed decimals with a proper minus sign; "—" when missing. */
export function fmtFixed(v: number | null | undefined, digits = 1): string {
  if (!isNum(v)) return MISSING;
  const s = v.toFixed(digits);
  // Avoid "-0.0".
  const body = /^-0(\.0+)?$/.test(s) ? s.slice(1) : s;
  return body.startsWith("-") ? MINUS + body.slice(1) : body;
}

/** Integer with thousands separators (thin comma, locale independent). */
export function fmtCount(v: number | null | undefined): string {
  if (!isNum(v)) return MISSING;
  const s = Math.round(v).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Signed difference, e.g. "+0.04". */
export function fmtSigned(v: number | null | undefined, digits = 2): string {
  if (!isNum(v)) return MISSING;
  const s = fmtFixed(v, digits);
  return v > 0 && !s.startsWith(MINUS) ? `+${s}` : s;
}

/** Value that is already in percent units (e.g. oxygen 21 -> "21.0%"). */
export function fmtPercent(v: number | null | undefined, digits = 1): string {
  return isNum(v) ? `${fmtFixed(v, digits)}%` : MISSING;
}

/** Fraction 0..1 shown as a percent (0.71 -> "71%"). */
export function fmtFractionPercent(v: number | null | undefined, digits = 0): string {
  return isNum(v) ? `${fmtFixed(v * 100, digits)}%` : MISSING;
}

/** Probability 0..1 with 2 decimals (0.7123 -> "0.71"). */
export function fmtProbability(v: number | null | undefined, digits = 2): string {
  return fmtFixed(v, digits);
}

export const kpaToPsia = (kpa: number): number => kpa / KPA_PER_PSI;

export function fmtKpa(v: number | null | undefined, digits = 1): string {
  return isNum(v) ? `${fmtFixed(v, digits)} kPa` : MISSING;
}

export function fmtPsia(v: number | null | undefined, digits = 1): string {
  return isNum(v) ? `${fmtFixed(v, digits)} psia` : MISSING;
}

/** kPa with the psia equivalent: "101.3 kPa (14.7 psia)". */
export function fmtPressure(kpa: number | null | undefined, digits = 1): string {
  return isNum(kpa) ? `${fmtKpa(kpa, digits)} (${fmtPsia(kpaToPsia(kpa), 1)})` : MISSING;
}

export function fmtCmS(v: number | null | undefined, digits?: number): string {
  if (!isNum(v)) return MISSING;
  const d = digits ?? (Math.abs(v) < 10 ? 2 : 1);
  return `${fmtFixed(v, d)} cm/s`;
}

export function fmtOxygen(v: number | null | undefined, digits = 1): string {
  return isNum(v) ? `${fmtFixed(v, digits)} % O₂` : MISSING;
}

/** "lo–hi unit" for a [lo, hi] pair; a single value when both ends format identically ("101.4 kPa"). */
export function fmtPair(pair: readonly [number, number] | readonly number[] | null | undefined, unit = "", digits = 1): string {
  if (!pair || pair.length < 2) return MISSING;
  const u = unit ? ` ${unit}` : "";
  const lo = fmtFixed(pair[0], digits);
  const hi = fmtFixed(pair[1], digits);
  if (lo === MISSING && hi === MISSING) return MISSING;
  return lo === hi ? `${lo}${u}` : `${lo}–${hi}${u}`;
}

/** "19 of 27" (D2 target points supported); "—" when either count is missing. */
export function fmtOf(part: number | null | undefined, whole: number | null | undefined): string {
  return isNum(part) && isNum(whole) ? `${fmtCount(part)} of ${fmtCount(whole)}` : MISSING;
}

/** Probability range "0.40–0.90" (a single value when equal); "—" when missing (D2: P only where supported). */
export function fmtProbabilityRange(lo: number | null | undefined, hi: number | null | undefined, digits = 2): string {
  if (!isNum(lo) || !isNum(hi)) return MISSING;
  return fmtPair([lo, hi], "", digits);
}

/** Reference distance (unit of the standardized distance): "0.9 reference distances". */
export function fmtRefDistance(v: number | null | undefined, digits = 1): string {
  if (!isNum(v)) return MISSING;
  const s = fmtFixed(v, digits);
  return `${s} ${s === "1" || s === "1.0" ? "reference distance" : "reference distances"}`;
}

/** Pressure basis for a group (a12-12): measured / assumed (not recorded) / partly assumed. */
export function pressureBasisLabel(measured: boolean, range: readonly number[] | null | undefined): string {
  if (measured) return "measured";
  if (range && range.length >= 2 && fmtFixed(range[0], 1) === fmtFixed(range[1], 1)) return "assumed (not recorded)";
  return "partly assumed";
}

/** Replaces snake_case codes with words; for labels without a dedicated mapping (never show raw codes). */
export function humanizeCode(code: string | null | undefined): string {
  if (!code) return MISSING;
  const t = code.replace(/__/g, " · ").replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Range as "nominal (min–max) unit". Nominal may be null (documented bounds only): then just the
 * bounds, e.g. "up to 24.1 %" when only max exists. Never invents a nominal.
 */
export function fmtRange(r: Range | null | undefined, unit = "", digits = 1): string {
  if (!r) return MISSING;
  const u = unit ? ` ${unit}` : "";
  const { nominal, min, max } = r;
  const span = isNum(min) && isNum(max) ? `${fmtFixed(min, digits)}–${fmtFixed(max, digits)}` : null;
  if (isNum(nominal)) return span ? `${fmtFixed(nominal, digits)}${u} (${span})` : `${fmtFixed(nominal, digits)}${u}`;
  if (span) return `${span}${u}`;
  if (isNum(max)) return `up to ${fmtFixed(max, digits)}${u}`;
  if (isNum(min)) return `from ${fmtFixed(min, digits)}${u}`;
  return MISSING;
}

// ---- Verdicts, flame states, statuses ----------------------------------------------------------------

/** Exact UI text mandated by CONTRACTS section 4. Same constant as lib/copy.ts INSUFFICIENT_EVIDENCE_TEXT. */
export const INSUFFICIENT_EVIDENCE_SENTENCE = "Insufficient experimental evidence for a reliable estimate.";

// ---- Canonical terms (LEAD_DECISIONS D5; .work/audit/a12-copy/glossary.md) -------------------------------

export const TERMS = {
  sustained: "flame kept burning",
  notSustained: "flame went out",
  notUsed: "not used for training",
  analysisGroup: "material setup",
  analysisGroupLabel: "Material and flame setup",
  comparable: "nearby test results",
  referenceDistance: "comparison distance",
  evr: "uncertainty removed",
  epistemic: "knowledge uncertainty",
  aleatoric: "mixed outcomes",
  candidate: "research candidate",
  candidateFirst: "computational research candidate",
  latentStdRatio: "remaining uncertainty",
  insideHull: "inside tested conditions",
  context: "context only",
  notIntegrated: "related NASA work, not used",
} as const;

const VERDICT_LABELS: Record<Verdict, string> = {
  supported: "Supported",
  extrapolation: "Extrapolation",
  insufficient_evidence: "Insufficient evidence",
};

/** Short badge label. */
export function verdictLabel(v: Verdict | null | undefined): string {
  return v ? VERDICT_LABELS[v] ?? v : MISSING;
}

const VERDICT_TEXT: Record<Verdict, string> = {
  supported: "Supported: inside tested conditions, or near 3 or more ISS test results, with low model uncertainty.",
  extrapolation: "Extrapolation: few nearby test results, so the estimate leans on model assumptions.",
  insufficient_evidence: INSUFFICIENT_EVIDENCE_SENTENCE,
};

/** Sentence form; for `insufficient_evidence` this is exactly the mandated sentence. */
export function verdictText(v: Verdict): string {
  return VERDICT_TEXT[v];
}

export function flameStateLabel(label: 0 | 1 | null | undefined): string {
  if (label === 1) return "Flame sustained";
  if (label === 0) return "Flame not sustained";
  return "Not used for training";
}

export function outcomeLabel(outcome: HypotheticalOutcome | null | undefined): string {
  if (outcome === "sustained") return "Flame sustained";
  if (outcome === "not_sustained") return "Flame not sustained";
  return MISSING;
}

const FLAME_STATE_LABELS: Record<string, string> = {
  sustained: "Flame kept burning",
  extinguished: "Flame went out",
  brief_flame_no_sustain: "Brief flame, then out",
  not_ignited: "Flame never lit",
};

/** Curated per-step flame state (CONTRACTS 2.2). */
export function flameStateText(state: string | null | undefined): string {
  return state ? FLAME_STATE_LABELS[state] ?? humanizeCode(state) : MISSING;
}

const EXTINCTION_MODE_LABELS: Record<string, string> = {
  quench_low_flow: "Went out: too little airflow",
  blowoff_high_flow: "Went out: too much airflow",
  at_constant_flow: "Went out at steady airflow",
  flow_turned_off: "Airflow switched off",
  n2_suppression: "Put out with nitrogen",
};

export function extinctionModeLabel(mode: string | null | undefined): string {
  return mode ? EXTINCTION_MODE_LABELS[mode] ?? humanizeCode(mode) : MISSING;
}

const CONFIGURATION_LABELS: Record<string, string> = {
  opposed: "Opposed flow",
  concurrent: "Concurrent flow",
  stagnation: "Axial stagnation",
  wake: "Wake ignition",
  mixed: "Mixed",
  unknown: "Configuration not recorded",
};

export function configurationLabel(c: string | null | undefined): string {
  return c ? CONFIGURATION_LABELS[c] ?? humanizeCode(c) : MISSING;
}

const MATERIAL_FAMILY_LABELS: Record<string, string> = {
  pmma_thin_film: "Thin PMMA film",
  pmma_slab: "PMMA slab",
  pmma_rod: "PMMA rod",
  pmma_sphere: "PMMA sphere",
  sibal_fabric: "SIBAL fabric",
  nomex_fabric: "Nomex fabric",
  ultem_sheet: "Ultem sheet",
  wax_candle: "Wax candle",
  paraffin_slab: "Paraffin slab",
  other: "Other material",
};

export function materialFamilyLabel(f: string | null | undefined): string {
  return f ? MATERIAL_FAMILY_LABELS[f] ?? humanizeCode(f) : MISSING;
}

const AIRFLOW_BASIS_LABELS: Record<string, string> = {
  air_display: "Duct airflow reading",
  stated_cm_s: "Airflow from the source",
  fan_calibration: "Converted from fan setting",
  pot_calibration: "Converted from dial setting",
  none: "No airflow recorded",
};

export function airflowBasisLabel(b: string | null | undefined): string {
  return b ? AIRFLOW_BASIS_LABELS[b] ?? humanizeCode(b) : MISSING;
}

const CONFIDENCE_LABELS: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };
export function confidenceLabel(c: string | null | undefined): string {
  return c ? CONFIDENCE_LABELS[c] ?? humanizeCode(c) : MISSING;
}

const ATMOSPHERE_STATUS_LABELS: Record<string, string> = {
  documented_nasa: "Documented NASA",
  historical_nasa: "Historical NASA",
  nasa_design_recommendation: "NASA design recommendation",
  user_hypothetical: "User-selected hypothetical conditions",
};

export function atmosphereStatusLabel(s: string | null | undefined): string {
  return s ? ATMOSPHERE_STATUS_LABELS[s] ?? humanizeCode(s) : MISSING;
}

const INVESTIGATION_ROLE_LABELS: Record<string, string> = {
  integrated_model: "Used in the model",
  integrated_context: "Context only, not modelled",
  catalogued_not_integrated: "Related NASA work, not used",
};

export function investigationRoleLabel(r: string | null | undefined): string {
  return r ? INVESTIGATION_ROLE_LABELS[r] ?? humanizeCode(r) : MISSING;
}

const EXTRACTION_METHOD_LABELS: Record<string, string> = {
  structured_nasa_data: "Structured NASA data",
  extracted_from_documentation: "From documentation",
  manually_transcribed: "Typed in by hand",
  derived_computation: "Computed",
};

export function extractionMethodLabel(m: string | null | undefined): string {
  return m ? EXTRACTION_METHOD_LABELS[m] ?? humanizeCode(m) : MISSING;
}

const RANK_STATUS_LABELS: Record<string, string> = {
  ok: "Ranked",
  no_eligible_candidates: "No eligible tests to rank",
  no_informative_candidates: "No test would cut the uncertainty",
  model_unavailable: "No model for this material",
};

export function rankStatusLabel(s: string | null | undefined): string {
  return s ? RANK_STATUS_LABELS[s] ?? humanizeCode(s) : MISSING;
}

const PLANE_LABELS: Record<Plane, string> = { o2_flow: "O₂ × airflow", o2_pressure: "O₂ × pressure" };
export function planeLabel(p: Plane | null | undefined): string {
  return p ? PLANE_LABELS[p] ?? humanizeCode(p) : MISSING;
}

const OVERLAP_LABELS: Record<string, string> = {
  contains_target_nominal: "Range contains the target",
  overlaps_target_region: "Range overlaps the target",
};
export function overlapLabel(o: string | null | undefined): string {
  return o ? OVERLAP_LABELS[o] ?? humanizeCode(o) : MISSING;
}

export function modelStatusLabel(s: ModelStatus | null | undefined): string {
  if (s === "modeled") return "Modelled";
  if (s === "insufficient_data") return "Coverage only: too few test results for a model";
  return MISSING;
}

const REASON_LABELS: Record<ReasonCode | CandidateReasonCode, string> = {
  sparse_observations: "Few ISS tests nearby",
  outside_hull: "Outside tested conditions",
  unobserved_pressure: "No tests at this pressure",
  outcome_variability: "Mixed results nearby",
  model_instability: "Model answer is unstable",
  other_family_evidence_only: "Only other materials tested",
  no_model: "No model for this material",
  high_knowledge_uncertainty: "High uncertainty",
  target_points_not_supported: "Not enough nearby ISS tests",
  high_target_covariance: "Tells us a lot about the target",
  high_candidate_uncertainty: "High uncertainty here",
  near_decision_boundary: "Near the model's 50 % line",
  fills_coverage_gap: "Fills a gap in the data",
  assumption_dependent: "Depends on a pressure assumption",
};

const EXTRA_REASON_LABELS: Record<string, string> = {
  relative_evr_difference: "Difference in uncertainty removed",
  preference_flips_under_sensitivity: "Ranking flips if the pressure assumption changes",
};

export function reasonLabel(code: string): string {
  return (REASON_LABELS as Record<string, string>)[code] ?? EXTRA_REASON_LABELS[code] ?? humanizeCode(code);
}

// ---- Candidates: feasibility (exact disclaimers) ----------------------------------------------------------

export const FEASIBILITY_DISCLAIMERS: Record<FeasibilityStatus, string> = {
  within_demonstrated_envelope:
    "Inside conditions already run in the integrated investigations; not an engineering feasibility assessment.",
  outside_demonstrated_envelope: "Feasibility not verified; requires qualified review.",
};

export function feasibilityLabel(status: FeasibilityStatus): { label: string; disclaimer: string } {
  return {
    label: status === "within_demonstrated_envelope" ? "Within tested conditions" : "Outside tested conditions",
    disclaimer: FEASIBILITY_DISCLAIMERS[status],
  };
}

/** CONTRACTS section 0 rule 4 framing for any candidate. */
export const CANDIDATE_DISCLAIMER =
  "Computational research candidate requiring qualified scientific review, established safety procedures and formal feasibility assessment.";

// ---- Target resolution notes -----------------------------------------------------------------------------

const BAND_SOURCE_LABELS: Record<AirflowBandSource, { label: string; explanation: string }> = {
  profile: { label: "Profile airflow", explanation: "Documented for this profile." },
  ventilation_standard_with_near_quiescent_extension: {
    label: "Ventilation standard, extended to near-still air",
    explanation:
      "Upper bound: the documented ventilation range (7.62–60.96 cm/s, NASA-STD-3001 Vol. 2 / HIDH). We extend it down to 0.5 cm/s as an analysis choice, to cover ventilation loss and dead zones. NASA does not require this.",
  },
  ventilation_standard: { label: "Ventilation standard", explanation: "From the documented ventilation range." },
  default_band: { label: "Default airflow band", explanation: "No documented band, so a default is used." },
  custom: { label: "User-selected airflow band", explanation: "The band you entered." },
};

export function airflowBandSourceLabel(s: AirflowBandSource): { label: string; explanation: string } {
  return BAND_SOURCE_LABELS[s] ?? { label: humanizeCode(String(s)), explanation: "" };
}

const TARGET_FLAG_LABELS: Record<string, string> = {
  documented_upper_bound_used:
    "Upper bound used (no typical value documented). Higher O₂ is the worst case for flammability.",
  documented_pressure_used: "Documented pressure used (no typical value documented).",
  documented_lower_bound_used: "Lower bound used (no typical value documented).",
  documented_bound_used: "Bound used (no typical value documented).",
  default_band: "No documented airflow band; a default is used.",
};

export function targetFlagLabel(flag: string): string {
  return TARGET_FLAG_LABELS[flag] ?? humanizeCode(flag);
}

/**
 * Honest phrasing for a gap next to documented-but-not-integrated work. Never says NASA has not studied
 * a condition.
 */
export function notRepresentedText(names: readonly string[]): string {
  const base = "These conditions are not represented in the integrated records.";
  if (names.length === 0) return base;
  return `${base} Related NASA work not used here: ${names.join("; ")}.`;
}

// ---- Axes ----------------------------------------------------------------------------------------------------

export interface PlaneAxes {
  x: { title: string; unit: string };
  y: { title: string; unit: string; log: boolean };
  slice: { title: string; unit: string };
}

/** Axis titles per plane (UI constants; defaults for axis domains live in docs/API.md). */
export function planeAxes(plane: Plane): PlaneAxes {
  return plane === "o2_flow"
    ? {
        x: { title: "Oxygen", unit: "% vol" },
        y: { title: "Airflow", unit: "cm/s", log: true },
        slice: { title: "Pressure", unit: "kPa" },
      }
    : {
        x: { title: "Oxygen", unit: "% vol" },
        y: { title: "Pressure", unit: "kPa", log: false },
        slice: { title: "Airflow", unit: "cm/s" },
      };
}

/** First N chars of a version id for compact display. */
export function shortVersion(v: string | null | undefined, n = 8): string {
  return v ? v.slice(0, n) : MISSING;
}
