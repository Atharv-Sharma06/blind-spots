import type { ExtGroupValidation } from "./types";

/** Human-readable names for the model ids in the validation artifact. */
export const MODEL_LABEL: Record<string, string> = {
  gp: "GP classifier (Blind Spots)",
  logistic_o2_flow: "Logistic: O₂ + airflow",
  logistic_o2: "Logistic: O₂ only",
  majority_class: "Majority-class guess",
  bootstrap_logistic_ensemble: "Bootstrap logistic ensemble",
};
export const modelLabel = (id: string): string => MODEL_LABEL[id] ?? id.replace(/_/g, " ");

/** Selection strategies in the acquisition retrospective. */
export const STRATEGY_LABEL: Record<string, string> = {
  evr: "Blind Spots (target-aware)",
  uncertainty_sampling: "Uncertainty sampling",
  nearest_gap: "Nearest gap",
  random: "Random",
};

const VARIANT_WORDS: [RegExp, string][] = [
  [/drop below_calibration_range rows/i, "Drop flows below the calibrated range"],
  [/drop flow_off_transient rows/i, "Drop flow-turned-off steps"],
  [/drop no_sustained_propagation rows/i, "Drop brief flames that did not spread"],
  [/add low-confidence rows/i, "Add low-confidence rows"],
  [/O2 initial value only/i, "O₂: initial value only"],
];
export function variantLabel(v: string): string {
  for (const [re, label] of VARIANT_WORDS) if (re.test(v)) return label;
  const s = v.replace(/_/g, " ").replace(/\bO2\b/g, "O₂");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function subgroupLabel(v: string): string {
  if (/^confidence /i.test(v)) return `Curation confidence: ${v.replace(/^confidence /i, "")}`;
  const s = v.replace(/\bO2\b/g, "O₂");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function scenarioLabel(name: string): string {
  if (name === "lowest_o2_quartile") return "Lowest-O₂ quartile held out";
  if (name === "low_airflow_frontier") return "Lowest-airflow quartile held out";
  if (name.startsWith("campaign_holdout:")) return `Campaign ${name.slice("campaign_holdout:".length)} held out`;
  return name.replace(/_/g, " ");
}

export const ALPHA = 0.05;

/** The blind-spot test criteria exactly as in services/analysis/.../evaluation/blindspot_test.py (verdict_from). */
export function blindspotCriteria(g: ExtGroupValidation) {
  const b = g.blindspot_test;
  const pos = (rho: number | null | undefined, p: number | null | undefined) => typeof rho === "number" && rho > 0 && typeof p === "number" && p < ALPHA;
  const d = (b.diagnostics ?? {}) as { partial_rho_epistemic_given_aleatoric?: number | null; partial_p_value?: number | null };
  const partialKnown = typeof d.partial_p_value === "number";
  return {
    point: pos(b.point_level.spearman_rho, b.point_level.p_value),
    experiment: pos(b.group_level.spearman_rho, b.group_level.p_value),
    partial: partialKnown ? pos(d.partial_rho_epistemic_given_aleatoric, d.partial_p_value) : null,
    partialRho: d.partial_rho_epistemic_given_aleatoric ?? null,
    partialP: d.partial_p_value ?? null,
  };
}

/** Plain-language reason a blind-spot verdict is not "supported", derived from the numbers. */
export function blindspotShortfall(g: ExtGroupValidation): string | null {
  const b = g.blindspot_test;
  if (b.verdict === "supported") return null;
  if (b.verdict === "not_supported") return "uncertainty did not rise with error at either level";
  const c = blindspotCriteria(g);
  const miss: string[] = [];
  if (!c.point) miss.push("the point-level association is not significant");
  if (!c.experiment) miss.push("the held-out-experiment association is not significant");
  if (c.partial === false) miss.push("the association does not hold after controlling for outcome variability");
  return miss.length ? miss.join("; ") : null;
}

export const VERDICT_WORD: Record<string, string> = { supported: "Supported", inconclusive: "Inconclusive", not_supported: "Not supported" };
