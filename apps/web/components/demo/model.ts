/** Pure helpers for the guided demo (no React): timing, data-driven target choice, short captions. */
import { CANDIDATE_FRAMING } from "@/lib/copy";
import { fmtCmS, fmtFixed, fmtFractionPercent, fmtOxygen, fmtPressure, verdictLabel } from "@/lib/format";
import type { AssessResponse, AtmosphereProfile, Candidate, CounterfactualResponse, GroupSummary } from "@/lib/types";

/** UI constants: a ~3 s title card, five scenes of 4.5 s, then the end card (3 + 5 x 4.5 = 25.5 s before the end card). */
export const TITLE_SECONDS = 3;
export const SCENE_SECONDS = 4.5;
export const SCENE_COUNT = 5;
/** Scene index 6 is the end card. */
export const END_SCENE = SCENE_COUNT + 1;

export const TITLE_LINE = "Blind Spots — where NASA's microgravity fire evidence ends, and what to learn next";
export const TITLE_SUBLINE = "Fire safety in crew cabins: spacecraft, Moon and Mars habitats.";
export const END_NAME = "Blind Spots";
export const END_LINE = "Where NASA's microgravity fire evidence ends, and what to learn next.";

/** Profile status preference for ties: forward-looking NASA design atmospheres first. */
const STATUS_RANK: Record<string, number> = { nasa_design_recommendation: 0, documented_nasa: 1, historical_nasa: 2 };

/**
 * Documented profile with the fewest comparable observations for the current group. Ties go to NASA design
 * recommendations, then to the larger nearest-observation distance (the clearest blind spot). Profiles whose
 * assessment has not loaded yet are ignored; falls back to the first profile when none has loaded.
 */
export function pickDemoProfile(profiles: readonly AtmosphereProfile[], assessments: ReadonlyMap<string, AssessResponse>): string | null {
  const usable = profiles.filter((p) => p.kind !== "envelope");
  let best: { id: string; n: number; s: number; d: number } | null = null;
  for (const p of usable) {
    const a = assessments.get(p.profile_id);
    if (!a) continue;
    const c = { id: p.profile_id, n: a.coverage.comparable_observations, s: STATUS_RANK[p.status] ?? 3, d: a.coverage.nn_distance_min ?? 0 };
    const better = best === null || c.n < best.n || (c.n === best.n && (c.s < best.s || (c.s === best.s && c.d > best.d)));
    if (better) best = c;
  }
  return best?.id ?? usable[0]?.profile_id ?? null;
}

/** Observations are drawn within |ln(p / slice)| <= 0.1 of the slice (explore model); the same window decides what counts as "inside the observed range". */
const PRESSURE_WINDOW_LN = 0.1;

/** True when a target pressure lies outside the group's observed pressure range (so the pressure gap is the story). */
export function pressureOutsideObserved(targetKpa: number | null | undefined, range: readonly [number, number] | null | undefined): boolean {
  if (targetKpa === null || targetKpa === undefined || !range || targetKpa <= 0) return false;
  return Math.log(targetKpa / range[1]) > PRESSURE_WINDOW_LN || Math.log(targetKpa / range[0]) < -PRESSURE_WINDOW_LN;
}

/**
 * Scene 1 slice for the O2 x airflow plane: the group's observed pressure (geometric middle of its range), snapped to
 * the precomputed slice list when answers come from the snapshot. Null when the group has no pressure range.
 */
export function observedPressureSlice(range: readonly [number, number] | null | undefined, snap?: readonly number[] | null): number | null {
  if (!range || !(range[0] > 0) || !(range[1] > 0)) return null;
  const mid = Math.sqrt(range[0] * range[1]);
  if (!snap || snap.length === 0) return Math.round(mid * 10) / 10;
  let best = snap[0] as number;
  for (const v of snap) if (Math.abs(Math.log(v / mid)) < Math.abs(Math.log(best / mid))) best = v;
  return best;
}

