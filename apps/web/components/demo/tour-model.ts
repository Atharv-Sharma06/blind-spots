/**
 * Pure helpers for the 30-second tour of the Cabins page ("/"): timing, scene script and short captions.
 * No React and no runtime imports (the unit test runs this file with node). Every number in a caption comes from
 * the API responses handed in; nothing is invented. Words follow the plain-language rules in the redesign spec:
 * "test results", "nearby", "uncertainty", never group / slice / plane / layer / latent / reference distance.
 */
import type { AssessResponse, Candidate, CounterfactualResponse } from "@/lib/types";

// ---- Timing -----------------------------------------------------------------------------------------------
// About 3 s title card, five scenes (scene 3 has two beats), a short end card: about 28 s, under the 30 s limit.

export const TITLE_SECONDS = 2.5;
export const END_SECONDS = 3.5;

export type SceneId = "iss" | "pick" | "answer" | "next" | "what-if";

export interface Beat {
  /** `data-tour` id of the section to scroll into view. */
  scroll: string;
  /** What gets the highlight ring: a `data-tour` id, or a cabin card (`cabin:iss` / `cabin:blind`). */
  ring: string;
  seconds: number;
}

export interface SceneScript {
  id: SceneId;
  /** Eyebrow label above the caption. */
  title: string;
  beats: readonly Beat[];
}

export const SCENES: readonly SceneScript[] = [
  { id: "iss", title: "Today's cabin", beats: [{ scroll: "cabins", ring: "cabin:iss", seconds: 4 }] },
  { id: "pick", title: "Pick a cabin", beats: [{ scroll: "cabins", ring: "cabin:blind", seconds: 4 }] },
  {
    id: "answer",
    title: "The answer",
    beats: [
      { scroll: "answer", ring: "answer", seconds: 3 },
      { scroll: "chart", ring: "chart", seconds: 3 },
    ],
  },
  { id: "next", title: "What to test next", beats: [{ scroll: "next", ring: "next", seconds: 4.5 }] },
  { id: "what-if", title: "What would we learn?", beats: [{ scroll: "what-if", ring: "what-if", seconds: 4.5 }] },
] as const;

export const SCENE_COUNT = SCENES.length;
/** Scene numbers are 1-based; the end card is the scene after the last one. */
export const END_SCENE = SCENE_COUNT + 1;

export const sceneSeconds = (s: SceneScript): number => s.beats.reduce((t, b) => t + b.seconds, 0);

/** Total running time of the title card, the scenes and the end card (what the recorder has to fit under 30 s). */
export const TOTAL_SECONDS = TITLE_SECONDS + SCENES.reduce((t, s) => t + sceneSeconds(s), 0) + END_SECONDS;

// ---- Fixed words ------------------------------------------------------------------------------------------

export const TITLE_LINE = "Do NASA's space-station fire tests cover this cabin's air?";
export const TITLE_SUBLINE = "30-second tour";
export const END_NAME = "Blind Spots";
export const END_LINE = "Where NASA's ISS fire-test records end, and what to learn next.";
export const HYPOTHETICAL_NOTE = "Hypothetical model updates, not experimental results.";

/** The cabins the tour walks through (profile ids from the API). */
export const TOUR_ISS_CABIN = "iss_cabin_nominal";
export const TOUR_BLIND_CABIN = "exploration_atmosphere_8p2_34";

// ---- Number helpers ---------------------------------------------------------------------------------------

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const MINUS = "−";

