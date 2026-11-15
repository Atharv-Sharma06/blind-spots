/** Pure helpers for the experiment explorer: row derivation, filtering, sorting, plain-word glossaries. */
import type { ApiExperiment, GroupSummary } from "@/lib/types";
import { fmtFixed, isNum, MISSING } from "@/lib/format";

export const ALL = "all";

export interface Filters {
  q: string;
  investigation: string;
  platform: string;
  group: string;
  outcome: string;
  training: string; // all | included | excluded
  confidence: string;
}

export const EMPTY_FILTERS: Filters = {
  q: "",
  investigation: ALL,
  platform: ALL,
  group: ALL,
  outcome: ALL,
  training: ALL,
  confidence: ALL,
};

export type SortKey =
  | "experiment"
  | "material"
  | "configuration"
  | "oxygen"
  | "pressure"
  | "airflow"
  | "outcome"
  | "steps"
  | "quality"
  | "training";

export function humanize(s: string | null | undefined): string {
  if (!s) return MISSING;
  const t = s.replace(/_/g, " ").replace(/\bpmma\b/gi, "PMMA");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function oxygenOf(e: ApiExperiment): number | null {
  return e.oxygen_percent_initial ?? e.oxygen_percent;
}

export function pressureOf(e: ApiExperiment): { kpa: number | null; assumed: boolean } {
  if (isNum(e.total_pressure_kpa)) return { kpa: e.total_pressure_kpa, assumed: false };
  if (isNum(e.pressure_assumed_kpa)) return { kpa: e.pressure_assumed_kpa, assumed: true };
  return { kpa: null, assumed: false };
}

export function airflowOf(e: ApiExperiment): { lo: number | null; hi: number | null } {
  if (isNum(e.airflow_min_cm_s) || isNum(e.airflow_max_cm_s)) return { lo: e.airflow_min_cm_s, hi: e.airflow_max_cm_s };
  if (isNum(e.airflow_cm_s)) return { lo: e.airflow_cm_s, hi: e.airflow_cm_s };
  return { lo: null, hi: null };
}

export function fmtAirflow(e: ApiExperiment): string {
  const { lo, hi } = airflowOf(e);
  if (!isNum(lo) && !isNum(hi)) return MISSING;
  if (isNum(lo) && isNum(hi)) return lo === hi ? fmtFixed(lo, 1) : `${fmtFixed(lo, 1)}–${fmtFixed(hi, 1)}`;
  return fmtFixed(lo ?? hi, 1);
}

export function groupLabel(groups: GroupSummary[] | undefined, id: string | null): string {
  if (!id) return "No analysis group";
  return groups?.find((g) => g.group_id === id)?.label ?? humanize(id);
}

export const EXCLUSION_TEXT: Record<string, string> = {
  no_curated_flow_steps: "No flow steps have been curated for this test, so there is no observation to train on.",
  low_confidence: "The interpretation of the source text is low confidence, so it is held out of training.",
  not_ignited: "The sample did not ignite, so there is no flame to sustain or lose.",
  "different apparatus and scale: context only": "A different apparatus and scale (context record); shown for reference and never used for modelling.",
};

export function exclusionText(reason: string | null): string {
  if (!reason) return "";
  return EXCLUSION_TEXT[reason] ?? humanize(reason);
}

export const FLAG_TEXT: Record<string, string> = {
  pressure_assumed: "Total pressure was not recorded; the documented ISS cabin nominal is used as an assumption and kept in a separate field.",
  co2_percent_from_mmhg_formula: "CO2 percent was computed from a partial pressure in mmHg using a documented formula.",
  test_confidence_low: "The interpretation of this test's free-text record is low confidence.",
  o2_anomaly: "The recorded oxygen values look like a sensor glitch (for example an implausible final value).",
  co_initial_out_of_range: "The initial CO reading is outside the sensor's documented range.",
  co_final_over_range: "The final CO reading is above the sensor's range.",
  co_initial_over_range: "The initial CO reading is above the sensor's range.",
  co_final_unparsed: "The final CO cell could not be parsed as a number.",
  over_range: "A reading is above the sensor's documented range.",
  date_parsed_from_text: "The test date was parsed from free text.",
  date_year_mismatch: "The date's year disagrees with the campaign year.",
  date_year_implausible: "The date's year is implausible for this campaign.",
  campaign_year_from_gmt_text: "The campaign year was taken from a GMT text cell.",
  test_date_from_notes: "The test date was taken from the notes column.",
  duplicate_as_run_number: "The as-run test number repeats in the source; the label carries a suffix to stay unique.",
  possible_duplicate: "This may duplicate another row in the source.",
  context_only: "Context record from a different apparatus and scale; never used for modelling.",
  o2_final_out_of_range: "The final oxygen reading is outside the plausible range.",
  o2_initial_only: "Only an initial oxygen value is recorded for this step.",
};

export function flagText(flag: string): string {
  return FLAG_TEXT[flag] ?? humanize(flag);
}

export const BASIS_TEXT: Record<string, string> = {
  air_display: "duct air display",
  fan_calibration: "fan display via calibration",
  pot_calibration: "control pot via calibration",
  stated_cm_s: "stated in the source",
  none: "no airflow recorded",
};

const CONF_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

export function applyFilters(rows: ApiExperiment[], f: Filters): ApiExperiment[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((e) => {
    if (f.investigation !== ALL && e.investigation_id !== f.investigation) return false;
    if (f.platform !== ALL && e.experimental_platform !== f.platform) return false;
    if (f.group !== ALL && e.group_id !== f.group) return false;
    if (f.outcome !== ALL && (e.observed_outcome ?? "unknown") !== f.outcome) return false;
    if (f.training === "included" && !e.included_in_training) return false;
    if (f.training === "excluded" && e.included_in_training) return false;
    if (f.confidence !== ALL && e.extraction_confidence !== f.confidence) return false;
    if (q) {
      const hay = [e.test_label, e.experiment_id, e.material_type, e.material_family, e.notes_raw, e.investigation_acronym, e.sample_id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function naturalCmp(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function sortValue(e: ApiExperiment, key: SortKey): number | string | null {
  switch (key) {
    case "experiment":
      return `${e.investigation_acronym} ${e.test_label}`;
    case "material":
      return `${e.material_family ?? ""} ${e.group_id ?? ""}`;
    case "configuration":
      return e.flame_configuration;
    case "oxygen":
      return oxygenOf(e);
    case "pressure":
      return pressureOf(e).kpa;
    case "airflow":
      return airflowOf(e).lo;
    case "outcome":
      return e.observed_outcome ?? "unknown";
    case "steps":
      return e.n_observations;
    case "quality":
      return (CONF_RANK[e.extraction_confidence] ?? 0) * 100 - e.quality_flags.length;
    case "training":
      return e.included_in_training ? 1 : 0;
  }
}

export function sortRows(rows: ApiExperiment[], key: SortKey, dir: "asc" | "desc"): ApiExperiment[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    if (va === null && vb === null) return 0;
    if (va === null) return 1; // missing values last regardless of direction
    if (vb === null) return -1;
    const c = typeof va === "number" && typeof vb === "number" ? va - vb : naturalCmp(String(va), String(vb));
    return c * sign || naturalCmp(a.experiment_id, b.experiment_id);
  });
}

export function uniqueSorted(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort(naturalCmp);
}

export function activeFilterCount(f: Filters): number {
  return (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).filter((k) => f[k] !== EMPTY_FILTERS[k]).length;
}