/** "101.4 kPa" when both ends round to the same value, else "98.3–102.2 kPa". */
export function fmtPressureRange(range: readonly [number, number] | null | undefined): string {
  if (!range) return "—";
  const lo = fmtFixed(range[0], 1);
  const hi = fmtFixed(range[1], 1);
  return lo === hi ? `${lo} kPa` : `${lo}–${hi} kPa`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface SceneCaption {
  /** Short eyebrow above the caption. */
  title: string;
  /** The caption itself: one sentence of at most 14 words, set large. */
  caption: string;
  /** Up to three facts (all values come from the API responses). */
  facts: { label: string; value: string }[];
  /** Mandatory small print (binding framing), when the scene shows a candidate or a hypothetical update. */
  note?: string;
}

export interface CaptionInput {
  scene: number;
  group: GroupSummary | null;
  assess: AssessResponse | null;
  top: Candidate | null;
  rankStatus: "loading" | "ok" | "unavailable" | "none";
  counterfactual: CounterfactualResponse | null;
}

export function sceneCaption(i: CaptionInput): SceneCaption {
  const { scene, group, assess, top } = i;
  if (scene === 1) {
    return {
      title: "The evidence",
      caption: group ? "Each blue dot is a recorded flame test step aboard the ISS." : "Loading the integrated NASA records.",
      facts: group
        ? [
            { label: "Experiments", value: String(group.n_experiments) },
            { label: "Observations", value: String(group.n_observations) },
            { label: "Pressure tested", value: fmtPressureRange(group.pressure_kpa_range) },
          ]
        : [],
    };
  }
  if (scene === 2) {
    if (!assess) return { title: "Where crews will live", caption: "Placing the target cabin atmosphere on the map.", facts: [] };
    const t = assess.target;
    return {
      title: "Where crews will live",
      caption: `Target: ${t.label}.`,
      facts: [
        { label: "Oxygen", value: fmtOxygen(t.oxygen_percent.nominal ?? t.oxygen_percent.max ?? t.oxygen_percent.min) },
        { label: "Pressure", value: fmtPressure(t.total_pressure_kpa.nominal ?? t.total_pressure_kpa.max ?? t.total_pressure_kpa.min) },
        ...(group ? [{ label: "Tests ran at", value: fmtPressureRange(group.pressure_kpa_range) }] : []),
      ],
    };
  }
  if (scene === 3) {
    if (!assess) return { title: "The blind spot", caption: "Measuring how much evidence reaches the target.", facts: [] };
    const c = assess.coverage;
    const caption =
      assess.verdict === "supported"
        ? `${plural(c.comparable_observations, "comparable observation covers", "comparable observations cover")} this target.`
        : c.comparable_observations === 0
          ? "No comparable observation. The model says it does not know."
          : `Only ${plural(c.comparable_observations, "comparable observation", "comparable observations")}: estimates here lean on assumptions.`;
    return {
      title: "The blind spot",
      caption,
      facts: [
        { label: "Verdict", value: verdictLabel(assess.verdict) },
        { label: "Target points with nearby data", value: `${c.points_with_comparable} of ${c.n_target_points}` },
        ...(c.nn_distance_min !== null ? [{ label: "Nearest observation", value: `${fmtFixed(c.nn_distance_min, 1)} reference distances` }] : []),
      ],
    };
  }
  if (scene === 4) {
    if (i.rankStatus === "unavailable") {
      return { title: "What to learn next", caption: "Too few observations here to rank research candidates.", facts: [] };
    }
    if (!top) {
      return {
        title: "What to learn next",
        caption: i.rankStatus === "none" ? "No candidate adds information about this target." : "Ranking candidate conditions by what they would teach.",
        facts: [],
      };
    }
    return {
      title: "What to learn next",
      caption: `Active learning picks the most informative next experiment: candidate ${top.rank}.`,
      facts: [
        { label: "Oxygen", value: fmtOxygen(top.oxygen_percent) },
        { label: "Pressure", value: fmtPressure(top.pressure_kpa) },
        { label: "Airflow", value: fmtCmS(top.airflow_cm_s) },
        { label: "Expected uncertainty reduction", value: fmtFractionPercent(top.evr_fraction, 1) },
      ],
      note: CANDIDATE_FRAMING,
    };
  }
  if (scene === 5) {
    const cf = i.counterfactual;
    if (!top) return { title: "What it would change", caption: "No candidate is available to preview for this target.", facts: [] };
    const sc = cf?.scenarios ?? [];
    const fr = sc.map((s) => s.variance_reduction_fraction).filter((v) => Number.isFinite(v));
    const lo = fr.length ? Math.min(...fr) : null;
    const hi = fr.length ? Math.max(...fr) : null;
    const loS = lo === null ? null : fmtFractionPercent(lo, 0);
    const hiS = hi === null ? null : fmtFractionPercent(hi, 0);
    const span = loS === null || hiS === null ? null : loS === hiS ? loS : `${loS.replace(/\s*%$/, "")}–${hiS}`;
    return {
      title: "What it would change",
      caption: span ? `Either outcome would cut the model's target uncertainty by ${span}.` : "Previewing how the model would update under either outcome.",
      facts: sc.map((s) => ({
        label: s.outcome === "sustained" ? "If flame sustained" : "If flame not sustained",
        value: `−${fmtFractionPercent(s.variance_reduction_fraction, 1)}`,
      })),
      note: "Hypothetical model updates, not experimental results.",
    };
  }
  return { title: "", caption: "", facts: [] };
}

/** Word count used by the unit test (captions must stay at or under 14 words). */
export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
