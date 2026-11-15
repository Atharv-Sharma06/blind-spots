/**
 * Pure helpers for the Explore workspace (no React, no runtime imports beyond types).
 * Axis defaults are UI constants taken from docs/API.md (coverage/surface defaults).
 */
import type {
  ApiExperiment,
  ApiObservation,
  Candidate,
  ContextResponse,
  GroupSummary,
  NearestObservation,
  Plane,
  Range,
  ResolvedTarget,
} from "@/lib/types";

export type Pair = [number, number];
export type Domain = { x: Pair; y: Pair };

/** UI constants (axis defaults, docs/API.md). */
export const DEFAULT_X: Pair = [10, 40];
export const DEFAULT_Y: Record<Plane, Pair> = { o2_flow: [0.2, 50], o2_pressure: [30, 110] };
export const Y_SCALE: Record<Plane, "log" | "linear"> = { o2_flow: "log", o2_pressure: "linear" };
/** UI constants: slider limits for the slice control. */
export const SLICE_LIMITS: Record<Plane, { min: number; max: number; step: number }> = {
  o2_flow: { min: 30, max: 110, step: 0.1 },
  o2_pressure: { min: 0.2, max: 50, step: 0.1 },
};

/** Documented value to analyse at: nominal, else the documented upper bound (flagged by the backend). */
export const o2Anchor = (r: Range): number | null => r.nominal ?? r.max ?? r.min;
export const pressureAnchor = (r: Range): number | null => r.nominal ?? r.max ?? r.min;

/** X domain extended only when the target would fall outside the default axis. */
export function xDomainFor(target: ResolvedTarget | null | undefined): Pair {
  const o2 = target ? o2Anchor(target.oxygen_percent) : null;
  if (o2 !== null && o2 > DEFAULT_X[1]) return [DEFAULT_X[0], Math.min(100, Math.ceil(o2 / 5) * 5 + 5)];
  return DEFAULT_X;
}

export interface MapTarget {
  label: string;
  xRange: Pair;
  yRange: Pair;
  nominal: Pair;
}

/** Target rectangle for the plane. Returns null when needed values are not documented. */
export function targetForMap(plane: Plane, t: ResolvedTarget | null | undefined): MapTarget | null {
  if (!t) return null;
  const o2 = t.oxygen_percent;
  const xa = o2Anchor(o2);
  if (xa === null) return null;
  const xRange: Pair = [o2.min ?? xa, o2.max ?? xa];
  if (plane === "o2_flow") {
    const f = t.airflow_cm_s;
    const lo = f.min ?? f.nominal;
    const hi = f.max ?? f.nominal;
    if (lo === null || hi === null || lo === undefined || hi === undefined) return null;
    // A zero airflow cannot be drawn on the log axis; the target is then listed in text only.
    if (lo <= 0 || hi <= 0) return null;
    const nominalY = f.nominal ?? Math.sqrt(Math.max(lo, 1e-9) * hi); // drawing anchor only (log midpoint of the band)
    return { label: t.label, xRange, yRange: [lo, hi], nominal: [xa, nominalY] };
  }
  const p = t.total_pressure_kpa;
  const pa = pressureAnchor(p);
  if (pa === null) return null;
  return { label: t.label, xRange, yRange: [p.min ?? pa, p.max ?? pa], nominal: [xa, pa] };
}

/** Pressure (kPa) at which the o2_flow plane should be sliced for this target; null when undocumented. */
export function targetSliceFor(plane: Plane, t: ResolvedTarget | null | undefined): number | null {
  if (!t) return null;
  if (plane === "o2_flow") return pressureAnchor(t.total_pressure_kpa);
  const f = t.airflow_cm_s;
  return f.nominal ?? (f.min !== null && f.max !== null ? Math.sqrt(f.min * f.max) : null);
}

export interface PointXY {
  x: number;
  y: number;
}