/** 34 -> "34", 56.537 -> "56.5" (one decimal at most, no trailing ".0"). */
export function trim1(v: number): string {
  const s = v.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** "98.3–102.2 kPa", or one value when both ends round alike; "" when there is no range. */
export function kpaRange(range: readonly [number, number] | null | undefined): string {
  if (!range) return "";
  const lo = trim1(range[0]);
  const hi = trim1(range[1]);
  return lo === hi ? `${lo} kPa` : `${lo}–${hi} kPa`;
}

/** Whole-kPa range as the answer card prints it: "98–102 kPa", or one value ("101 kPa") when both ends round alike. */
export function kpaWhole(range: readonly [number, number] | null | undefined): string {
  if (!range) return "";
  const lo = Math.round(range[0]);
  const hi = Math.round(range[1]);
  return lo === hi ? `${lo} kPa` : `${lo}–${hi} kPa`;
}

/** "18–21 %" from fractions of 0..1 (one value when both round alike); null when there are none. */
export function percentSpan(fractions: readonly number[]): string | null {
  const f = fractions.filter(isNum);
  if (f.length === 0) return null;
  const lo = Math.round(Math.min(...f) * 100);
  const hi = Math.round(Math.max(...f) * 100);
  return lo === hi ? `${lo} %` : `${lo}–${hi} %`;
}

/** Pressure and oxygen of a cabin in the words used on the page: "34 % oxygen, 56.5 kPa". */
export function airText(oxygenPercent: number | null | undefined, pressureKpa: number | null | undefined): string {
  const parts: string[] = [];
  if (isNum(oxygenPercent)) parts.push(`${trim1(oxygenPercent)} % oxygen`);
  if (isNum(pressureKpa)) parts.push(`${trim1(pressureKpa)} kPa`);
  return parts.join(", ");
}

/** Number of words in a string (captions must stay at 14 words or fewer). */
export const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;
export const CAPTION_MAX_WORDS = 14;

// ---- Captions ---------------------------------------------------------------------------------------------

export interface TourFact {
  label: string;
  value: string;
}

export interface SceneCaption {
  /** Short eyebrow above the caption. */
  title: string;
  /** The caption: one sentence of at most 14 words, set large. */
  caption: string;
  /** At most three facts, every value from the API. */
  facts: TourFact[];
  /** Which mandatory small print to show (binding framing) when a candidate or a hypothetical update is on screen. */
  notes: ("candidate_framing" | "hypothetical")[];
  /** True while the data this scene needs has not arrived (the player waits a moment before moving on). */
  waiting: boolean;
}

export interface CaptionInput {
  scene: SceneId;
  /** 0-based beat inside the scene (only the answer scene has two). */
  beat: number;
  /** ISS cabin row from GET /api/headline. */
  iss: { comparable_observations: number; groups_with_comparable: number; n_groups: number } | null;
  /** Coverage chip of the ISS cabin, from the page's own rule (cabins.ts); when absent it is derived from the count alone. */
  issStatus?: "none" | "barely" | "covered" | null;
  /** The cabin the tour picks in scene 2 (its short name, air and coverage chip label come from the page's own helpers). */
  cabin: { name: string; oxygen_percent: number; total_pressure_kpa: number; statusLabel: string } | null;
  /** Plain name of the material the answer is for. */
  materialName: string | null;
  /** The ISS tests' pressure range for that material (kPa). */
  testedKpa: readonly [number, number] | null;
  /** Whether that pressure was recorded (GroupSummary.pressure_measured). false = assumed by the dataset; null = unknown. */
  testedKpaMeasured?: boolean | null;
  assess: AssessResponse | null;
  rankStatus: "loading" | "ok" | "unavailable" | "none";
  top: Candidate | null;
  counterfactual: CounterfactualResponse | null;
}

function verdictCaption(a: AssessResponse | null): string {
  if (!a) return "Checking whether ISS tests cover this cabin's air.";
  if (a.verdict === "insufficient_evidence") return "Blind spot: no ISS test in our data ran in air like this.";
  if (a.verdict === "extrapolation") return "Partly covered: only part of this air has nearby ISS tests.";
  return "Covered: ISS flame tests ran in air like this.";
}

export function sceneCaption(i: CaptionInput): SceneCaption {
  const script = SCENES.find((s) => s.id === i.scene);
  const title = script?.title ?? "";
  const base = { title, facts: [] as TourFact[], notes: [] as SceneCaption["notes"], waiting: false };

  if (i.scene === "iss") {
    const iss = i.iss;
    if (!iss) return { ...base, caption: "ISS flame tests cover the station's own air.", waiting: true };
    const status = i.issStatus ?? (iss.comparable_observations > 0 ? "covered" : "none");
    const caption =
      status === "covered"
        ? "ISS flame tests cover the station's own air."
        : status === "barely"
          ? "ISS flame tests only partly cover the station's own air."
          : "ISS flame tests do not reach even the station's own air.";
    // One fact only: the count of nearby results. "Materials with nearby results" would overstate breadth (many of
    // those have only a handful of results), so it stays on the Cabins page where it is explained.
    return { ...base, caption, facts: [{ label: "Nearby ISS test results", value: iss.comparable_observations.toLocaleString("en-US") }] };
  }

  if (i.scene === "pick") {
    const c = i.cabin;
    if (!c) return { ...base, caption: "Now pick a Moon or Mars cabin.", waiting: true };
    return {
      ...base,
      caption: `Now pick a cabin: ${c.name}.`,
      facts: [
        { label: "Oxygen", value: `${trim1(c.oxygen_percent)} %` },
        { label: "Pressure", value: `${trim1(c.total_pressure_kpa)} kPa` },
        { label: "ISS test coverage", value: c.statusLabel },
      ],
    };
  }

  if (i.scene === "answer") {
    const a = i.assess;
    const mat = i.materialName ? `${title} for ${i.materialName}` : title;
    const facts: TourFact[] = [];
    if (a) {
      facts.push({ label: "Nearby ISS test results", value: a.coverage.comparable_observations.toLocaleString("en-US") });
      facts.push({ label: "This cabin", value: airText(a.target.oxygen_percent.nominal ?? a.target.oxygen_percent.max ?? a.target.oxygen_percent.min, a.target.total_pressure_kpa.nominal ?? a.target.total_pressure_kpa.max ?? a.target.total_pressure_kpa.min) });
      const tested = kpaWhole(i.testedKpa);
      if (tested && i.testedKpaMeasured === true) {
        facts.push({ label: "ISS tests ran at", value: tested });
      } else if (tested && i.testedKpaMeasured === false) {
        // Assumed by the dataset, never recorded: say so (same wording basis as the answer card).
        const same = i.testedKpa ? Math.round(i.testedKpa[0]) === Math.round(i.testedKpa[1]) : true;
        facts.push({ label: same ? "ISS test pressure (assumed)" : "ISS test pressure (partly assumed)", value: tested });
      }
    }
    if (i.beat === 0) return { ...base, title: mat, caption: verdictCaption(a), facts, waiting: !a };
    return { ...base, title: mat, caption: "The chart shows where ISS tests ran and where this cabin sits.", facts, waiting: !a };
  }

  if (i.scene === "next") {
    if (i.rankStatus === "unavailable") return { ...base, caption: "Too few ISS test results for this material to rank next experiments." };
    if (i.rankStatus === "none") return { ...base, caption: "No next experiment adds information about this cabin." };
    const top = i.top;
    const caption = "Machine learning ranks the most informative next experiment.";
    if (!top) return { ...base, caption, waiting: i.rankStatus === "loading" };
    const atTarget = top.reasons.some((r) => (r.code as string) === "at_target_conditions");
    return {
      ...base,
      caption,
      facts: [
        { label: atTarget ? "Top pick, at this cabin's own air" : "Top pick", value: airText(top.oxygen_percent, top.pressure_kpa) },
        { label: "Airflow", value: `${trim1(top.airflow_cm_s)} cm/s` },
        { label: "Would cut uncertainty by", value: percentSpan([top.evr_fraction]) ?? "" },
      ].filter((f) => f.value !== ""),
      notes: ["candidate_framing"],
    };
  }

  // what-if
  const cf = i.counterfactual;
  if (i.rankStatus === "unavailable" || i.rankStatus === "none") {
    return { ...base, caption: "No next experiment to preview for this material." };
  }
  if (!i.top) return { ...base, caption: "Preview what one new test result would change.", waiting: i.rankStatus === "loading" };
  const sc = cf?.scenarios ?? [];
  const span = percentSpan(sc.map((s) => s.variance_reduction_fraction));
  return {
    ...base,
    caption: span ? `Either outcome would cut uncertainty by ${span}.` : "The model would update either way; both outcomes are hypothetical.",
    facts: sc.map((s) => ({
      label: s.outcome === "sustained" ? "If the flame keeps burning" : "If it goes out",
      value: `${MINUS}${percentSpan([s.variance_reduction_fraction]) ?? ""}`,
    })),
    notes: ["hypothetical", "candidate_framing"],
    waiting: !cf,
  };
}

/** Which scene (1-based) and beat a running time falls in (used by the recorder-facing unit test and the progress bar). */
export function locate(seconds: number): { scene: number; beat: number } | "title" | "end" {
  if (seconds < TITLE_SECONDS) return "title";
  let t = seconds - TITLE_SECONDS;
  for (const [si, s] of SCENES.entries()) {
    for (const [bi, b] of s.beats.entries()) {
      if (t < b.seconds) return { scene: si + 1, beat: bi };
      t -= b.seconds;
    }
  }
  return "end";
}
