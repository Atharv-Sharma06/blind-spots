/** Shared helpers for the small SVG charts (no chart library). */

export interface LinearScale {
  (v: number): number;
  domain: [number, number];
  range: [number, number];
}

export function linearScale(domain: [number, number], range: [number, number]): LinearScale {
  const [d0, d1] = domain;
  const span = d1 - d0 || 1;
  const fn = ((v: number) => range[0] + ((v - d0) / span) * (range[1] - range[0])) as LinearScale;
  fn.domain = domain;
  fn.range = range;
  return fn;
}

/** "Nice" tick values covering [lo, hi] with about `count` steps. */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (hi === lo) return [lo];
  const raw = (hi - lo) / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const start = Math.ceil(lo / step - 1e-9) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  return out;
}

/** Expand a data extent to a rounded domain with a little padding. */
export function paddedDomain(values: number[], pad = 0.06, floor?: number, ceil?: number): [number, number] {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return [0, 1];
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (lo === hi) {
    lo -= 0.5;
    hi += 0.5;
  }
  const p = (hi - lo) * pad;
  lo -= p;
  hi += p;
  if (floor !== undefined) lo = Math.max(lo, floor);
  if (ceil !== undefined) hi = Math.min(hi, ceil);
  return [lo, hi];
}

export function tickLabel(v: number): string {
  const a = Math.abs(v);
  if (a !== 0 && (a < 0.01 || a >= 10000)) return v.toExponential(0);
  return String(Number(v.toPrecision(3)));
}

/** Colours reference the design tokens (CSS variables), so they follow the theme. */
export const CHART = {
  ink: "var(--fg)",
  muted: "var(--muted)",
  grid: "var(--border)",
  axis: "var(--border-strong)",
  surface: "var(--surface)",
  plum: "var(--plum-6)",
  plumBand: "var(--plum-3)",
  accent: "var(--accent)",
} as const;

export const FONT = "var(--font-mono), ui-monospace, monospace";
