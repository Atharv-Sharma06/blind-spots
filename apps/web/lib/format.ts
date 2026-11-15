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

/** "lo–hi unit" for a [lo, hi] pair. */
export function fmtPair(pair: readonly [number, number] | null | undefined, unit = "", digits = 1): string {
  if (!pair) return MISSING;
  const u = unit ? ` ${unit}` : "";
  return `${fmtFixed(pair[0], digits)}–${fmtFixed(pair[1], digits)}${u}`;
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

/** Exact UI text mandated by CONTRACTS section 4 (also in lib/copy.ts as INSUFFICIENT_EVIDENCE_TEXT). */
export const INSUFFICIENT_EVIDENCE_SENTENCE = "Insufficient experimental evidence for a reliable estimate.";

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
  supported: "Supported: close to comparable observations inside the observed region.",
  extrapolation: "Extrapolation: beyond the observed region; the estimate depends on model assumptions.",
  insufficient_evidence: INSUFFICIENT_EVIDENCE_SENTENCE,
};

/** Sentence form; for `insufficient_evidence` this is exactly the mandated sentence. */
export function verdictText(v: Verdict): string {
  return VERDICT_TEXT[v];
}

export function flameStateLabel(label: 0 | 1 | null | undefined): string {
  if (label === 1) return "Flame sustained";
  if (label === 0) return "Not sustained";
  return "Not used for training";
}

export function outcomeLabel(outcome: HypotheticalOutcome | null | undefined): string {
  if (outcome === "sustained") return "Flame sustained";
  if (outcome === "not_sustained") return "Not sustained";
  return MISSING;
}

export function modelStatusLabel(s: ModelStatus | null | undefined): string {
  if (s === "modeled") return "Modelled";
  if (s === "insufficient_data") return "Insufficient data (coverage only)";
  return MISSING;
}

const REASON_LABELS: Record<ReasonCode | CandidateReasonCode, string> = {
  sparse_observations: "Sparse observations nearby",
  outside_hull: "Outside the observed region",
  unobserved_pressure: "Pressure not observed",
  outcome_variability: "Mixed outcomes nearby",
  model_instability: "Model unstable across resamples",
  other_family_evidence_only: "Evidence from other material families only",
  no_model: "No model for this group",
  high_target_covariance: "Strongly informs the target",
  high_candidate_uncertainty: "High uncertainty at the candidate",
  near_decision_boundary: "Near the predicted decision boundary",
  fills_coverage_gap: "Fills a coverage gap",
  assumption_dependent: "Depends on the assumed pressure correlation",
};

export function reasonLabel(code: string): string {
  return (REASON_LABELS as Record<string, string>)[code] ?? code.replace(/_/g, " ");
}

// ---- Candidates: feasibility (exact disclaimers) ----------------------------------------------------------

export const FEASIBILITY_DISCLAIMERS: Record<FeasibilityStatus, string> = {
  within_demonstrated_envelope:
    "Inside conditions already run in the integrated investigations; not an engineering feasibility assessment.",
  outside_demonstrated_envelope: "Feasibility not verified; requires qualified review.",
};

export function feasibilityLabel(status: FeasibilityStatus): { label: string; disclaimer: string } {
  return {
    label: status === "within_demonstrated_envelope" ? "Within demonstrated envelope" : "Outside demonstrated envelope",
    disclaimer: FEASIBILITY_DISCLAIMERS[status],
  };
}

/** CONTRACTS section 0 rule 4 framing for any candidate. */
export const CANDIDATE_DISCLAIMER =
  "Computational research candidate requiring qualified scientific review, established safety procedures and formal feasibility assessment.";

// ---- Target resolution notes -----------------------------------------------------------------------------

const BAND_SOURCE_LABELS: Record<AirflowBandSource, { label: string; explanation: string }> = {
  profile: { label: "Profile airflow", explanation: "Airflow band documented for this profile." },
  ventilation_standard_with_near_quiescent_extension: {
    label: "Ventilation standard with near-quiescent extension",
    explanation:
      "The upper bound is the documented ventilation range (7.62–60.96 cm/s, NASA-STD-3001 Vol. 2 / HIDH). The band is extended down to 0.5 cm/s as an analysis choice (ventilation loss or dead zones; microgravity flame extinction happens at low flow); that extension is not a NASA requirement.",
  },
  ventilation_standard: { label: "Ventilation standard", explanation: "Airflow band from the documented ventilation range." },
  default_band: { label: "Default analysis band", explanation: "No documented airflow band; a default analysis band is used." },
};

export function airflowBandSourceLabel(s: AirflowBandSource): { label: string; explanation: string } {
  return BAND_SOURCE_LABELS[s] ?? { label: String(s), explanation: "" };
}

const TARGET_FLAG_LABELS: Record<string, string> = {
  documented_upper_bound_used:
    "Documented upper bound used (no nominal documented); higher O₂ is the worst case for flammability.",
  documented_pressure_used: "Documented pressure value used (no nominal documented).",
};

export function targetFlagLabel(flag: string): string {
  return TARGET_FLAG_LABELS[flag] ?? flag.replace(/_/g, " ");
}

/**
 * Honest phrasing for a gap next to documented-but-not-integrated work. Never says NASA has not studied
 * a condition.
 */
export function notRepresentedText(names: readonly string[]): string {
  const base = "These conditions are not represented in the integrated records.";
  if (names.length === 0) return base;
  return `${base} Documented NASA work that is not integrated here and may bear on them: ${names.join("; ")}.`;
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
