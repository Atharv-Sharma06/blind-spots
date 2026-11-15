/**
 * Pure geometry for the simple chart on the Cabins page: convex hull ("where ISS tests ran"), axis domains that
 * always include the selected cabin, and label placement that avoids overlaps. No data is created here; every
 * point comes from the API.
 */
import { scaleLinear } from "d3-scale";

export interface Pt {
  x: number;
  y: number;
}

/** Andrew's monotone chain. Returns the hull in order; fewer than 3 unique points returns them as they are. */
export function convexHull(points: readonly Pt[]): Pt[] {
  const uniq = new Map<string, Pt>();
  for (const p of points) uniq.set(`${p.x}|${p.y}`, p);
  const pts = [...uniq.values()].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export type Domain = [number, number];

/** A linear domain covering `values`, padded and rounded to nice ticks, never below `min` or above `max`. */
export function paddedDomain(values: readonly number[], opts: { minSpan: number; padFrac?: number; min?: number; max?: number }): Domain {
  const finite = values.filter((v) => Number.isFinite(v));
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
  const span = Math.max(hi - lo, 0);
  if (span < opts.minSpan) {
    const mid = (lo + hi) / 2;
    lo = mid - opts.minSpan / 2;
    hi = mid + opts.minSpan / 2;
  }
  const pad = Math.max(hi - lo, opts.minSpan) * (opts.padFrac ?? 0.08);
  lo -= pad;
  hi += pad;
  const [nlo, nhi] = scaleLinear().domain([lo, hi]).nice(6).domain() as Domain;
  return [Math.max(nlo, opts.min ?? -Infinity), Math.min(nhi, opts.max ?? Infinity)];
}

export interface LabelItem {
  id: string;
  /** Anchor in pixels. */
  x: number;
  y: number;
  text: string;
  fontSize: number;
  /** Radius of the marker the label belongs to (labels keep clear of it). */
  r: number;
}

export interface PlacedLabel {
  id: string;
  x: number;
  y: number;
  anchor: "start" | "end" | "middle";
  text: string;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** Rough text width: Geist is about 0.56 em per character. */
export const textWidth = (text: string, fontSize: number, bold = false) => text.length * fontSize * (bold ? 0.6 : 0.56);

/**
 * Greedy label placement. Items are placed in the given order (most important first). Each tries the right side, the
 * left side, then above and below; the first position inside `bounds` that touches no earlier label or any marker wins.
 * Labels that fit nowhere are dropped (returned `null`), never drawn on top of something else.
 */
export function placeLabels(
  items: readonly (LabelItem & { bold?: boolean })[],
  bounds: Rect,
  markers: readonly (Pt & { r: number })[],
  avoid: readonly Rect[] = [],
): Map<string, PlacedLabel | null> {
  const placed: Rect[] = [...avoid];
  const out = new Map<string, PlacedLabel | null>();
  for (const it of items) {
    const w = textWidth(it.text, it.fontSize, it.bold);
    const h = it.fontSize + 2;
    const gap = it.r + 4;
    const candidates: { x: number; y: number; anchor: PlacedLabel["anchor"]; rect: Rect }[] = [];
    // Same row first (right, then left), then centred above or below: a label never drifts to a neighbouring marker.
    candidates.push({ x: it.x + gap, y: it.y, anchor: "start", rect: { x0: it.x + gap, x1: it.x + gap + w, y0: it.y - h / 2, y1: it.y + h / 2 } });
    candidates.push({ x: it.x - gap, y: it.y, anchor: "end", rect: { x0: it.x - gap - w, x1: it.x - gap, y0: it.y - h / 2, y1: it.y + h / 2 } });
    candidates.push({ x: it.x, y: it.y - gap - h / 2, anchor: "middle", rect: { x0: it.x - w / 2, x1: it.x + w / 2, y0: it.y - gap - h, y1: it.y - gap } });
    candidates.push({ x: it.x, y: it.y + gap + h / 2, anchor: "middle", rect: { x0: it.x - w / 2, x1: it.x + w / 2, y0: it.y + gap, y1: it.y + gap + h } });
    let chosen: PlacedLabel | null = null;
    for (const c of candidates) {
      const r = c.rect;
      if (r.x0 < bounds.x0 || r.x1 > bounds.x1 || r.y0 < bounds.y0 || r.y1 > bounds.y1) continue;
      if (placed.some((p) => overlaps(p, r))) continue;
      if (markers.some((m) => overlaps({ x0: m.x - m.r, x1: m.x + m.r, y0: m.y - m.r, y1: m.y + m.r }, r))) continue;
      chosen = { id: it.id, x: c.x, y: c.y, anchor: c.anchor, text: it.text };
      placed.push(r);
      break;
    }
    out.set(it.id, chosen);
  }
  return out;
}
