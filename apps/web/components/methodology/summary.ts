import type { ExtGroupValidation, ExtValidation } from "./types";

/**
 * Pure helpers that turn the validation artifact into the few counts the plain-language parts of the page show
 * ("6 of 9 ..."). Nothing here invents a number: every value is a count over the API's own fields.
 */

export type VsMajority = "better" | "worse" | "same" | "unknown";

/** GP versus a majority-class guess on log loss: decided by the 95 % interval of the difference. */
export function vsMajority(g: ExtGroupValidation): VsMajority {
  const c = g.cv.gp_vs_majority?.log_loss?.ci95;
  if (!c) return "unknown";
  if (c[1] < 0) return "better";
  if (c[0] > 0) return "worse";
  return "same";
}

export const modelOf = (g: ExtGroupValidation, id: string) => g.cv.models.find((m) => m.name === id);

/** Per-group tally of the retrospective replays: target-aware ranking versus random picking. */
export function retroVsRandom(v: ExtValidation, gid: string) {
  const out = { better: 0, same: 0, worse: 0, n: 0 };
  for (const s of v.acquisition_retrospective.scenarios) {
    if (s.group_id !== gid) continue;
    const c = s.paired_differences?.evr_minus_random?.ci95;
    if (!c) continue;
    out.n += 1;
    if (c[1] < 0) out.better += 1;
    else if (c[0] > 0) out.worse += 1;
    else out.same += 1;
  }
  return out;
}

export type RetroCounts = { better: number; indistinguishable: number; worse: number };
export interface RetroSummary {
  n_scenarios: number;
  evr_vs_random?: RetroCounts;
  evr_vs_nearest_gap?: RetroCounts;
}

/** The API's own roll-up of the retrospective replays (absent when the artifact predates it). */
export function retroSummary(v: ExtValidation): RetroSummary | undefined {
  return (v.acquisition_retrospective as { summary?: RetroSummary }).summary;
}

/** Counts shown in the four-step summary and in "Can you trust it?". */
export function validationCounts(v: ExtValidation) {
  const gs = v.groups;
  const better = gs.filter((g) => vsMajority(g) === "better").length;
  const worse = gs.filter((g) => vsMajority(g) === "worse").length;
  const blindspotSupported = gs.filter((g) => g.blindspot_test.verdict === "supported").length;
  const summary = retroSummary(v);
  return { nGroups: gs.length, better, worse, blindspotSupported, summary };
}