export function candidateXY(plane: Plane, c: Pick<Candidate, "oxygen_percent" | "airflow_cm_s" | "pressure_kpa">): PointXY {
  return { x: c.oxygen_percent, y: plane === "o2_flow" ? c.airflow_cm_s : c.pressure_kpa };
}

/** View domain framing the candidate and the target with a margin (multiplicative for log axes). */
export function frameDomain(plane: Plane, cand: PointXY, target: MapTarget | null, base: Domain, extra: PointXY[] = []): Domain {
  const log = Y_SCALE[plane] === "log";
  const xs = [cand.x, ...extra.map((e) => e.x), ...(target ? target.xRange : [])];
  const ys = [cand.y, ...extra.map((e) => e.y), ...(target ? target.yRange : [])].filter((v) => !log || v > 0);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const px = Math.max(3, (x1 - x0) * 0.15);
  const x: Pair = [Math.max(base.x[0], x0 - px), Math.min(base.x[1], x1 + px)];
  let y: Pair;
  if (log) {
    const f = Math.max(1.5, Math.pow(y1 / y0, 0.15));
    y = [Math.max(base.y[0], y0 / f), Math.min(base.y[1], y1 * f)];
  } else {
    const py = Math.max(5, (y1 - y0) * 0.15);
    y = [Math.max(base.y[0], y0 - py), Math.min(base.y[1], y1 + py)];
  }
  return { x: x[0] < x[1] ? x : base.x, y: y[0] < y[1] ? y : base.y };
}

// ---- Observations -------------------------------------------------------------------------------

export interface MapObs {
  id: string;
  x: number;
  y: number;
  label: 0 | 1 | null;
  pressureAssumed: boolean;
  experimentId: string;
  groupId: string;
  title: string;
  detail: Record<string, string>;
}

const num = (v: number | null | undefined, d = 1) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—");

export interface MapObsResult {
  points: MapObs[];
  /** Observations not drawn because the plane's y axis is logarithmic and airflow is 0 (flow-off steps). */
  hiddenZeroFlow: number;
  /** Observations not drawn because they lie outside the slice window (when `inSlice` is given). */
  outsideSlice: number;
  total: number;
}

export function observationsForMap(plane: Plane, obs: readonly ApiObservation[], inSlice: ReadonlySet<string> | null): MapObsResult {
  const points: MapObs[] = [];
  let hiddenZeroFlow = 0;
  let outsideSlice = 0;
  for (const o of obs) {
    const pressure = o.pressure_for_analysis_kpa ?? o.total_pressure_kpa;
    const x = o.oxygen_percent;
    const y = plane === "o2_flow" ? o.airflow_cm_s : pressure;
    if (x === null || y === null) continue;
    if (inSlice && !inSlice.has(o.observation_id)) {
      outsideSlice += 1;
      continue;
    }
    if (plane === "o2_flow" && y <= 0) {
      hiddenZeroFlow += 1;
      continue;
    }
    const assumed = o.total_pressure_kpa === null && o.pressure_for_analysis_kpa !== null;
    points.push({
      id: o.observation_id,
      x,
      y,
      label: o.label,
      pressureAssumed: assumed,
      experimentId: o.experiment_id,
      groupId: o.group_id ?? "",
      title: `${o.experiment_id} · step ${o.step_index + 1}`,
      detail: {
        Outcome: o.label === 1 ? "Flame sustained" : o.label === 0 ? "Not sustained" : "Not used for training",
        Oxygen: `${num(o.oxygen_percent)} %`,
        Airflow: `${num(o.airflow_cm_s, 2)} cm/s`,
        Pressure: `${num(pressure)} kPa${assumed ? " (assumed)" : ""}`,
        Confidence: o.confidence,
      },
    });
  }
  return { points, hiddenZeroFlow, outsideSlice, total: obs.length };
}

// ---- Context ------------------------------------------------------------------------------------

export interface ContextMapData {
  envelopes: Array<{ id: string; label: string; short: string; xRange: [number | null, number | null]; yRange: [number | null, number | null] }>;
  points: Array<{ id: string; x: number; y: number; label: string; investigation: string }>;
}

