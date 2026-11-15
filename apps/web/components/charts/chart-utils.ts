/** Shared helpers for the small SVG charts (no chart library). */
import { useEffect, useRef, useState, type RefObject } from "react";

/** Chart text sizes in CSS pixels. Charts render at their real pixel width, so these are the sizes users see (minimum 11 px). */
export const TEXT = { tick: 11, label: 12, value: 11 } as const;

/**
 * Measures the width of the chart container so the SVG is drawn 1:1 (no viewBox scaling that would shrink
 * text on phones). Falls back to `fallback` until the first measurement.
 */
export function useChartWidth(fallback: number, max = fallback): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const cw = Math.floor(el.clientWidth);
      if (cw > 0) setW(Math.min(max, Math.max(260, cw)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [max]);
  return [ref, w];
}

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
  /** Faint guides: a hairline that reads on charcoal without competing with the data. */
  grid: "rgb(255 255 255 / 0.07)",
  axis: "var(--border-strong)",
  surface: "var(--surface)",
  plum: "var(--plum-6)",
  plumBand: "var(--plum-3)",
  /** Signal yellow: the model of interest / Blind Spots. */
  accent: "var(--accent)",
  /** Periwinkle: what ISS tests actually showed. */
  observed: "var(--observed)",
} as const;

export const FONT = "var(--font-mono), ui-monospace, monospace";
export const SANS = "var(--font-sans), ui-sans-serif, system-ui, sans-serif";
