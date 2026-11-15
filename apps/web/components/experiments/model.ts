/** Pure helpers for the experiment explorer: row derivation, filtering, sorting, plain-word glossaries. */
import type { ApiExperiment, GroupSummary } from "@/lib/types";
import { isNum, MISSING } from "@/lib/format";
import { loadSnapshotManifest, normalizeKey, snapshotFileUrl, snapshotKeyCandidates } from "@/lib/snapshot";

export const ALL = "all";

export type ResultKind = "burned" | "out" | "other";

/** The three filters on the page: free text, material (family) and result. */
export interface Filters {
  q: string;
  material: string;
  result: string; // all | burned | out | other
}

export const EMPTY_FILTERS: Filters = { q: "", material: ALL, result: ALL };

export type SortKey = "source" | "material" | "oxygen" | "pressure" | "airflow" | "result";

/** Last-resort plain words for a code we have no label for (never shows snake_case). */
export function humanize(s: string | null | undefined): string {
  if (!s) return MISSING;
  const t = s
    .replace(/_/g, " ")
    .replace(/\bpmma\b/gi, "PMMA")
    .replace(/\bsibal\b/gi, "SIBAL")
    .replace(/\bnasa\b/gi, "NASA")
    .replace(/\bntrs\b/gi, "NTRS")
    .replace(/\bn2\b/gi, "N₂")
    .replace(/\bco2\b/gi, "CO₂")
    .replace(/\bo2\b/gi, "O₂")
    .replace(/\btm (\d{8,})\b/gi, "TM-$1");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const MATERIAL_LABEL: Record<string, string> = {
  pmma_thin_film: "Thin acrylic film (PMMA)",
  pmma_slab: "Acrylic slab (PMMA)",
  pmma_rod: "Acrylic rod (PMMA)",
  pmma_sphere: "Acrylic sphere (PMMA)",
  sibal_fabric: "Cotton/fibreglass fabric (SIBAL)",
  nomex_fabric: "Nomex fabric",
  ultem_sheet: "Ultem sheet",
  wax_candle: "Wax candle",
  paraffin_slab: "Paraffin wax slab",
  other: "Other material",
};
export const materialLabel = (f: string | null | undefined): string => (f ? (MATERIAL_LABEL[f] ?? humanize(f)) : MISSING);

/** Plain wording for how air moved past the sample (muted text under the material name). */
const CONFIG_LABEL: Record<string, string> = {
  opposed: "air flowing against the flame",
  concurrent: "air flowing with the flame",
  stagnation: "air flowing straight at the sample",
  wake: "flame lit in the wake of the sample",
  mixed: "mixed airflow",
  unknown: "setup not recorded",
};
export const configurationLabel = (c: string | null | undefined): string => (c ? (CONFIG_LABEL[c] ?? humanize(c).toLowerCase()) : MISSING);

/** Final outcome codes assigned during curation (CONTRACTS 2.1 terminal_event) and printed context words. */
const OUTCOME_LABEL: Record<string, string> = {
  burnout: "Burned out",
  extinguished_low_flow: "Went out at low flow",
  blowoff: "Blown off",
  self_extinguished: "Went out by itself",
  flow_turned_off: "Flow turned off",
  n2_suppressed: "Suppressed with N₂",
  ignition_failed: "Did not ignite",
  brief_flame_only: "Brief flame only",
  test_aborted: "Test aborted",
  unknown: "Result not stated",
  extinguished: "Extinguished",
  burns: "Burns",
};
/** True for a curated outcome code; false for a free-text outcome sentence (Saffire radiometer records). */
export const isOutcomeCode = (o: string): boolean => o in OUTCOME_LABEL || /^[a-z0-9_]+$/.test(o);
export function outcomeLabel(o: string | null | undefined): string {
  const v = o ?? "unknown";
  if (OUTCOME_LABEL[v]) return OUTCOME_LABEL[v];
  return isOutcomeCode(v) ? humanize(v) : v.charAt(0).toUpperCase() + v.slice(1);
}
/** Short table form: free-text outcomes are cut at their first clause (full text in the drawer). */
export function outcomeShort(o: string | null | undefined): string {
  const full = outcomeLabel(o);
  if (isOutcomeCode(o ?? "unknown")) return full;
  const first = full.split(/[;,(]/)[0]!.trim();
  return first.length < full.length ? `${first}…` : full;
}
export const OUTCOME_DESCRIBED = "__described";
/** Filter bucket: free-text outcomes share one option. */
export const outcomeBucket = (o: string | null | undefined): string => {
  const v = o ?? "unknown";
  return isOutcomeCode(v) ? v : OUTCOME_DESCRIBED;
};


/**
 * Plain result of a test. "burned" = the flame kept burning (until the sample was used up), "out" = the flame went
 * out, "other" = no flame result to compare (did not ignite, stopped early, put out with nitrogen, not stated).
 * Built only from the recorded outcome code; nothing is inferred.
 */
export interface TestResult {
  kind: ResultKind;
  label: string;
  /** Muted second line, e.g. "when airflow dropped". */
  detail: string | null;
}
const RESULT: Record<string, TestResult> = {
  burnout: { kind: "burned", label: "Flame kept burning", detail: "until the sample was used up" },
  burns: { kind: "burned", label: "Flame kept burning", detail: null },
  extinguished_low_flow: { kind: "out", label: "Flame went out", detail: "when the airflow dropped" },
  blowoff: { kind: "out", label: "Flame went out", detail: "blown off by strong airflow" },
  self_extinguished: { kind: "out", label: "Flame went out", detail: "on its own" },
  extinguished: { kind: "out", label: "Flame went out", detail: null },
  flow_turned_off: { kind: "out", label: "Flame went out", detail: "after the airflow was switched off" },
  brief_flame_only: { kind: "out", label: "Flame went out", detail: "after a brief flame" },
  ignition_failed: { kind: "other", label: "Did not ignite", detail: null },
  n2_suppressed: { kind: "other", label: "Put out with nitrogen", detail: "not a flammability result" },
  test_aborted: { kind: "other", label: "Test stopped early", detail: null },
  unknown: { kind: "other", label: "Result not stated", detail: null },
};
export function resultOf(o: string | null | undefined): TestResult {
  const v = o ?? "unknown";
  const known = RESULT[v];
  if (known) return known;
  return isOutcomeCode(v)
    ? { kind: "other", label: humanize(v), detail: null }
    : { kind: "other", label: "Described in words", detail: "open it to read it" };
}
/** Result label of a test whose outcome is only given airflow step by airflow step. */
export const PER_STEP_LABEL = "Per airflow step";
/** Result of an experiment record: like resultOf, but says where to look when the test has airflow steps but no summary. */
export function resultOfExperiment(e: Pick<ApiExperiment, "observed_outcome" | "n_observations">): TestResult {
  const r = resultOf(e.observed_outcome);
  if ((e.observed_outcome ?? "unknown") === "unknown" && e.n_observations > 0) return { kind: "other", label: PER_STEP_LABEL, detail: "open it to see each step" };
  return r;
}
export const RESULT_FILTER_LABEL: Record<string, string> = {
  burned: "Flame kept burning",
  out: "Flame went out",
  steps: PER_STEP_LABEL,
  other: "Other or not stated",
};
/** Which Result-filter option an experiment belongs to: the filter's options match the chips one to one. */
export function resultFilterKey(e: Pick<ApiExperiment, "observed_outcome" | "n_observations">): "burned" | "out" | "steps" | "other" {
  const r = resultOfExperiment(e);
  return r.kind === "other" && r.label === PER_STEP_LABEL ? "steps" : r.kind;
}

/** "BASS-II · test O15b"; a label that already names the investigation stands alone. */
export const sourceLabel = (e: { investigation_acronym: string; test_label: string }): string =>
  e.test_label.startsWith(e.investigation_acronym) ? e.test_label : `${e.investigation_acronym} · test ${e.test_label}`;

const STATE_LABEL: Record<string, string> = {
  sustained: "Flame kept burning",
  extinguished: "Flame went out",
  brief_flame_no_sustain: "Brief flame, did not keep burning",
  not_ignited: "Did not ignite",
};
export const flameStateText = (s: string): string => STATE_LABEL[s] ?? humanize(s);
/** Marker kind for a flow step: kept burning (filled), went out (hollow), anything else (dash). */
export const flameStateKind = (s: string): ResultKind => (s === "sustained" ? "burned" : s === "extinguished" || s === "brief_flame_no_sustain" ? "out" : "other");

/** Trim trailing zeros: 21 -> "21", 101.325 -> "101.3", 0.35 -> "0.35" (digits = max decimals). */
export function fmtPlain(v: number | null | undefined, digits = 1): string {
  return isNum(v) ? String(Number(v.toFixed(digits))) : MISSING;
}

const EXTINCTION_LABEL: Record<string, string> = {
  quench_low_flow: "quenched at low flow",
  blowoff_high_flow: "blown off at high flow",
  at_constant_flow: "at constant flow",
  flow_turned_off: "after the flow was turned off",
  n2_suppression: "suppressed with N₂",
};
export const extinctionText = (m: string): string => EXTINCTION_LABEL[m] ?? humanize(m).toLowerCase();

const CONF_LABEL: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };
export const confidenceLabel = (c: string | null | undefined): string => (c ? (CONF_LABEL[c] ?? humanize(c)) : MISSING);

/** Context records (other apparatus or durations): shown, never modelled. */
export const isContextReason = (r: string | null | undefined): boolean => !!r && /context only/.test(r);

/** Row and drawer title: "BASS test 25"; a label that already names the investigation stands alone. */
export function experimentTitle(e: { investigation_acronym: string; test_label: string }): string {
  return e.test_label.startsWith(e.investigation_acronym) ? e.test_label : `${e.investigation_acronym} test ${e.test_label}`;
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
  if (isNum(lo) && isNum(hi) && lo !== hi) return `${fmtPlain(lo, 2)}–${fmtPlain(hi, 2)}`;
  return fmtPlain(lo ?? hi, 2);
}

export function groupLabel(groups: GroupSummary[] | undefined, id: string | null): string {
  if (!id) return "No analysis group";
  const g = groups?.find((x) => x.group_id === id);
  if (g) return g.label;
  const [fam, cfg] = id.split("__");
  return cfg ? `${materialLabel(fam)} · ${configurationLabel(cfg).toLowerCase()}` : humanize(id);
}

const CONTEXT_TEXT = "Context record from another apparatus or test duration: shown for reference, never used for modelling.";

export const EXCLUSION_TEXT: Record<string, string> = {
  no_curated_flow_steps: "No flow steps could be read from the source for this test, so there is nothing to train on.",
  low_confidence:
    "Its flow steps rest on low-confidence interpretation (for example a fan setting converted with a calibration measured in another campaign), so they are held out of training.",
  not_ignited: "The sample did not ignite, so there is no flame to sustain or lose.",
  n2_suppression: "The flame was put out with nitrogen, not by the airflow, so the step says nothing about flammability.",
  no_numeric_airflow: "The source gives no numeric airflow for this step, so it cannot be placed on the map.",
  provenance_mismatch: "The quoted source text could not be matched to the cited cell, so the step is held out.",
  no_material_family: "The material could not be classified, so the step has no analysis group.",
  no_oxygen: "No oxygen value is recorded for this step.",
  no_label: "The flame state at this step is not stated in the source.",
};

const EXCLUSION_SHORT: Record<string, string> = {
  no_curated_flow_steps: "no flow steps",
  low_confidence: "low conf.",
  not_ignited: "no ignition",
};

export function exclusionText(reason: string | null): string {
  if (!reason) return "";
  if (isContextReason(reason)) return CONTEXT_TEXT;
  return EXCLUSION_TEXT[reason] ?? humanize(reason);
}

export function exclusionShort(reason: string | null): string {
  if (!reason) return "";
  if (isContextReason(reason)) return "context";
  return EXCLUSION_SHORT[reason] ?? humanize(reason).toLowerCase();
}

export const FLAG_TEXT: Record<string, string> = {
  pressure_assumed: "Total pressure was not recorded; the documented ISS cabin nominal is used as an assumption and kept in a separate field.",
  co2_percent_from_mmhg_formula: "CO₂ % was computed from a partial pressure in mmHg with a documented formula.",
  test_confidence_low: "The interpretation of this test's free-text record is low confidence.",
  o2_anomaly: "The recorded oxygen values look like a sensor glitch (for example an implausible final value).",
  o2_out_of_range: "An oxygen reading is outside the plausible range.",
  o2_initial_out_of_range: "The initial oxygen reading is outside the plausible range.",
  o2_final_out_of_range: "The final oxygen reading is outside the plausible range.",
  o2_initial_only: "Only an initial oxygen value is recorded; it is used for every step.",
  o2_interpolated: "Oxygen at this step is interpolated between the initial and final readings.",
  co_initial_out_of_range: "The initial CO reading is outside the sensor's documented range.",
  co_final_over_range: "The final CO reading is above the sensor's range.",
  co_initial_over_range: "The initial CO reading is above the sensor's range.",
  co_final_unparsed: "The final CO cell could not be read as a number.",
  over_range: "A reading is above the sensor's documented range.",
  date_parsed_from_text: "The test date was read from free text.",
  date_year_mismatch: "The date's year disagrees with the campaign year.",
  date_year_implausible: "The date's year is implausible for this campaign.",
  campaign_year_from_gmt_text: "The campaign year was taken from a GMT text cell.",
  test_date_from_notes: "The test date was taken from the notes column.",
  duplicate_as_run_number: "The as-run test number repeats in the source; the label carries a suffix to stay unique.",
  possible_duplicate: "This may duplicate another row in the source.",
  context_only: CONTEXT_TEXT,
  context_record: CONTEXT_TEXT,
  notes_from_nasa_tm_20210011385:
    "Notes are quoted from NASA/TM-20210011385 Appendix A (the PSI-25 workbook has no observation column).",
  outcome_evidence_nasa_tm_20210011385: "Flame state confirmed by NASA/TM-20210011385 Appendix A.",
  calibration_borrowed_from_bass2: "Fan or pot setting converted with the BASS-II (2014) calibration, not one measured in this campaign.",
  calibration_nearest_day: "Converted with the calibration from the nearest calibration day.",
  calibration_day_gap_over_30_days: "The nearest calibration day is more than 30 days away.",
  calibration_same_day_not_covering_value: "The same-day calibration does not reach this setting; another day was used.",
  below_calibration_range: "The setting is below the lowest calibrated point.",
  calibration_block_suspect_duplicate: "Calibration day skipped: its section duplicates another restrictor section.",
  flow_interpolated_to_fan_off: "Airflow interpolated between fan-off (zero flow) and the lowest calibrated point.",
  air_factor_from_bass2_note: "Duct air reading converted with the BASS-II note U = 1.0066 × AIR.",
  flow_off_transient: "The flame went out after the flow was switched off (label 0 at near-zero flow).",
  no_sustained_propagation: "A flame appeared but did not keep spreading after the igniter stopped.",
  flow_approximate: "The source gives the airflow as approximate (~).",
  flow_upper_bound: "The source gives the airflow as an upper bound (<).",
  no_restrictor_for_calibration: "The number of flow restrictors is not recorded; a default was used for calibration.",
};

export function flagText(flag: string): string {
  return FLAG_TEXT[flag] ?? humanize(flag);
}

export const BASIS_TEXT: Record<string, string> = {
  air_display: "duct air reading",
  fan_calibration: "fan display, via calibration",
  pot_calibration: "control-pot setting, via calibration",
  stated_cm_s: "stated in the source",
  none: "no airflow recorded",
};

const RAW_UNIT_TEXT: Record<string, string> = { air_cm_s: "cm/s air reading", fan_display: "fan display", pot: "pot setting", none: "" };
/** "recorded 2.75 pot setting" */
export function rawFlowText(value: string | null, unit: string): string {
  if (!value) return "";
  const u = RAW_UNIT_TEXT[unit] ?? humanize(unit).toLowerCase();
  return u ? `recorded ${value} (${u})` : `recorded ${value}`;
}

/** "2014-190/2 restrictors" -> "calibration of GMT 2014-190, 2 restrictors". */
export function calibrationText(ref: string | null): string {
  if (!ref) return "";
  const m = /^(\d{4}-\d{3})\/(\d+) restrictors?$/.exec(ref);
  if (!m) return ref;
  return `calibration of GMT ${m[1]}, ${m[2]} restrictor${m[2] === "1" ? "" : "s"}`;
}

/** Curation-pipeline wording with file/field names, rewritten in plain words (same meaning). */
export function plainDefinition(s: string | null | undefined): string | null {
  if (!s) return null;
  if (/^terminal_event assigned during curation/.test(s)) return "Final outcome of the test, assigned during curation from the source's observation notes.";
  return s.replace(/ \(notes_raw\)/g, "");
}

/** Printed page of the NASA/TM-20210011385 Appendix A quote, from the measurement-method sentence. */
export function tmPage(method: string | null | undefined): string | null {
  const m = /NASA\/TM-20210011385 Appendix A \(printed p\.(\d+)\)/.exec(method ?? "");
  return m ? m[1]! : null;
}

export function applyFilters(rows: ApiExperiment[], f: Filters): ApiExperiment[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((e) => {
    if (f.material !== ALL && (e.material_family ?? "") !== f.material) return false;
    if (f.result !== ALL && resultFilterKey(e) !== f.result) return false;
    if (q) {
      const hay = [
        e.test_label,
        e.experiment_id,
        e.material_type,
        materialLabel(e.material_family),
        e.notes_raw,
        e.investigation_acronym,
        e.investigation_name,
        e.sample_id,
        resultOf(e.observed_outcome).label,
      ]
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
    case "source":
      return `${e.investigation_acronym} ${e.test_label}`;
    case "material":
      return `${materialLabel(e.material_family)} ${e.flame_configuration}`;
    case "oxygen":
      return oxygenOf(e);
    case "pressure":
      return pressureOf(e).kpa;
    case "airflow":
      return airflowOf(e).lo;
    case "result":
      return `${resultOf(e.observed_outcome).label} ${resultOf(e.observed_outcome).detail ?? ""}`;
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

/**
 * Snapshot CSV link from the manifest alone (no download of the 310 KB file just to build a link).
 * null when the snapshot has no file for these filters.
 */
export async function snapshotCsvHref(query: { investigation?: string; group?: string }): Promise<string | null> {
  try {
    const manifest = await loadSnapshotManifest();
    const norm = new Map(Object.keys(manifest.entries).map((k) => [normalizeKey(k), k]));
    for (const cand of snapshotKeyCandidates("GET", "/api/export/experiments.csv", query)) {
      const key = cand in manifest.entries ? cand : norm.get(normalizeKey(cand));
      const file = key ? manifest.entries[key] : undefined;
      if (typeof file === "string") return snapshotFileUrl(file);
    }
  } catch {
    // no snapshot deployed
  }
  return null;
}