/** Same pressure window as the observation slice (|ln(p / slice)| <= 0.1). */
const SLICE_WINDOW_LN = 0.1;

/**
 * Short readable tag for a context box ("SoFIE-GEL", "Saffire-VI", "NASA Glenn"): the name up to its first
 * parenthesis, comma or colon; when that is still long, its first two words.
 */
export function contextShortLabel(name: string): string {
  const head = (name.split(/\s\(|,|:/)[0] ?? name).trim();
  return head.length <= 14 ? head : head.split(/\s+/).slice(0, 2).join(" ");
}

export function contextForMap(plane: Plane, ctx: ContextResponse | null | undefined, slice?: number): ContextMapData {
  const out: ContextMapData = { envelopes: [], points: [] };
  if (!ctx) return out;
  for (const n of ctx.not_integrated) {
    const x = n.oxygen_percent_range;
    const y = plane === "o2_flow" ? n.flow_cm_s_range : n.pressure_kpa_range;
    if (!x && !y) continue;
    out.envelopes.push({ id: n.id, label: n.name, short: contextShortLabel(n.name), xRange: x ? [x[0], x[1]] : [null, null], yRange: y ? [y[0], y[1]] : [null, null] });
  }
  for (const e of ctx.context_experiments as ApiExperiment[]) {
    const x = e.oxygen_percent ?? e.oxygen_percent_initial;
    const flow = e.airflow_cm_s ?? (e.airflow_min_cm_s !== null && e.airflow_max_cm_s !== null ? (e.airflow_min_cm_s + e.airflow_max_cm_s) / 2 : null);
    const y = plane === "o2_flow" ? flow : e.total_pressure_kpa ?? e.pressure_assumed_kpa;
    const pressure = e.total_pressure_kpa ?? e.pressure_assumed_kpa;
    // On the o2_flow plane a context test is drawn only when it was run near the slice pressure; otherwise it would imply a pressure it was not run at.
    if (plane === "o2_flow" && slice !== undefined && pressure !== null && pressure > 0 && Math.abs(Math.log(pressure / slice)) > SLICE_WINDOW_LN) continue;
    if (x === null || y === null || (plane === "o2_flow" && y <= 0)) continue;
    out.points.push({ id: e.experiment_id, x, y, label: e.test_label || e.experiment_id, investigation: e.investigation_name });
  }
  return out;
}

// ---- Groups -------------------------------------------------------------------------------------

export interface GroupBalance {
  sustained: number;
  notSustained: number;
  n: number;
  /** Fraction of the majority class (the majority-class baseline accuracy). */
  majorityFraction: number | null;
  majorityLabel: "sustained" | "not sustained" | null;
}

export function groupBalance(g: Pick<GroupSummary, "label_counts">): GroupBalance {
  const s = g.label_counts.sustained;
  const ns = g.label_counts.not_sustained;
  const n = s + ns;
  if (n === 0) return { sustained: s, notSustained: ns, n, majorityFraction: null, majorityLabel: null };
  return { sustained: s, notSustained: ns, n, majorityFraction: Math.max(s, ns) / n, majorityLabel: s >= ns ? "sustained" : "not sustained" };
}

/** Small-sample callout threshold: a UI constant, not a statistical claim. */
export const SMALL_SAMPLE_EXPERIMENTS = 20;

export function nearestIds(list: readonly NearestObservation[] | undefined): string[] {
  return (list ?? []).map((o) => o.observation_id);
}

/** Shares of total uncertainty (knowledge vs outcome variability) from epistemic / aleatoric means. */
export function decomposition(epistemic: number | null, aleatoric: number | null): { knowledge: number; variability: number } | null {
  if (epistemic === null || aleatoric === null || epistemic < 0 || aleatoric < 0) return null;
  const t = epistemic + aleatoric;
  return t > 0 ? { knowledge: epistemic / t, variability: aleatoric / t } : null;
}
