/**
 * Plain-language words for the Explorer. Words only: every number shown next to them comes from the API.
 * The verdict sentences are identical to the Cabins answer card (docs: .work/redesign/SPEC.md).
 */
import type { Plane, Verdict } from "@/lib/types";

export const PLAIN_VERDICT: Record<Verdict, { headline: string; tone: "blind" | "partly" | "covered" }> = {
  insufficient_evidence: { headline: "Blind spot: none of the ISS flame tests in our data ran in air like this.", tone: "blind" },
  extrapolation: { headline: "Partly covered: only part of this air has nearby ISS tests.", tone: "partly" },
  supported: { headline: "Covered: ISS flame tests ran in air like this.", tone: "covered" },
};

export const EXPLORER_INTRO =
  "The full map behind the Cabins page: ISS test results for one material, the model's estimate, and ranked next tests.";

/** What the "Chart" control offers. The held variable is the third condition, fixed while the other two are plotted. */
export const CHART_OPTIONS: Array<{ value: Plane; label: string }> = [
  { value: "o2_pressure", label: "Oxygen × pressure" },
  { value: "o2_flow", label: "Oxygen × airflow" },
];

export function heldLabel(plane: Plane): string {
  return plane === "o2_pressure" ? "Airflow held at" : "Pressure held at";
}

export function heldHelp(plane: Plane): string {
  return plane === "o2_pressure"
    ? "Shows test results near this airflow. The chart does not plot airflow."
    : "Shows test results near this pressure. The chart does not plot pressure.";
}

/** "Show" chips: plain name and one short helper (also the tooltip). */
export const SHOW_HELP: Record<string, string> = {
  observations: "Filled dots: flame kept burning. Hollow dots: flame went out.",
  prediction: "The model's estimate that a flame keeps burning.",
  uncertainty: "Where the model does not know.",
  coverage: "Where ISS tests are close enough to count.",
  context: "NASA ground and flight work the model does not use.",
};

/** Fraction 0..1 as "35 %" (non-breaking space), the notation used on the Cabins page. Missing stays "—". */
export function pct(v: number | null | undefined, digits = 0): string {
  return typeof v === "number" && Number.isFinite(v) ? `${(v * 100).toFixed(digits)} %` : "—";
}

/** "35–97 %" for a range of fractions; one value when both ends print the same. */
export function pctRange(lo: number | null | undefined, hi: number | null | undefined, digits = 0): string {
  if (typeof lo !== "number" || typeof hi !== "number" || !Number.isFinite(lo) || !Number.isFinite(hi)) return "—";
  const a = (lo * 100).toFixed(digits);
  const b = (hi * 100).toFixed(digits);
  return a === b ? `${a}\u00a0%` : `${a}–${b}\u00a0%`;
}

/** Signed change with a real minus sign: -0.18 -> "−18 %". */
export function pctSigned(v: number | null | undefined, digits = 0): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const t = Math.abs(v * 100).toFixed(digits);
  return `${v < 0 ? "\u2212" : v > 0 ? "+" : ""}${t}\u00a0%`;
}
