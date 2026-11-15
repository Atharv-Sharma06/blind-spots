/** Shared colour constants, grid geometry and tick helpers for the parameter map. */

/* SVG marks use the theme tokens directly; canvas layers need literal colours, so the *_HEX values mirror the dark
 * tokens in styles/globals.css (keep them in sync). */
export const INK = "var(--fg)";
export const OBSERVED = "var(--observed)";
export const GAP = "var(--gap)";
export const ACCENT = "var(--accent)";
export const MUTED = "var(--muted)";
export const TARGET = "var(--target)";
export const ON_ACCENT = "var(--on-accent)";
/** Canvas copies of the tokens (canvas cannot resolve CSS variables). */
export const GAP_HEX = "#FFB547";
/** Light ink for the prediction shading on the dark plot (--fg). */
export const INK_RGB: readonly [number, number, number] = [244, 244, 245];
/** --plum-1 … --plum-7, dark to bright: low uncertainty recedes into the dark plot, high uncertainty glows. */
/** Opacity of the uncertainty wash on the plot (and of the legend ramp, so they match). */
export const UNC_ALPHA = 0.5;
export const PLUM_STOPS = ["#1E1522", "#2E1A36", "#4A2357", "#6E2A8C", "#9B3FB5", "#C46BD8", "#EBB2F5"] as const;

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const PLUM_RGB = PLUM_STOPS.map(hexToRgb);

/** Sequential plum scale for latent_std_ratio in [0, 1] (clamped). */
export function plumRgb(v: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, v)) * (PLUM_RGB.length - 1);
  const i = Math.min(PLUM_RGB.length - 2, Math.floor(t));
  const f = t - i;
  const a = PLUM_RGB[i]!;
  const b = PLUM_RGB[i + 1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
export function plumColor(v: number): string {
  const [r, g, b] = plumRgb(v);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

export interface GridGeom {
  nx: number;
  ny: number;
  xEdges: number[];
  yEdges: number[];
  /** true when y values ascend with row index */
  yAscending: boolean;
}

export function cellEdges(values: number[], scale: "linear" | "log"): number[] {
  const t = scale === "log" ? Math.log : (v: number) => v;
  const inv = scale === "log" ? Math.exp : (v: number) => v;
  const tv = values.map(t);
  const n = tv.length;
  if (n === 0) return [];
  if (n === 1) return [inv(tv[0]! - 0.5), inv(tv[0]! + 0.5)];
  const e: number[] = [tv[0]! - (tv[1]! - tv[0]!) / 2];
  for (let i = 0; i < n - 1; i++) e.push((tv[i]! + tv[i + 1]!) / 2);
  e.push(tv[n - 1]! + (tv[n - 1]! - tv[n - 2]!) / 2);
  return e.map(inv);
}

export function gridGeom(
  x: { values: number[]; scale: "linear" | "log" },
  y: { values: number[]; scale: "linear" | "log" },
): GridGeom {
  return {
    nx: x.values.length,
    ny: y.values.length,
    xEdges: cellEdges(x.values, x.scale),
    yEdges: cellEdges(y.values, y.scale),
    yAscending: (y.values[0] ?? 0) <= (y.values[y.values.length - 1] ?? 0),
  };
}

/** Row-run encoding of a boolean mask: [row, colStart, colEndExclusive]. */
export function maskRuns(nx: number, ny: number, f: (i: number, j: number) => boolean): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (let j = 0; j < ny; j++) {
    let s = -1;
    for (let i = 0; i <= nx; i++) {
      const on = i < nx && f(i, j);
      if (on && s < 0) s = i;
      if (!on && s >= 0) {
        out.push([j, s, i]);
        s = -1;
      }
    }
  }
  return out;
}

const LOG_TICKS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

export function yTicks(domain: [number, number], scale: "log" | "linear", approx: number, lin: (n: number) => number[]): number[] {
  const lo = Math.min(...domain);
  const hi = Math.max(...domain);
  if (scale === "log") {
    const t = LOG_TICKS.filter((v) => v >= lo * 0.999 && v <= hi * 1.001);
    if (t.length >= 3) return t;
    // zoomed in: fall back to 1-2-5 ticks inside the domain
    const out: number[] = [];
    const d0 = Math.floor(Math.log10(lo)) - 1;
    const d1 = Math.ceil(Math.log10(hi)) + 1;
    for (let d = d0; d <= d1; d++) for (const m of [1, 2, 3, 5, 7]) {
      const v = m * 10 ** d;
      if (v >= lo && v <= hi) out.push(+v.toPrecision(3));
    }
    return out.length >= 2 ? out : lin(approx);
  }
  return lin(approx);
}

export function fmtTick(v: number): string {
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  return String(+v.toPrecision(3));
}

export const KPA_PER_PSI = 6.894757;
