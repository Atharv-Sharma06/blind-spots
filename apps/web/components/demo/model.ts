/** Pure helpers for the guided demo (no React): scene definitions, data-driven target choice, captions. */
import { fmtCmS, fmtFractionPercent, fmtFixed, fmtOxygen, fmtPressure, verdictLabel } from "@/lib/format";
import type { AssessResponse, AtmosphereProfile, Candidate, CounterfactualResponse, GroupSummary } from "@/lib/types";

/** UI constant: autoplay duration of each of the five scenes (5 x 10 s = 50 s). */
export const SCENE_SECONDS = 10;
export const SCENE_COUNT = 5;
/** Scene index 6 is the end card. */
export const END_SCENE = SCENE_COUNT + 1;

export const SCENE_TITLES: Record<number, string> = {
  1: "We know where NASA has tested.",
  2: "But do we know enough about where crews may live?",
  3: "The missing evidence becomes visible.",
  4: "What should we learn next?",
  5: "Turn existing data into better research questions.",
};
export const END_TITLE = "Blind Spots — From experimental data to scientific discovery.";

/**
 * Documented profile with the fewest comparable observations for the current group. Profiles whose
 * assessment has not loaded yet are ignored; falls back to the first profile when none has loaded.
 */
export function pickDemoProfile(
  profiles: readonly AtmosphereProfile[],
  assessments: ReadonlyMap<string, AssessResponse>,
): string | null {
  const usable = profiles.filter((p) => p.kind !== "envelope");
  let best: { id: string; n: number } | null = null;
  for (const p of usable) {
    const a = assessments.get(p.profile_id);
    if (!a) continue;
    const n = a.coverage.comparable_observations;
    if (best === null || n < best.n) best = { id: p.profile_id, n };
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

/** Same honest phrasing as notRepresentedText, with long investigation lists shortened for the caption card. */
function gapText(names: readonly string[]): string {
  const short = names.map((n) => n.split(/ \(| : |: /)[0] as string);
  const shown = short.slice(0, 2).join("; ");
  const more = short.length > 2 ? ` and ${short.length - 2} more` : "";
  return short.length === 0
    ? "These conditions are not represented in the integrated records."
    : `These conditions are not represented in the integrated records. Documented NASA work not integrated here that may bear on them: ${shown}${more}.`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface SceneCaption {
  title: string;
  body: string;
  /** Short facts rendered as a definition list (all values come from the API responses). */
  facts: { label: string; value: string }[];
}

export interface CaptionInput {
  scene: number;
  group: GroupSummary | null;
  assess: AssessResponse | null;
  top: Candidate | null;
  rankStatus: "loading" | "ok" | "unavailable" | "none";
  counterfactual: CounterfactualResponse | null;
  /** Set when scenes 2-5 plot oxygen against pressure because the target pressure is outside the observed range. */
  pressureGap?: { target: number; lo: number; hi: number } | null;
}

function baseCaption(i: CaptionInput): SceneCaption {
  const { scene, group, assess, top } = i;
  if (scene === 1) {
    return {
      title: SCENE_TITLES[1] as string,
      body: group
        ? `Every dot is a measured outcome from NASA ISS combustion records, here for ${group.label}. Blue marks observed conditions only.`
        : "Loading the integrated NASA records.",
      facts: group
        ? [
            { label: "Experiments", value: String(group.n_experiments) },
            { label: "Observations", value: String(group.n_observations) },
            { label: "Training rows", value: `${group.n_training} (${group.label_counts.sustained} sustained, ${group.label_counts.not_sustained} not)` },
          ]
        : [],
    };
  }
  if (scene === 2) {
    if (!assess) return { title: SCENE_TITLES[2] as string, body: "Assessing the documented target atmosphere against the observations.", facts: [] };
    const c = assess.coverage;
    return {
      title: SCENE_TITLES[2] as string,
      body: `Target: ${assess.target.label} (dashed outline). ${plural(c.comparable_observations, "comparable integrated observation lies", "comparable integrated observations lie")} within one reference distance of its ${c.n_target_points} sampled conditions.`,
      facts: [
        { label: "Comparable observations", value: String(c.comparable_observations) },
        { label: "Target points with any", value: `${c.points_with_comparable} of ${c.n_target_points}` },
        { label: "Nearest distance (min)", value: fmtFixed(c.nn_distance_min, 2) },
      ],
    };
  }
  if (scene === 3) {
    if (!assess) return { title: SCENE_TITLES[3] as string, body: "Assessing coverage.", facts: [] };
    const c = assess.coverage;
    const names = assess.documented_context.map((d) => d.name);
    let title = SCENE_TITLES[3] as string;
    let body: string;
    if (assess.verdict === "supported") {
      title = "Here the integrated evidence supports the target.";
      body = `${plural(c.comparable_observations, "comparable observation", "comparable observations")} sit close to the target, so this model group is not a blind spot for it. The overlay still shows where evidence thins out elsewhere (amber: coverage gap; plum: model uncertainty).`;
    } else if (assess.verdict === "extrapolation") {
      body = `Verdict: extrapolation. ${plural(c.comparable_observations, "comparable observation", "comparable observations")}; estimates here depend on model assumptions. Amber marks coverage gaps, plum marks model uncertainty. ${gapText(names)}`;
    } else {
      body = `Verdict: insufficient evidence. ${plural(c.comparable_observations, "comparable observation", "comparable observations")} near the target. Amber marks coverage gaps, plum marks model uncertainty. ${gapText(names)}`;
    }
    return {
      title,
      body,
      facts: [
        { label: "Verdict", value: verdictLabel(assess.verdict) },
        { label: "Comparable observations", value: String(c.comparable_observations) },
        { label: "Inside observed region", value: c.fraction_inside_hull === null ? "—" : fmtFractionPercent(c.fraction_inside_hull) },
      ],
    };
  }
  if (scene === 4) {
    if (i.rankStatus === "unavailable") {
      return { title: SCENE_TITLES[4] as string, body: `${group?.label ?? "This group"} has too few training observations for a model, so no candidates can be ranked. The coverage map still shows where evidence is missing.`, facts: [] };
    }
    if (!top) {
      return {
        title: SCENE_TITLES[4] as string,
        body: i.rankStatus === "none" ? "No candidate in the analysis domain adds information about this target." : "Ranking candidate conditions by expected information about the target.",
        facts: [],
      };
    }
    return {
      title: SCENE_TITLES[4] as string,
      body: `Top-ranked computational research candidate: ${fmtOxygen(top.oxygen_percent)}, ${fmtPressure(top.pressure_kpa)}, ${fmtCmS(top.airflow_cm_s)}. Model-based expected reduction in uncertainty about the target: ${fmtFractionPercent(top.evr_fraction, 1)}. It requires qualified scientific review.`,
      facts: [
        { label: "Candidate", value: `#${top.rank}` },
        { label: "Expected uncertainty reduction", value: fmtFractionPercent(top.evr_fraction, 1) },
        { label: "Nearest observation", value: `${fmtFixed(top.nn_distance, 1)} ref. distances` },
      ],
    };
  }
  // scene 5
  const cf = i.counterfactual;
  return {
    title: SCENE_TITLES[5] as string,
    body: top
      ? `Counterfactual preview for the top candidate: how the model would update under each hypothetical outcome. These are model updates, not experimental results.`
      : "No candidate is available to preview for this group and target.",
    facts: cf ? [{ label: "Expected variance reduction", value: fmtFractionPercent(cf.expected_variance_reduction_fraction, 1) }] : [],
  };
}

const CONTEXT_NOTE =
  "Grey dashed boxes and triangles are documented tests (for example Saffire flights and drop-tower runs) that are not integrated into the model; they are shown for context only.";

export function sceneCaption(i: CaptionInput): SceneCaption {
  const c = baseCaption(i);
  if (i.scene < 2 || i.scene > SCENE_COUNT) return c;
  const extra: string[] = [];
  if (i.pressureGap) {
    const { target, lo, hi } = i.pressureGap;
    extra.push(`The map plots oxygen against pressure because the target (${fmtPressure(target)}) is outside the observed ${fmtFixed(lo, 1)} to ${fmtFixed(hi, 1)} kPa range of this group.`);
  }
  if (i.scene >= 3) extra.push(CONTEXT_NOTE);
  return extra.length ? { ...c, body: `${c.body} ${extra.join(" ")}` } : c;
}
