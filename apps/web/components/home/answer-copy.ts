/**
 * Words and small derivations for the answer card. Every number comes from the API response passed in; nothing here
 * invents or hard-codes a measurement. Sentences are short and use the plain vocabulary of the Cabins page.
 */
import { isNum, kpaToPsia } from "@/lib/format";
import { pointsSupported, targetPAllowed } from "@/components/target/evidence";
import type { ApiObservation, AssessResponse, AtmosphereProfile, GroupSummary, Range, Verdict } from "@/lib/types";
import type { ChartCabin, ChartDot } from "./simple-chart";

/** 34 -> "34", 56.537 -> "56.5", 101.353 -> "101.4"; trailing zeros dropped. */
export function trimNum(v: number, digits = 1): string {
  return String(Number(v.toFixed(digits)));
}

/** Pressure the way the cabin cards show it: whole kPa from 100 up, one decimal below. */
export function kpaText(v: number): string {
  return v >= 100 ? String(Math.round(v)) : trimNum(v, 1);
}

export function psiaText(kpa: number): string {
  return `${trimNum(kpaToPsia(kpa), 1)} psia`;
}

/** "13.5–22.7" or "21" when both ends are equal after rounding. */
export function rangeText(lo: number, hi: number, digits = 1): string {
  const a = trimNum(lo, digits);
  const b = trimNum(hi, digits);
  return a === b ? a : `${a}–${b}`;
}

