/**
 * Plain-language names and rules for the Cabins page (/). One place for: the canonical cabin order, short names,
 * the coverage-status rule and the plain material names. Every number still comes from the API; this file only
 * holds words and one threshold rule.
 */

export type CabinRow = "now" | "past";

/** Canonical order of the cards. Envelope profiles (kind "envelope") are never cards. */
export const CABIN_ORDER: readonly string[] = [
  // Today and next
  "iss_cabin_nominal",
  "artemis_surface_habitat_10p2_26p5",
  "exploration_atmosphere_8p2_34",
  "orion_cm_lunar_design_10p2",
  "orion_cm_14p7_o2_limit",
  // Past spacecraft
  "shuttle_nominal",
  "shuttle_staged_pre_eva",
  "skylab",
  "apollo_cm",
  "iss_materials_worst_case",
  "eawg_2006_8p0_32",
];

export const DEFAULT_CABIN = "exploration_atmosphere_8p2_34";

const SHORT_NAMES: Record<string, string> = {
  iss_cabin_nominal: "ISS today",
  artemis_surface_habitat_10p2_26p5: "Artemis habitat",
  exploration_atmosphere_8p2_34: "Exploration Atmosphere",
  orion_cm_lunar_design_10p2: "Orion, Moon trips",
  orion_cm_14p7_o2_limit: "Orion, ISS pressure",
  shuttle_nominal: "Shuttle",
  shuttle_staged_pre_eva: "Shuttle, spacewalk prep",
  skylab: "Skylab",
  apollo_cm: "Apollo",
  iss_materials_worst_case: "ISS worst case",
  eawg_2006_8p0_32: "2006 proposal",
};

const PAST = new Set([
  "shuttle_nominal",
  "shuttle_staged_pre_eva",
  "skylab",
  "apollo_cm",
  "iss_materials_worst_case",
  "eawg_2006_8p0_32",
]);

export const CABIN_ROW_LABEL: Record<CabinRow, string> = { now: "Today and next", past: "Past spacecraft" };

/** Short plain name for a cabin; `fallback` (the API name) when the profile is not in the canonical list. */
export function shortCabinName(profileId: string, fallback: string): string {
  return SHORT_NAMES[profileId] ?? fallback;
}

/** Which row a profile sits in. Unknown profiles go to "now" (they are new, not history). */
export function cabinRow(profileId: string): CabinRow {
  return PAST.has(profileId) ? "past" : "now";
}

/** Position in CABIN_ORDER; unknown profiles sort after the known ones, keeping API order. */
export function cabinOrderIndex(profileId: string): number {
  const i = CABIN_ORDER.indexOf(profileId);
  return i === -1 ? CABIN_ORDER.length : i;
}

// ---- Coverage status (the one rule) ----------------------------------------------------------------

export type CoverageStatus = "none" | "barely" | "covered";

export interface CoverageCounts {
  comparable_observations: number;
  groups_with_comparable: number;
  n_groups: number;
}

/**
 * Share of materials that must have nearby results for a cabin to read "Covered". Not one half: many materials get
 * only one to five stray nearby results (ISS worst case: 28 results over 12 of 20 materials) while every per-material
 * answer for that cabin is "partly covered" or a blind spot. A green chip must never contradict the answer card.
 */
export const COVERED_MIN_SHARE = 0.9;

/**
 * none: no nearby ISS test result at all. barely: nearby results, but not for nearly all of the materials.
 * covered: nearby results for at least 90 % of the materials. "Nearby" = within the model's comparison distance
 * (see How it works).
 */
export function coverageStatus(c: CoverageCounts): CoverageStatus {
  if (c.comparable_observations === 0 || c.n_groups <= 0) return "none";
  return c.groups_with_comparable / c.n_groups < COVERED_MIN_SHARE ? "barely" : "covered";
}

export const COVERAGE_STATUS_LABEL: Record<CoverageStatus, string> = {
  none: "Not covered",
  barely: "Barely covered",
  covered: "Covered",
};

/** Board columns, left to right. */
export const STATUS_COLUMNS: readonly CoverageStatus[] = ["none", "barely", "covered"];

/** Status dot fills (always paired with the status word): black, amber, green. */
export const STATUS_DOT: Record<CoverageStatus, string> = {
  none: "bg-[#161616]",
  barely: "bg-[#E8A33B]",
  covered: "bg-[#2FD067]",
};

/** Tooltip for the chip: the rule, in plain words. */
export const COVERAGE_STATUS_HELP =
  "Covered: nearby ISS tests for nearly all materials. Barely covered: some. Not covered: none.";

/** "241 nearby tests" / "1 nearby test" / "No nearby tests". */
export function nearbyResultsText(n: number): string {
  if (n === 0) return "No nearby tests";
  return `${n.toLocaleString("en-US")} nearby ${n === 1 ? "test" : "tests"}`;
}

// ---- Materials -----------------------------------------------------------------------------------------

const MATERIAL_NAMES: Record<string, string> = {
  pmma_thin_film: "Thin acrylic film",
  pmma_sphere: "Acrylic sphere",
  pmma_rod: "Acrylic rod",
  pmma_slab: "Acrylic slab",
  sibal_fabric: "Cotton/fibreglass fabric",
  nomex_fabric: "Nomex fabric",
  wax_candle: "Wax candle",
  paraffin_slab: "Paraffin slab",
  ultem_sheet: "Ultem sheet",
};

const FLOW_NOTES: Record<string, string> = {
  opposed: "air against the flame",
  concurrent: "air with the flame",
  wake: "flame in the sample's wake",
  stagnation: "air straight at the sample",
  unknown: "setup unknown",
};

function splitGroup(groupId: string): { family: string; flow: string | null } {
  const [family, flow] = groupId.split("__");
  return { family: family ?? groupId, flow: flow ?? null };
}

/** Plain material name for an analysis group id, e.g. "pmma_thin_film__opposed" -> "Thin acrylic film". */
export function materialName(groupId: string, fallbackLabel: string): string {
  const { family } = splitGroup(groupId);
  return MATERIAL_NAMES[family] ?? stripFlow(fallbackLabel);
}

/** Plain flow wording for muted text, e.g. "air against the flame"; null when unknown to this table. */
export function materialFlowNote(groupId: string): string | null {
  const { flow } = splitGroup(groupId);
  return flow ? (FLOW_NOTES[flow] ?? null) : null;
}

/** Name plus flow wording on one line: "Thin acrylic film, air against the flame". */
export function materialFullName(groupId: string, fallbackLabel: string): string {
  const flow = materialFlowNote(groupId);
  const name = materialName(groupId, fallbackLabel);
  return flow ? `${name}, ${flow}` : name;
}

function stripFlow(label: string): string {
  return label.split(" · ")[0] ?? label;
}
