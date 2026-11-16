// Pure answer builders for "Ask about your cabin air". No runtime imports, so node --test can load this file.
// Every number comes from the passed-in records; nothing here is a safety verdict.
// Distance uses the documented coverage coordinates and reference scales (docs/CONTRACTS.md section 4):
// z_o2 = oxygen %, z_p = ln(p / 101.325), s_o2 = 2.0, s_p = 0.1. Custom air has no airflow, so airflow is not compared.

export type Basis = "measured" | "assumed" | "missing";

export interface AskObservation {
  observation_id: string;
  experiment_id: string;
  group_id: string | null;
  oxygen_percent: number | null;
  airflow_cm_s: number | null;
  total_pressure_kpa: number | null;
  pressure_for_analysis_kpa: number | null;
  flame_state: string | null;
  /** 1 = flame kept burning, 0 = did not (the backend's binary outcome). */
  label?: number | null;
  quality_flags?: string[] | null;
  included_in_training?: boolean | null;
}

export interface NearestTest {
  observation_id: string;
  experiment_id: string;
  oxygen_percent: number;
  pressure_kpa: number | null;
  pressure_basis: Basis;
  airflow_cm_s: number | null;
  outcome: string;
  /** Standardised distance on oxygen and pressure (one unit = one reference distance). */
  distance: number;
  d_o2: number;
  d_kpa: number | null;
}

export interface TestedRanges {
  n: number;
  o2: [number, number] | null;
  kpa: [number, number] | null;
  n_airflow: number;
  all_pressure_assumed: boolean;
}

export const S_O2 = 2.0;
export const S_P = 0.1;
export const P_REF_KPA = 101.325;
export const CLOSING_LINE = "ISS tests only. Not a certified fire-safety assessment.";

/** Up to 3 significant digits, trailing zeros removed. */
export function fmt(v: number): string {
  if (!Number.isFinite(v)) return "";
  const a = Math.abs(v);
  const s = a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2);
  return String(Number(s));
}

export function pressureOf(o: AskObservation): { kpa: number | null; basis: Basis } {
  if (o.total_pressure_kpa != null) return { kpa: o.total_pressure_kpa, basis: "measured" };
  if (o.pressure_for_analysis_kpa != null) return { kpa: o.pressure_for_analysis_kpa, basis: "assumed" };
  return { kpa: null, basis: "missing" };
}

/** Binary outcome: label when present, else flame_state ("sustained" = kept burning). null = not recorded. */
export function keptBurning(o: AskObservation): boolean | null {
  if (o.label === 1) return true;
  if (o.label === 0) return false;
  if (o.flame_state === "sustained") return true;
  if (o.flame_state == null) return null;
  return false;
}

/** Words for what the flame did (same wording as lib/format.ts flame states). */
export function outcomeOf(state: string | null): string {
  if (state === "sustained") return "kept burning";
  if (state === "extinguished" || state === "not_sustained") return "went out";
  if (state === "brief_flame_no_sustain") return "burned briefly, then went out";
  if (state === "not_ignited") return "never lit";
  return "outcome not recorded";
}

/** Training rows of one material group with a recorded oxygen value. */
export function groupRows(obs: AskObservation[], groupId: string): AskObservation[] {
  return obs.filter((o) => o.group_id === groupId && o.included_in_training !== false && o.oxygen_percent != null);
}

/** Closest ISS test of this group to (o2 %, p kPa). Rows without any pressure are compared on oxygen only. */
export function nearestTest(obs: AskObservation[], groupId: string, o2: number, p: number): NearestTest | null {
  let best: NearestTest | null = null;
  for (const o of groupRows(obs, groupId)) {
    const x = o.oxygen_percent as number;
    const { kpa, basis } = pressureOf(o);
    const zo = (x - o2) / S_O2;
    const zp = kpa != null && kpa > 0 && p > 0 ? Math.log(kpa / P_REF_KPA) / S_P - Math.log(p / P_REF_KPA) / S_P : 0;
    const distance = Math.sqrt(zo * zo + zp * zp);
    const cand: NearestTest = {
      observation_id: o.observation_id,
      experiment_id: o.experiment_id,
      oxygen_percent: x,
      pressure_kpa: kpa,
      pressure_basis: basis,
      airflow_cm_s: o.airflow_cm_s,
      outcome: outcomeOf(o.flame_state),
      distance,
      d_o2: x - o2,
      d_kpa: kpa != null ? kpa - p : null,
    };
    if (
      !best ||
      cand.distance < best.distance - 1e-12 ||
      (Math.abs(cand.distance - best.distance) <= 1e-12 && cand.observation_id < best.observation_id)
    ) {
      best = cand;
    }
  }
  return best;
}

export function testedRanges(obs: AskObservation[], groupId: string): TestedRanges {
  const rows = groupRows(obs, groupId);
  const o2s = rows.map((r) => r.oxygen_percent as number);
  const ps = rows.map((r) => pressureOf(r)).filter((x) => x.kpa != null);
  const kpas = ps.map((x) => x.kpa as number);
  return {
    n: rows.length,
    o2: o2s.length ? [Math.min(...o2s), Math.max(...o2s)] : null,
    kpa: kpas.length ? [Math.min(...kpas), Math.max(...kpas)] : null,
    n_airflow: rows.filter((r) => r.airflow_cm_s != null).length,
    all_pressure_assumed: ps.length > 0 && ps.every((x) => x.basis === "assumed"),
  };
}

