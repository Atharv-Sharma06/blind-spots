/** Shared colour constants, grid geometry and tick helpers for the parameter map. */

/* Theme-aware colours. SVG marks, labels and legend swatches take CSS-variable strings, so they follow the page theme
 * (light, dark, prefers-color-scheme) with no JavaScript and no flash. Canvas layers cannot resolve CSS variables,
 * so `resolveMapTheme()` reads the same tokens from the document once per theme and `useMapTheme()` re-reads them
 * when the theme changes. Tokens (globals.css): --fg, --muted, --surface, --observed, --observed-tint, --target,
 * --on-ink, --plum-1 … --plum-7 (low to high uncertainty; light to dark in the light theme, dark to bright in dark). */
export const INK = "var(--fg)";
export const OBSERVED = "var(--observed)";
export const OBSERVED_TINT = "var(--observed-tint)";
/** Mid grey for the coverage-gap outline (muted ink pulled towards the plot background). */
export const GAP = "color-mix(in srgb, var(--muted) 75%, var(--surface))";
/** Research-candidate diamonds: ink fill with the page background colour (--on-ink) for the rank number. */
export const ACCENT = "var(--fg)";
export const MUTED = "var(--muted)";
export const TARGET = "var(--target)";
export const ON_ACCENT = "var(--on-ink)";
/** Plot background and the halo colour behind marks and labels. */
export const PAPER = "var(--surface)";
/** Hairline guides: ink at low alpha (gridlines, ticks, frame). */
export const GUIDE = "var(--fg)";
/** SVG copy of the coverage-gap hatch colour (grey stripes, like the `hatch` utility but a little stronger). */
export const GAP_HEX = "color-mix(in srgb, var(--muted) 60%, var(--surface))";
/** Opacity of the uncertainty wash on the light plot (and of the legend ramp, so they match). */
export const UNC_ALPHA = 0.5;
/** Dark plot: the bright end of the plum scale is lighter than the plot, so the wash is thinner. */
const UNC_ALPHA_DARK = 0.4;
/** Mix of --muted into --surface for the canvas hatch (same ratio as GAP_HEX above). */
const GAP_MIX = 0.6;

type Rgb = [number, number, number];

/** Light-theme literals: the server render and the fallback when a token cannot be read. */
const LIGHT_PLUM = ["#F5F0F7", "#E7DCEC", "#D2BFDB", "#B596C4", "#8F6AA3", "#6E4A84", "#4F2F63"] as const;

function hexToRgb(h: string): Rgb {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Colours the canvas layers and the legend ramp need as numbers. */
export interface MapTheme {
  /** true when the page background is dark */
  dark: boolean;
  /** --fg as rgb: the prediction shading is this ink at low alpha */
  inkRgb: Rgb;
  /** canvas hatch / wash colour for coverage gaps, `#rrggbb` */
  gapHex: string;
  /** --plum-1 … --plum-7, low to high uncertainty */
  plum: Rgb[];
  /** opacity of the uncertainty wash and of the legend ramp */
  uncAlpha: number;
}

export const LIGHT_MAP_THEME: MapTheme = {
  dark: false,
  inkRgb: [22, 22, 22],
  gapHex: "#A5A29A",
  plum: LIGHT_PLUM.map(hexToRgb),
  uncAlpha: UNC_ALPHA,
};

function parseCssColor(raw: string): Rgb | null {
  const s = raw.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return [...m[1]!].map((c) => parseInt(c + c, 16)) as Rgb;
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(s);
  if (m) return hexToRgb("#" + m[1]!);
  const f = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  if (f) return [Math.round(+f[1]!), Math.round(+f[2]!), Math.round(+f[3]!)];
  return null;
}

const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
const toHex = (c: Rgb) => `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`;
const luminance = ([r, g, b]: Rgb) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** Reads the map tokens from the document. `sig` changes exactly when a token value changes. */
export function resolveMapTheme(): { sig: string; theme: MapTheme } {
  if (typeof document === "undefined") return { sig: "", theme: LIGHT_MAP_THEME };
  const cs = getComputedStyle(document.documentElement);
  const raw = (name: string) => cs.getPropertyValue(name).trim();
  const tok = (name: string, fb: Rgb): Rgb => parseCssColor(raw(name)) ?? fb;
  const ink = tok("--fg", LIGHT_MAP_THEME.inkRgb);
  const muted = tok("--muted", [111, 109, 104]);
  const surface = tok("--surface", [255, 255, 255]);
  const plum = LIGHT_MAP_THEME.plum.map((fb, i) => tok(`--plum-${i + 1}`, fb));
  const sig = [ink, muted, surface, ...plum].map((c) => c.join(",")).join("|");
  const dark = luminance(surface) < 0.5;
  // Light keeps the original grey stripes exactly; dark mixes the same muted/surface ratio as the SVG copy.
  const gap: Rgb = dark ? (muted.map((v, i) => v * GAP_MIX + surface[i]! * (1 - GAP_MIX)) as Rgb) : hexToRgb(LIGHT_MAP_THEME.gapHex);
  return { sig, theme: { dark, inkRgb: ink, gapHex: toHex(gap), plum, uncAlpha: dark ? UNC_ALPHA_DARK : UNC_ALPHA } };
}

/** Sequential plum scale for latent_std_ratio in [0, 1] (clamped), over the given stops. */
export function plumRgb(v: number, stops: readonly Rgb[] = LIGHT_MAP_THEME.plum): Rgb {
  const t = Math.min(1, Math.max(0, v)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  const f = t - i;
  const a = stops[i]!;
  const b = stops[i + 1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
export function plumColor(v: number, stops: readonly Rgb[] = LIGHT_MAP_THEME.plum): string {
  const [r, g, b] = plumRgb(v, stops);
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
