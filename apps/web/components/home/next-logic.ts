/**
 * Pure helpers for Step 3 of the Cabins page (what to test next): plain-language sentences and facts built
 * only from API numbers. No numbers are invented here; every value comes from a rank/counterfactual response.
 */
import { distanceToTarget } from "@/components/target/evidence";
import { fmtFixed, isNum, kpaToPsia } from "@/lib/format";
import type { Candidate, CandidateDomain, Range, ResolvedTarget } from "@/lib/types";
import type { TestRow } from "./answer-copy";

/** "34.0" -> "34", "56.50" -> "56.5": at most `maxDecimals`, no trailing zeros. */
export function trimNumber(v: number, maxDecimals = 1): string {
  return fmtFixed(v, maxDecimals).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/** "Thin acrylic film (PMMA)" -> "thin acrylic film (PMMA)"; proper names (Nomex, Ultem) keep their capital. */
export function lowerFirst(name: string): string {
  return /^(Nomex|Ultem)\b/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

export function oxygenText(c: Pick<Candidate, "oxygen_percent">): string {
  return `${trimNumber(c.oxygen_percent, 1)} %`;
}
export function pressureText(c: Pick<Candidate, "pressure_kpa">): string {
  return `${trimNumber(c.pressure_kpa, 1)} kPa`;
}
export function pressurePsiaText(c: Pick<Candidate, "pressure_kpa">): string {
  return `${trimNumber(kpaToPsia(c.pressure_kpa), 1)} psia`;
}
export function airflowText(c: Pick<Candidate, "airflow_cm_s">): string {
  return `${trimNumber(c.airflow_cm_s, c.airflow_cm_s < 1 ? 2 : 1)} cm/s`;
}

/** Fraction 0..1 as "19 %"; "less than 1 %" for a positive value that would round to 0. */
export function percentText(fraction: number): string {
  const pct = fraction * 100;
  if (pct > 0 && pct < 0.5) return "less than 1 %";
  return `${fmtFixed(pct, 0)} %`;
}

/** The share of uncertainty a candidate removes: rank 1 on its own, later ranks after the ones above them (greedy batch). */
export function reductionFraction(c: Candidate): number | null {
  const v = c.rank <= 1 ? c.evr_fraction : c.marginal_evr_fraction;
  return isNum(v) ? v : null;
}

/** "Would cut the model's uncertainty about this cabin by 19 %." / "Would cut it by a further 14 % after test 1." */
export function reductionSentence(c: Candidate): string | null {
  const f = reductionFraction(c);
  if (f === null) return null;
  if (c.rank <= 1) return `Would cut the model's uncertainty about this cabin by ${percentText(f)}.`;
  const above = c.rank === 2 ? "test 1" : `tests 1${c.rank > 3 ? " to " : " and "}${c.rank - 1}`;
  return `Would cut it by a further ${percentText(f)} after ${above}.`;
}

/**
 * D4: the candidate sits at the cabin's own conditions. The backend flags it (`at_target_conditions`); otherwise the
 * distance to the target region decides (within one reference distance), exactly as the Explorer does.
 */
export function isAtTarget(c: Candidate, target: ResolvedTarget): boolean {
  if (c.reasons.some((r) => (r.code as string) === "at_target_conditions")) return true;
  if (isNum(c.target_distance)) return c.target_distance <= 1;
  const d = distanceToTarget(c, target);
  return d !== null && d <= 1;
}

/** D4 wording in plain words (the Explorer keeps the precise sentence). Used only when the test really is at the cabin's air. */
export const AT_TARGET_PLAIN =
  "This is the cabin's own air. The most informative single test is at the cabin's own conditions. That follows from the model's assumption that conditions close together behave alike.";

function bounds(r: Range): [number, number] | null {
  const lo = r.min ?? r.nominal ?? r.max;
  const hi = r.max ?? r.nominal ?? r.min;
  return isNum(lo) && isNum(hi) ? [Math.min(lo, hi), Math.max(lo, hi)] : null;
}

/** How far a value lies outside a range (0 inside). */
function outside(v: number, [lo, hi]: [number, number]): number {
  return v < lo ? lo - v : v > hi ? v - hi : 0;
}

/** The cabin's oxygen as plain text: "34 %", "up to 25.6 %" (only an upper bound is documented) or "21 to 23 %". */
function cabinOxygenText(r: Range): string | null {
  if (isNum(r.nominal)) return `${trimNumber(r.nominal, 1)} %`;
  if (isNum(r.min) && isNum(r.max)) return `${trimNumber(r.min, 1)} to ${trimNumber(r.max, 1)} %`;
  if (isNum(r.max)) return `up to ${trimNumber(r.max, 1)} %`;
  if (isNum(r.min)) return `at least ${trimNumber(r.min, 1)} %`;
  return null;
}

/**
 * The sentence under the top pick when the backend flags it as at the cabin's conditions (D4). If the test point is on
 * the grid beside the cabin's air (a different oxygen or pressure than the cabin states, e.g. above a documented
 * maximum) it is NOT called "the cabin's own air": it says it is the closest test point and shows both values.
 */
function airOffsets(c: Candidate, target: ResolvedTarget): { o2Off: boolean; kpaOff: boolean } {
  const o2 = bounds(target.oxygen_percent);
  const kpa = bounds(target.total_pressure_kpa);
  return { o2Off: o2 !== null && outside(c.oxygen_percent, o2) > 0.05, kpaOff: kpa !== null && outside(c.pressure_kpa, kpa) > 1 };
}

/** True when the candidate really sits inside the cabin's stated oxygen and pressure (not merely on the grid beside it). */
export function isAtCabinAir(c: Candidate, target: ResolvedTarget): boolean {
  const { o2Off, kpaOff } = airOffsets(c, target);
  return isAtTarget(c, target) && !o2Off && !kpaOff;
}

export function atTargetSentence(c: Candidate, target: ResolvedTarget): string {
  const { o2Off, kpaOff } = airOffsets(c, target);
  if (!o2Off && !kpaOff) return AT_TARGET_PLAIN;
  const cabinO2 = cabinOxygenText(target.oxygen_percent);
  const detail = o2Off && cabinO2 ? ` (cabin ${cabinO2} oxygen, test ${oxygenText(c)})` : "";
  return `This is the closest test point to the cabin's air${detail}. The most informative single test is near the cabin's own conditions. That follows from the model's assumption that conditions close together behave alike.`;
}

/** One calm line on why the top pick matters (no numbers). */
export function whyItMatters(atCabinAir: boolean): string {
  return `Why it matters: ${
    atCabinAir ? "this is the air the crew would breathe. One test here would show directly whether the material keeps burning in it." : "it would help fill the gap between the ISS tests and this cabin's air."
  } Results like this inform what fire controls a cabin like this needs.`;
}

/** Which of the three numbers differ between the candidates (the others are the same in every card). */
export function differingFields(cs: readonly Candidate[]): { oxygen: boolean; pressure: boolean; airflow: boolean } {
  const differs = (text: (c: Candidate) => string) => new Set(cs.map(text)).size > 1;
  return cs.length < 2
    ? { oxygen: false, pressure: false, airflow: false }
    : { oxygen: differs(oxygenText), pressure: differs(pressureText), airflow: differs(airflowText) };
}

export interface ClosestIssTest {
  oxygen: number;
  kpa: number;
  pressureAssumed: boolean;
  /** Percentage points of oxygen between this test and the cabin's air (0 when inside the cabin's range). */
  oxygenGap: number;
  kpaGap: number;
}

/**
 * The ISS test result of this material closest to the cabin's air, by oxygen and pressure each scaled to the span the
 * ranking covers. Gaps are measured to the cabin's stated range, so they are 0 inside it. Null if nothing can be measured.
 */
export function closestIssTest(rows: readonly TestRow[], target: ResolvedTarget, domain: CandidateDomain): ClosestIssTest | null {
  const o2 = bounds(target.oxygen_percent);
  const kpa = bounds(target.total_pressure_kpa);
  if (!o2 || !kpa || rows.length === 0) return null;
  const o2Span = Math.max(1e-9, domain.oxygen_percent[1] - domain.oxygen_percent[0]);
  const kpaSpan = Math.max(1e-9, domain.pressure_kpa[1] - domain.pressure_kpa[0]);
  let best: ClosestIssTest | null = null;
  let bestScore = Infinity;
  for (const r of rows) {
    const og = outside(r.oxygen, o2);
    const kg = outside(r.kpa, kpa);
    const score = Math.hypot(og / o2Span, kg / kpaSpan);
    if (score < bestScore) {
      bestScore = score;
      best = { oxygen: r.oxygen, kpa: r.kpa, pressureAssumed: r.pressureAssumed, oxygenGap: og, kpaGap: kg };
    }
  }
  return best;
}

/** "Closest ISS test of this material: 22.2 % oxygen, 101 kPa. That is 11.8 points of oxygen and 45 kPa from this cabin." */
export function closestIssSentence(t: ClosestIssTest): string | null {
  const gaps: string[] = [];
  if (t.oxygenGap >= 0.05) gaps.push(`${trimNumber(t.oxygenGap, 1)} points of oxygen`);
  if (t.kpaGap >= 0.5) gaps.push(`${trimNumber(t.kpaGap, 0)} kPa`);
  if (gaps.length === 0) return null;
  return `Closest ISS test of this material: ${trimNumber(t.oxygen, 1)} % oxygen, ${trimNumber(t.kpa, 1)} kPa${t.pressureAssumed ? " (pressure assumed)" : ""}. That is ${gaps.join(" and ")} from this cabin's air.`;
}

/** True when the cabin's oxygen lies outside the range the ranking covers (from the API's candidate domain). */
export function targetOutsideOxygenDomain(target: ResolvedTarget, domain: CandidateDomain | undefined): boolean {
  if (!domain) return false;
  const [lo, hi] = domain.oxygen_percent;
  const o2 = target.oxygen_percent;
  const top = o2.max ?? o2.nominal;
  const bottom = o2.min ?? o2.nominal;
  return (top !== null && top > hi) || (bottom !== null && bottom < lo);
}
