// Pure helpers for the "Model check" (GP vs simple baselines), read from GET /api/model/validation.
// No imports so node --test can load this file directly (see tests/unit/model-check.test.mjs).
//
// Rule (docs/decisions.md, F5): the GP is "clearly better" than a baseline only when the upper end of the GP's
// cross-validated Brier 95 % interval is below the baseline's Brier value. Otherwise it is "not clearly better".
// This check never decides when the model abstains (that is insufficient data or no comparable tests nearby).

export interface MetricCi {
  value: number | null;
  ci95: [number, number] | null;
}

export interface ModelMetricsLike {
  name: string;
  brier: MetricCi;
}

export interface ValidationGroupLike {
  group_id: string;
  label?: string;
  n_experiments: number;
  n_observations: number;
  cv: { models: ModelMetricsLike[] };
  label_counts?: { sustained: number; not_sustained: number } | null;
  small_sample_warning?: string | null;
}

export type CheckVerdict = "clearly_better" | "not_clearly_better" | "unknown";

export interface ModelCheckRow {
  groupId: string;
  label: string | null;
  nExperiments: number;
  nObservations: number;
  gpBrier: number | null;
  gpCi: [number, number] | null;
  majorityBrier: number | null;
  /** The usual outcome in this material's tests, in plain words; null if counts are missing or tied. */
  majorityLabel: "kept burning" | "went out" | null;
  vsGuess: CheckVerdict;
  curveBrier: number | null;
  vsCurve: CheckVerdict;
  smallSample: string | null;
}

export const RULE_TEXT =
  "The model counts as clearly better only when the top of its 95% range of error is below the other method's error. Otherwise we say it is not clearly better.";

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** GP vs one baseline: "clearly_better" only if GP Brier ci95 upper < baseline Brier value. */
export function compareBrier(gp: MetricCi | null | undefined, baseline: MetricCi | null | undefined): CheckVerdict {
  const upper = gp?.ci95?.[1];
  const base = baseline?.value;
  if (!isNum(upper) || !isNum(base)) return "unknown";
  return upper < base ? "clearly_better" : "not_clearly_better";
}

function model(group: ValidationGroupLike, name: string): ModelMetricsLike | undefined {
  return group.cv?.models?.find((m) => m.name === name);
}

export function majorityLabel(counts: ValidationGroupLike["label_counts"]): ModelCheckRow["majorityLabel"] {
  if (!counts || !isNum(counts.sustained) || !isNum(counts.not_sustained)) return null;
  if (counts.sustained === counts.not_sustained) return null;
  return counts.sustained > counts.not_sustained ? "kept burning" : "went out";
}

export function modelCheck(group: ValidationGroupLike): ModelCheckRow {
  const gp = model(group, "gp");
  const majority = model(group, "majority_class");
  const curve = model(group, "logistic_o2_flow");
  return {
    groupId: group.group_id,
    label: group.label ?? null,
    nExperiments: group.n_experiments,
    nObservations: group.n_observations,
    gpBrier: isNum(gp?.brier?.value) ? gp.brier.value : null,
    gpCi: gp?.brier?.ci95 ?? null,
    majorityBrier: isNum(majority?.brier?.value) ? majority.brier.value : null,
    majorityLabel: majorityLabel(group.label_counts),
    vsGuess: compareBrier(gp?.brier, majority?.brier),
    curveBrier: isNum(curve?.brier?.value) ? curve.brier.value : null,
    vsCurve: compareBrier(gp?.brier, curve?.brier),
    smallSample: group.small_sample_warning ?? null,
  };
}

export function modelChecks(groups: readonly ValidationGroupLike[] | null | undefined): ModelCheckRow[] {
  return (groups ?? []).map(modelCheck);
}

/** Brier score shown with 3 decimals; missing stays "not recorded". */
export function fmtBrier(x: number | null | undefined): string {
  return isNum(x) ? x.toFixed(3) : "not recorded";
}

export function fmtCi(ci: [number, number] | null | undefined): string {
  return ci && isNum(ci[0]) && isNum(ci[1]) ? `${ci[0].toFixed(3)} to ${ci[1].toFixed(3)}` : "not recorded";
}

export function verdictWords(v: CheckVerdict, against: "guess" | "curve"): string {
  const what = against === "guess" ? "always guessing the usual outcome" : "a simple oxygen-and-airflow curve";
  if (v === "clearly_better") return `Clearly better than ${what}`;
  if (v === "not_clearly_better") return `Not clearly better than ${what}`;
  return `No check available against ${what}`;
}

export function guessLabel(row: Pick<ModelCheckRow, "majorityLabel">): string {
  return row.majorityLabel ? `Always guess “${row.majorityLabel}”` : "Always guess the usual outcome";
}

/** "k of n materials" where the model is not clearly better than always guessing. */
export function notClearlyCount(rows: readonly ModelCheckRow[]): { k: number; n: number } {
  const known = rows.filter((r) => r.vsGuess !== "unknown");
  return { k: known.filter((r) => r.vsGuess === "not_clearly_better").length, n: known.length };
}