function kpaRangeText(r: [number, number]): string {
  return r[0] === r[1] ? `only ${fmt(r[0])} kPa tested` : `tested ${fmt(r[0])}–${fmt(r[1])} kPa`;
}

/** What is missing for this air: plain bullets, empty when the air sits inside every tested range. */
export function gapBullets(r: TestedRanges, o2: number, p: number): string[] {
  const out: string[] = [];
  if (r.n === 0) return ["no ISS tests of this material in the integrated records"];
  if (r.o2 && o2 > r.o2[1]) out.push(`oxygen above the tested range (max ${fmt(r.o2[1])} %)`);
  if (r.o2 && o2 < r.o2[0]) out.push(`oxygen below the tested range (min ${fmt(r.o2[0])} %)`);
  if (r.kpa && p < r.kpa[0] - 1e-9) out.push(`pressure below the tested range (${kpaRangeText(r.kpa)})`);
  if (r.kpa && p > r.kpa[1] + 1e-9) out.push(`pressure above the tested range (${kpaRangeText(r.kpa)})`);
  if (!r.kpa) out.push("no tests with recorded pressure");
  if (r.n_airflow === 0) out.push("no tests with recorded airflow");
  if (r.all_pressure_assumed) out.push("pressure was not recorded in these tests; sea-level pressure is assumed");
  return out;
}

/** "Has a flame burned in air like this?" : k of n tests at or below this oxygen level kept burning. */
export function burnedAnswer(obs: AskObservation[], groupId: string, materialLabel: string, o2: number, p: number) {
  const rows = groupRows(obs, groupId).filter((r) => (r.oxygen_percent as number) <= o2 + 1e-9);
  const k = rows.filter((r) => keptBurning(r) === true).length;
  const n = rows.filter((r) => keptBurning(r) !== null).length;
  const r = testedRanges(obs, groupId);
  let sentence: string;
  if (n === 0) {
    sentence = `No ISS test of ${materialLabel} was run at or below ${fmt(o2)} % oxygen, so the records cannot say.`;
  } else {
    sentence = `In ${n} ISS test${n === 1 ? "" : "s"} of ${materialLabel} at or below ${fmt(o2)} % oxygen, a flame kept burning in ${k} of ${n}.`;
  }
  if (r.kpa && (p < r.kpa[0] - 1e-9 || p > r.kpa[1] + 1e-9)) {
    sentence += ` None of them was at ${fmt(p)} kPa (${kpaRangeText(r.kpa)}).`;
  }
  return { sentence, k, n };
}

/** "What is the closest ISS test?" sentence. */
export function nearestSentence(t: NearestTest | null, materialLabel: string): string {
  if (!t) return `There are no ISS tests of ${materialLabel} with a recorded oxygen value in the integrated records.`;
  const p =
    t.pressure_kpa == null
      ? "pressure not recorded"
      : `${fmt(t.pressure_kpa)} kPa${t.pressure_basis === "assumed" ? " (assumed, not recorded)" : ""}`;
  const air = t.airflow_cm_s == null ? "airflow not recorded" : `airflow ${fmt(t.airflow_cm_s)} cm/s`;
  const more = (d: number, unit: string, what: string) =>
    fmt(Math.abs(d)) === "0" ? `the same ${what}` : `${fmt(Math.abs(d))} ${unit} ${d > 0 ? "more" : "less"} ${what}`;
  const diff = [more(t.d_o2, "%", "oxygen"), t.d_kpa == null ? null : more(t.d_kpa, "kPa", "pressure")].filter(Boolean).join(" and ");
  return `The closest ISS test is ${t.experiment_id}: ${fmt(t.oxygen_percent)} % oxygen, ${p}, ${air}; the flame ${t.outcome}. That test had ${diff} than your air.`;
}

export interface ModelInput {
  model_status: string | null;
  model_reason: string | null;
  verdict: string | null;
  p_mean: number | null;
  p_min: number | null;
  p_max: number | null;
  points_supported: number | null;
  n_points: number | null;
}

/** "Can the model answer here?" sentence from a precomputed assess response. */
export function modelSentence(m: ModelInput): { sentence: string; abstains: boolean } {
  if (m.model_status && m.model_status !== "modeled") {
    return {
      sentence: `The model abstains for this material${m.model_reason ? `: ${m.model_reason}` : " (too few ISS tests to fit it)"}.`,
      abstains: true,
    };
  }
  const pts =
    m.points_supported != null && m.n_points != null ? ` ${m.points_supported} of ${m.n_points} points of this air have nearby ISS tests.` : "";
  if (m.verdict === "supported" && m.p_mean != null) {
    const range = m.p_min != null && m.p_max != null ? ` (from ${fmt(m.p_min * 100)} to ${fmt(m.p_max * 100)} % across the points with nearby tests)` : "";
    return {
      sentence: `The model estimates a ${fmt(m.p_mean * 100)} % chance that a flame keeps burning here${range}.${pts}`,
      abstains: false,
    };
  }
  if (m.verdict === "extrapolation") {
    const est = m.p_mean != null ? ` Where it has nearby tests it estimates a ${fmt(m.p_mean * 100)} % chance that a flame keeps burning.` : "";
    return { sentence: `The model only partly answers: this air is beyond most of the ISS tests.${pts}${est}`, abstains: m.p_mean == null };
  }
  return {
    sentence: `The model abstains here: Insufficient experimental evidence for a reliable estimate.${pts}`,
    abstains: true,
  };
}