const PROPER_NOUNS = new Set(["Nomex", "Ultem"]);
/** "Thin acrylic film (PMMA)" -> "thin acrylic film (PMMA)"; proper nouns keep their capital. */
export function lcFirst(s: string): string {
  const first = s.split(/[\s(]/)[0] ?? "";
  return PROPER_NOUNS.has(first) || s.length === 0 ? s : s[0]!.toLowerCase() + s.slice(1);
}

// ---- Cabin air ----------------------------------------------------------------------------------------

export interface CabinAir {
  o2: number;
  kpa: number;
  /** True when only an upper bound is documented ("up to"). */
  o2UpTo: boolean;
}

const mid = (r: Range): number | null => r.nominal ?? r.max ?? r.min;

/** The single point used as the cabin's marker; null when oxygen or pressure is missing (never guessed). */
export function cabinAir(p: Pick<AtmosphereProfile, "oxygen_percent" | "total_pressure_kpa">): CabinAir | null {
  const o2 = mid(p.oxygen_percent);
  const kpa = mid(p.total_pressure_kpa);
  if (!isNum(o2) || !isNum(kpa)) return null;
  return { o2, kpa, o2UpTo: p.oxygen_percent.nominal === null && p.oxygen_percent.min === null && p.oxygen_percent.max !== null };
}

function bounds(r: Range): [number, number] {
  const lo = r.min ?? r.nominal ?? r.max ?? 0;
  const hi = r.max ?? r.nominal ?? r.min ?? lo;
  return [Math.min(lo, hi), Math.max(lo, hi)];
}

export function chartCabin(id: string, label: string, p: Pick<AtmosphereProfile, "oxygen_percent" | "total_pressure_kpa">): ChartCabin | null {
  const air = cabinAir(p);
  if (!air) return null;
  const [xLo, xHi] = bounds(p.oxygen_percent);
  const [yLo, yHi] = bounds(p.total_pressure_kpa);
  return { id, label, x: air.o2, y: air.kpa, xLo, xHi, yLo, yHi };
}

/** "34 % oxygen, 56.5 kPa" (with "up to" when only an upper bound is documented). */
export function airSentenceParts(air: CabinAir): { o2: string; kpa: string } {
  return { o2: `${air.o2UpTo ? "up to " : ""}${trimNum(air.o2, 1)} % oxygen`, kpa: `${kpaText(air.kpa)} kPa` };
}

// ---- Test results (dots) -----------------------------------------------------------------------------

export interface TestRow {
  id: string;
  oxygen: number;
  kpa: number;
  pressureAssumed: boolean;
  airflow: number | null;
  burned: boolean;
}

/** One row per test result with an outcome, oxygen and pressure; the pressure is the one the model uses. */
export function testRows(obs: readonly ApiObservation[]): { rows: TestRow[]; withoutOutcome: number; notUsed: number; notUsedNoAirflow: boolean } {
  const rows: TestRow[] = [];
  let withoutOutcome = 0;
  let notUsed = 0;
  const reasons = new Set<string | null>();
  for (const o of obs) {
    const kpa = o.pressure_for_analysis_kpa ?? o.total_pressure_kpa;
    if (o.label === null) {
      withoutOutcome += 1;
      continue;
    }
    if (!isNum(o.oxygen_percent) || !isNum(kpa)) continue;
    if (o.included_in_training === false) {
      notUsed += 1;
      reasons.add(o.exclusion_reason ?? null);
    }
    rows.push({
      id: o.observation_id,
      oxygen: o.oxygen_percent,
      kpa,
      pressureAssumed: o.total_pressure_kpa === null && o.pressure_for_analysis_kpa !== null,
      airflow: isNum(o.airflow_cm_s) ? o.airflow_cm_s : null,
      burned: o.label === 1,
    });
  }
  return { rows, withoutOutcome, notUsed, notUsedNoAirflow: reasons.size === 1 && reasons.has("no_numeric_airflow") };
}

export const toDots = (rows: readonly TestRow[]): ChartDot[] => rows.map((r) => ({ id: r.id, x: r.oxygen, y: r.kpa, burned: r.burned }));

// ---- Verdict ------------------------------------------------------------------------------------------

export type VerdictTone = "blind" | "partly" | "covered";

export function verdictTone(v: Verdict): VerdictTone {
  return v === "insufficient_evidence" ? "blind" : v === "extrapolation" ? "partly" : "covered";
}

export interface VerdictFacts {
  verdict: Verdict;
  /** Nearby ISS test results for this material at this cabin (API coverage). */
  comparable: number;
  /** Nearby results summed over every material (headline); null when the headline is unavailable. */
  comparableAnyMaterial: number | null;
}

/** The big line. It never says "none" unless the API says none for the scope it names. */
export function verdictTitle(f: VerdictFacts): string {
  if (f.verdict === "supported") return "Covered: ISS flame tests ran in air like this.";
  if (f.verdict === "extrapolation") return "Partly covered: only part of this air has nearby ISS tests.";
  if (f.comparableAnyMaterial === 0) return "Blind spot: none of the ISS flame tests ran in air like this.";
  if (f.comparable === 0) return "Blind spot: no ISS test of this material ran in air like this.";
  return "Blind spot: very few ISS tests of this material ran in air like this.";
}

export interface AnswerFacts extends VerdictFacts {
  assess: AssessResponse;
  group: GroupSummary;
  materialLc: string;
  air: CabinAir | null;
}

/** One to three plain sentences, each under 20 words, built only from API numbers. */
export function answerSentences(f: AnswerFacts): string[] {
  const out: string[] = [];
  const g = f.group;
  const o2 = g.oxygen_percent_range;
  const kp = g.pressure_kpa_range;
  if (o2 && kp) {
    const seaLevel = kp[0] >= 96 && kp[1] <= 106;
    const measured = g.pressure_measured;
    const same = trimNum(kp[0], 0) === trimNum(kp[1], 0);
    if (measured) {
      out.push(`For ${f.materialLc}, ISS tests ran at ${rangeText(o2[0], o2[1])} % oxygen and ${rangeText(kp[0], kp[1], 0)} kPa${seaLevel ? ", about sea-level pressure" : ""}.`);
    } else if (same) {
      out.push(`For ${f.materialLc}, ISS tests ran at ${rangeText(o2[0], o2[1])} % oxygen. Pressure was not recorded; the dataset assumes ${rangeText(kp[0], kp[1], 0)} kPa.`);
    } else {
      out.push(`For ${f.materialLc}, ISS tests ran at ${rangeText(o2[0], o2[1])} % oxygen and ${rangeText(kp[0], kp[1], 0)} kPa (pressure partly assumed).`);
    }
  }
  const air = f.air ? airSentenceParts(f.air) : null;
  const cov = f.assess.coverage;
  if (f.verdict === "insufficient_evidence") {
    out.push(air ? `This cabin has ${air.o2} at ${air.kpa}, so the model does not guess here.` : "The model does not guess here.");
  } else if (f.verdict === "extrapolation") {
    out.push(`Nearby ISS tests reach ${cov.points_with_comparable} of ${cov.n_target_points} sampled conditions across this cabin's air. Elsewhere the model does not guess.`);
  } else {
    const sup = pointsSupported(f.assess);
    out.push(
      sup !== null
        ? `The model is confident for ${sup} of ${cov.n_target_points} sampled conditions across this cabin's air.`
        : `Nearby ISS tests cover this cabin's air, and the model's uncertainty there is low.`,
    );
  }
  if (targetPAllowed(f.assess) && f.verdict !== "insufficient_evidence") {
    const m = f.assess.model;
    const lo = Math.round((m.p_sustained_min ?? 0) * 100);
    const hi = Math.round((m.p_sustained_max ?? 0) * 100);
    out.push(
      lo === hi
        ? `For this material the model puts the chance that a flame keeps burning at ${lo} %. This is a model estimate, not a safety rating.`
        : `Depending on airflow, the model puts the chance that a flame keeps burning at ${lo} % to ${hi} %. This is a model estimate, not a safety rating.`,
    );
  }
  return out;
}

// ---- Related NASA work ---------------------------------------------------------------------------------

const GROUND_TEST = /drop[\s-]?tower|ground|NASA-STD-6001|ZGRF/i;

export interface RelatedNasa {
  n: number;
  /** At least one of them is a ground (drop-tower or standard) test, so the sentence may say "ground tests". */
  ground: boolean;
}

/**
 * Investigations the API lists for this cabin whose documented test range contains or overlaps it and that the model
 * does not train on (context or not integrated). Same list the Explorer shows as "NASA investigations for this cabin".
 */
export function relatedNasaTests(a: AssessResponse): RelatedNasa {
  const near = (o: string | null | undefined) => o === "contains_target_nominal" || o === "overlaps_target_region";
  const rel = a.investigation_relevance;
  if (rel && rel.length > 0) {
    const rows = rel.filter((r) => r.role !== "integrated_model" && near(r.envelope_overlap));
    return { n: rows.length, ground: rows.some((r) => GROUND_TEST.test(r.name)) };
  }
  const rows = a.documented_context.filter((c) => near(c.overlap));
  return { n: rows.length, ground: rows.some((c) => GROUND_TEST.test(c.name)) };
}

export function relatedNasaSentence(r: RelatedNasa): string {
  // The match is a documented test RANGE that contains or overlaps this air, not proof of a test at these exact conditions.
  return `NASA ${r.ground ? "ground " : ""}tests with a documented range that includes this air exist; the model does not use them.`;
}
