"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { contours as d3contours, type ContourMultiPolygon } from "d3-contour";
import { scaleLinear, scaleLog } from "d3-scale";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity } from "d3-zoom";
import { Button } from "@/components/ui/button";
import type { CoverageResponse, SurfaceResponse } from "@/lib/types";
import { verdictLabel } from "@/lib/format";
import MapLegend from "./map-legend";
import { ACCENT, GAP, INK, MUTED, OBSERVED, fmtTick, gridGeom, maskRuns, plumRgb, yTicks, type GridGeom } from "./map-scales";

export interface MapObservation {
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
export type ViewDomain = { x: [number, number]; y: [number, number] };
export type ParameterMapProps = {
  plane: "o2_flow" | "o2_pressure";
  xDomain: [number, number];
  yDomain: [number, number];
  yScale: "log" | "linear";
  observations: MapObservation[];
  coverage?: CoverageResponse | null;
  surface?: SurfaceResponse | null;
  hypotheticalSurface?: { p_sustained: number[][]; latent_std_ratio: number[][] } | null;
  layers: {
    observations: boolean;
    coverage: boolean;
    prediction: boolean;
    uncertainty: boolean;
    target: boolean;
    candidates: boolean;
    context: boolean;
  };
  target?: { label: string; xRange: [number, number]; yRange: [number, number]; nominal: [number, number] } | null;
  /**
   * `slice` (optional) = the candidate's value on the sliced axis (pressure kPa on o2_flow, airflow cm/s on
   * o2_pressure). When given, candidates more than one reference scale from the map slice are drawn hollow ("off-slice").
   */
  candidates?: Array<{ id: string; rank: number; x: number; y: number; title: string; slice?: number | null }>;
  contextEnvelopes?: Array<{ id: string; label: string; short?: string; xRange: [number | null, number | null]; yRange: [number | null, number | null] }>;
  contextPoints?: Array<{ id: string; x: number; y: number; label: string; investigation: string }>;
  highlightObservationIds?: string[];
  selectedObservationId?: string | null;
  selectedCandidateId?: string | null;
  viewDomain?: ViewDomain | null;
  onViewDomainChange?: (d: ViewDomain | null) => void;
  onSelectObservation?: (id: string | null) => void;
  onSelectCandidate?: (id: string | null) => void;
  /** Fixed plot height in px. Omit it and size the plot box with `plotClassName` (CSS) instead: the plot then
   *  measures itself, so the server-rendered height equals the client height on every screen (no load jump). */
  height?: number;
  plotClassName?: string;
  ariaLabel: string;
};

const M = { l: 58, r: 18, t: 12, b: 46 };
const CONTOUR_LEVELS = [0.1, 0.5, 0.9];
const CONTOUR_LABEL = "model p = 0.5 (supported region)";

type Grid = number[][];
type Item = { key: string; kind: "obs" | "cand"; id: string; px: number; py: number };
type Hover =
  | { kind: "obs"; id: string; x: number; y: number }
  | { kind: "cand"; id: string; x: number; y: number }
  | { kind: "ctx"; id: string; x: number; y: number }
  | { kind: "cell"; i: number; j: number; x: number; y: number };

type CandMember = { id: string; rank: number; x: number; y: number; title: string; slice?: number | null; off: boolean };
type CandGroup = { key: string; X: number; Y: number; members: CandMember[]; anyOn: boolean; label: string; half: number };

let measureCtx: CanvasRenderingContext2D | null = null;
let measureFamily: string | null = null;
/** Text width in px for SVG labels (Geist via the body font); estimate when no DOM. */
function textW(t: string, size: number, weight = 400): number {
  if (typeof document !== "undefined") {
    measureCtx ??= document.createElement("canvas").getContext("2d");
    measureFamily ??= getComputedStyle(document.body).fontFamily || "sans-serif";
    if (measureCtx) {
      measureCtx.font = `${weight} ${size}px ${measureFamily}`;
      return measureCtx.measureText(t).width;
    }
  }
  return t.length * size * 0.56;
}
type Box = { x: number; y: number; w: number; h: number };
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const at = <T,>(a: T[] | undefined, i: number): T | undefined => (a ? a[i] : undefined);

/** Rasterised (grid-resolution) layers, memoised per grid. */
interface Rasters {
  geom: GridGeom;
  unc: HTMLCanvasElement | null;
  pred: HTMLCanvasElement | null;
  insufficientRuns: Array<[number, number, number]>;
  supportedRuns: Array<[number, number, number]>;
  contours: Array<{ level: number; multi: ContourMultiPolygon }>;
  hasInsufficient: boolean;
  hasExtrapolation: boolean;
}

function makeCanvas(nx: number, ny: number): [HTMLCanvasElement, ImageData] | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = nx;
  c.height = ny;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  return [c, ctx.createImageData(nx, ny)];
}

function buildRasters(surface: SurfaceResponse, hypo: ParameterMapProps["hypotheticalSurface"]): Rasters | null {
  const p: Grid | null = hypo?.p_sustained ?? surface.p_sustained;
  const u: Grid | null = hypo?.latent_std_ratio ?? surface.latent_std_ratio;
  if (!p && !u) return null;
  const geom = gridGeom(surface.x, surface.y);
  const { nx, ny } = geom;
  const verdict = surface.verdict;
  const verdictAt = (i: number, j: number) => at(verdict ?? undefined, j)?.[i];
  const row = (j: number) => (geom.yAscending ? ny - 1 - j : j);
  // D3: prediction fill and contours only where the cell verdict is "supported".
  const supported = (i: number, j: number) => (verdict ? verdictAt(i, j) === "supported" : false);

  let unc: HTMLCanvasElement | null = null;
  let pred: HTMLCanvasElement | null = null;
  let hasExtrapolation = false;
  if (verdict) for (const r of verdict) if (r.some((v) => v === "extrapolation")) hasExtrapolation = true;
  const uc = u ? makeCanvas(nx, ny) : null;
  const pc = p ? makeCanvas(nx, ny) : null;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const o = (row(j) * nx + i) * 4;
      if (uc && u) {
        const v = at(u[j], i);
        if (typeof v === "number" && Number.isFinite(v)) {
          const [r, g, b] = plumRgb(v);
          uc[1].data[o] = r;
          uc[1].data[o + 1] = g;
          uc[1].data[o + 2] = b;
          uc[1].data[o + 3] = 235;
        }
      }
      if (pc && p && supported(i, j)) {
        const v = at(p[j], i);
        if (typeof v === "number" && Number.isFinite(v)) {
          pc[1].data[o] = 23;
          pc[1].data[o + 1] = 23;
          pc[1].data[o + 2] = 26;
          pc[1].data[o + 3] = Math.round(255 * (0.05 + 0.16 * Math.min(1, Math.max(0, v))));
        }
      }
    }
  }
  if (uc) {
    uc[0].getContext("2d")?.putImageData(uc[1], 0, 0);
    unc = uc[0];
  }
  if (pc) {
    pc[0].getContext("2d")?.putImageData(pc[1], 0, 0);
    pred = pc[0];
  }
  const insufficientRuns = maskRuns(nx, ny, (i, j) => !supported(i, j));
  const supportedRuns = maskRuns(nx, ny, (i, j) => supported(i, j));
  let contours: Rasters["contours"] = [];
  if (p) {
    const flat = new Float64Array(nx * ny).fill(NaN);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = at(p[j], i);
      if (typeof v === "number" && Number.isFinite(v)) flat[j * nx + i] = v;
    }
    // Missing (null) probabilities: fill from valid neighbours so contours do not trace the gap edge (drawing is
    // clipped to supported cells anyway, so filled values are never shown as estimates).
    for (let pass = 0; pass < nx + ny; pass++) {
      let left = 0;
      const prev = flat.slice();
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        if (!Number.isNaN(prev[j * nx + i]!)) continue;
        let sum = 0;
        let n = 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const a = i + di;
          const b = j + dj;
          if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
          const w = prev[b * nx + a]!;
          if (!Number.isNaN(w)) { sum += w; n++; }
        }
        if (n) flat[j * nx + i] = sum / n;
        else left++;
      }
      if (!left) break;
    }
    for (let k = 0; k < flat.length; k++) if (Number.isNaN(flat[k]!)) flat[k] = 0;
    const gen = d3contours().size([nx, ny]).smooth(true);
    contours = CONTOUR_LEVELS.map((level) => ({ level, multi: gen.contour(flat as unknown as number[], level) }));
  }
  return { geom, unc, pred, insufficientRuns, supportedRuns, contours, hasInsufficient: insufficientRuns.length > 0, hasExtrapolation };
}

function buildSparse(cov: CoverageResponse | SurfaceResponse) {
  const nn = cov.nn_distance;
  if (!nn) return null;
  const geom = gridGeom(cov.x, cov.y);
  const thr = cov.sparse_threshold;
  const runs = maskRuns(geom.nx, geom.ny, (i, j) => {
    const v = at(nn[j], i);
    return typeof v === "number" && v > thr;
  });
  const flat = new Float64Array(geom.nx * geom.ny);
  for (let j = 0; j < geom.ny; j++) for (let i = 0; i < geom.nx; i++) {
    const v = at(nn[j], i);
    flat[j * geom.nx + i] = typeof v === "number" && Number.isFinite(v) ? v : 0;
  }
  const multi = d3contours().size([geom.nx, geom.ny]).smooth(true).contour(flat as unknown as number[], thr);
  return { geom, runs, multi, thr };
}

function hatchPattern(ctx: CanvasRenderingContext2D, color: string, dpr: number, spacing = 7): CanvasPattern | null {
  const c = document.createElement("canvas");
  const s = Math.round(spacing * dpr);
  c.width = s;
  c.height = s;
  const g = c.getContext("2d");
  if (!g) return null;
  g.strokeStyle = color;
  g.lineWidth = Math.max(1, dpr);
  g.beginPath();
  g.moveTo(-1, s + 1);
  g.lineTo(s + 1, -1);
  g.moveTo(-1, 1);
  g.lineTo(1, -1);
  g.moveTo(s - 1, s + 1);
  g.lineTo(s + 1, s - 1);
  g.stroke();
  const pat = ctx.createPattern(c, "repeat");
  pat?.setTransform(new DOMMatrix().scale(1 / dpr));
  return pat;
}

function bisect(edges: number[], v: number): number {
  let lo = 0;
  let hi = edges.length - 1;
  if (!(v >= edges[0]! && v <= edges[hi]!)) return -1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (edges[mid]! <= v) lo = mid;
    else hi = mid;
  }
  return lo;
}

function fmt(v: number, d = 2): string {
  return Number.isFinite(v) ? String(+v.toFixed(d)) : "n/a";
}

export default function ParameterMap(props: ParameterMapProps) {
  const {
    plane, xDomain: xDomainIn, yDomain: yDomainIn, yScale, observations, coverage, surface, hypotheticalSurface, layers: layersIn, target,
    candidates = [], contextEnvelopes = [], contextPoints = [], highlightObservationIds, selectedObservationId,
    selectedCandidateId, viewDomain, onViewDomainChange, onSelectObservation, onSelectCandidate, height: heightProp, plotClassName, ariaLabel,
  } = props;
  const [measuredH, setMeasuredH] = useState<number | null>(null);
  const height = heightProp ?? measuredH ?? 520;
  // D3: axes extend to include the selected target (e.g. Skylab, Apollo); grids are drawn only where provided.
  const [xDomain, yDomain] = useMemo((): [[number, number], [number, number]] => {
    const x: [number, number] = [xDomainIn[0], xDomainIn[1]];
    const y: [number, number] = [yDomainIn[0], yDomainIn[1]];
    if (target) {
      const [t0, t1] = [Math.min(...target.xRange, target.nominal[0]), Math.max(...target.xRange, target.nominal[0])];
      if (t0 < x[0]) x[0] = Math.max(0, Math.floor((t0 - 2) / 5) * 5);
      if (t1 > x[1]) x[1] = Math.min(100, Math.ceil((t1 + 2) / 5) * 5);
      const [u0, u1] = [Math.min(...target.yRange, target.nominal[1]), Math.max(...target.yRange, target.nominal[1])];
      if (yScale === "log") {
        if (u0 > 0 && u0 < y[0]) y[0] = u0 / 1.5;
        if (u1 > y[1]) y[1] = u1 * 1.5;
      } else {
        if (u0 < y[0]) y[0] = Math.max(0, Math.floor((u0 - 5) / 10) * 10);
        if (u1 > y[1]) y[1] = Math.ceil((u1 + 5) / 10) * 10;
      }
    }
    return [x, y];
  }, [xDomainIn, yDomainIn, yScale, target]);
  const fullX = xDomain;
  const fullY = yDomain;
  // D3: only one surface layer at a time (the store enforces it; cope here if several arrive).
  const layers = useMemo(() => {
    const surf = layersIn.prediction ? "prediction" : layersIn.uncertainty ? "uncertainty" : layersIn.coverage ? "coverage" : null;
    return { ...layersIn, prediction: surf === "prediction", uncertainty: surf === "uncertainty", coverage: surf === "coverage" };
  }, [layersIn]);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomRef = useRef<SVGGElement>(null);
  const [width, setWidth] = useState(800);
  const [internalRaw, setInternalRaw] = useState<{ key: string; v: ViewDomain } | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [asTable, setAsTable] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);
  const [wrapFocus, setWrapFocus] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => {
      const w = e[0]?.contentRect.width;
      if (w && w > 120) setWidth(Math.round(w));
      const h = e[0]?.contentRect.height;
      if (heightProp === undefined && h && h > 120) setMeasuredH(Math.round(h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [asTable, heightProp]);

  const domKey = `${xDomain.join(",")}|${yDomain.join(",")}|${yScale}|${plane}`;
  const internal = internalRaw && internalRaw.key === domKey ? internalRaw.v : null;
  const setInternal = useCallback((v: ViewDomain | null) => setInternalRaw(v ? { key: domKey, v } : null), [domKey]);

  const view: ViewDomain = useMemo(() => viewDomain ?? internal ?? { x: xDomain, y: yDomain }, [viewDomain, internal, xDomain, yDomain]);
  const iw = Math.max(50, width - M.l - M.r);
  const ih = Math.max(50, height - M.t - M.b);
  /** Tooltip placement at the pointer, flipped left/up near the right/bottom edges (transform: no layout shift). */
  const tipTransform = (x: number, y: number) => {
    const fx = x + 14 + 270 > width;
    const fy = y + 14 + 170 > height;
    return `translate3d(${fx ? x - 14 : x + 14}px, ${fy ? y - 14 : y + 14}px, 0) translate(${fx ? "-100%" : "0"}, ${fy ? "-100%" : "0"})`;
  };

  const xs = useMemo(() => scaleLinear().domain(view.x).range([0, iw]), [view.x, iw]);
  const ys = useMemo(() => {
    const d: [number, number] = yScale === "log" ? [Math.max(1e-3, view.y[0]), Math.max(1e-3, view.y[1])] : view.y;
    return (yScale === "log" ? scaleLog() : scaleLinear()).domain(d).range([ih, 0]);
  }, [view.y, ih, yScale]);

  // ---- latest-value refs for the zoom handlers
  const live = useRef({ xs, ys, onViewDomainChange, viewControlled: !!viewDomain });
  useEffect(() => {
    live.current = { xs, ys, onViewDomainChange, viewControlled: !!viewDomain };
  });

  const commit = useCallback((x: [number, number], y: [number, number]) => {
    // refuse views narrower than 2% of the full extent (keeps ticks meaningful and avoids runaway zoom)
    const tr = (v: number) => (yScale === "log" ? Math.log(Math.max(v, 1e-3)) : v);
    const minX = Math.abs(xDomain[1] - xDomain[0]) * 0.02;
    const minY = Math.abs(tr(yDomain[1]) - tr(yDomain[0])) * 0.02;
    if (!(Math.abs(x[1] - x[0]) >= minX && Math.abs(tr(y[1]) - tr(y[0])) >= minY)) {
      const wide = Math.abs(x[1] - x[0]) > Math.abs(xDomain[1] - xDomain[0]) * 50;
      if (!wide) return;
    }
    const d = { x, y };
    if (!live.current.viewControlled) setInternal(d);
    live.current.onViewDomainChange?.(d);
  }, [setInternal, xDomain, yDomain, yScale]);

  const resetView = useCallback(() => {
    setInternal(null);
    live.current.onViewDomainChange?.(null);
  }, [setInternal]);

  const zoomBy = useCallback(
    (f: number) => {
      const { xs: a, ys: b } = live.current;
      commit(
        [a.invert(iw / 2 - iw / 2 / f), a.invert(iw / 2 + iw / 2 / f)],
        [b.invert(ih / 2 + ih / 2 / f), b.invert(ih / 2 - ih / 2 / f)],
      );
    },
    [commit, iw, ih],
  );
  const panBy = useCallback(
    (dx: number, dy: number) => {
      const { xs: a, ys: b } = live.current;
      commit([a.invert(-dx), a.invert(iw - dx)], [b.invert(ih - dy), b.invert(-dy)]);
    },
    [commit, iw, ih],
  );

  // ---- d3-zoom: gestures are applied incrementally to the controlled view domain
  useEffect(() => {
    const g = zoomRef.current;
    if (!g || asTable) return;
    const sel = select(g);
    let base: { xs: typeof xs; ys: typeof ys } | null = null;
    let silent = false;
    let raf = 0;
    let pending: { x: [number, number]; y: [number, number] } | null = null;
    const z = d3zoom<SVGGElement, unknown>()
      .scaleExtent([0.02, 400])
      .wheelDelta((e: WheelEvent) => -e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.002))
      .extent([[0, 0], [iw, ih]])
      .filter((e: Event) => {
        const ev = e as MouseEvent & { type: string };
        if (ev.type === "wheel") return ev.ctrlKey || ev.metaKey;
        if (ev.type === "dblclick") return false;
        return !ev.ctrlKey && !ev.button;
      })
      .on("start", () => {
        if (silent) return;
        base = { xs: live.current.xs.copy(), ys: live.current.ys.copy() };
      })
      .on("zoom", (e) => {
        if (silent || !base) return;
        const t = e.transform;
        pending = {
          x: t.rescaleX(base.xs).domain() as [number, number],
          y: t.rescaleY(base.ys).domain() as [number, number],
        };
        if (!raf)
          raf = requestAnimationFrame(() => {
            raf = 0;
            if (pending) commit(pending.x, pending.y);
            pending = null;
          });
      })
      .on("end", () => {
        if (silent) return;
        silent = true;
        sel.call(z.transform, zoomIdentity);
        silent = false;
      });
    sel.call(z).on("dblclick.zoom", null);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      sel.on(".zoom", null);
    };
  }, [iw, ih, asTable, commit]);

  // ---- grid layers (memoised per payload)
  const surfaceKey = surface ?? null;
  const rasters = useMemo(() => (surfaceKey ? buildRasters(surfaceKey, hypotheticalSurface) : null), [surfaceKey, hypotheticalSurface]);
  const sparse = useMemo(() => {
    const src = coverage?.nn_distance ? coverage : surface?.nn_distance ? surface : null;
    return src ? buildSparse(src) : null;
  }, [coverage, surface]);

  const px = useCallback((x: number) => xs(x), [xs]);
  const py = useCallback((y: number) => ys(y), [ys]);

  // ---- canvas drawing
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || asTable) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(width * dpr);
    cv.height = Math.round(height * dpr);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(M.l, M.t);
    ctx.beginPath();
    ctx.rect(0, 0, iw, ih);
    ctx.clip();

    const geomRect = (gm: GridGeom) => {
      const x0 = px(gm.xEdges[0]!);
      const x1 = px(gm.xEdges[gm.nx]!);
      const y0 = py(gm.yEdges[0]!);
      const y1 = py(gm.yEdges[gm.ny]!);
      return [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)] as const;
    };
    const runsPath = (gm: GridGeom, runs: Array<[number, number, number]>) => {
      ctx.beginPath();
      for (const [j, i0, i1] of runs) {
        const xa = px(gm.xEdges[i0]!);
        const xb = px(gm.xEdges[i1]!);
        const ya = py(gm.yEdges[j]!);
        const yb = py(gm.yEdges[j + 1]!);
        ctx.rect(Math.min(xa, xb), Math.min(ya, yb), Math.abs(xb - xa), Math.abs(yb - ya));
      }
    };
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (rasters) {
      const [rx, ry, rw, rh] = geomRect(rasters.geom);
      // With coverage hatch on top, lighten the uncertainty wash so the two layers do not stack into a saturated plane.
      if (layers.uncertainty && rasters.unc) {
        ctx.save();
        ctx.globalAlpha = 0.72;
        ctx.drawImage(rasters.unc, rx, ry, rw, rh);
        ctx.restore();
      }
      if (layers.prediction && rasters.pred) ctx.drawImage(rasters.pred, rx, ry, rw, rh);
    }
    if (layers.coverage && sparse && sparse.runs.length) {
      const g = sparse.geom;
      const cells = (g.xEdges.length - 1) * (g.yEdges.length - 1);
      const covered = sparse.runs.reduce((a, r) => a + (r[2] - r[1]), 0);
      const whole = cells > 0 && covered / cells >= 0.9;
      if (whole) {
        // The whole slice is a gap: one flat pale-amber wash and a single label instead of dense hatching.
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = GAP;
        ctx.fillRect(0, 0, iw, ih);
        ctx.restore();
      }
      const pat = whole ? null : hatchPattern(ctx, GAP, dpr, 8);
      if (pat) {
        ctx.save();
        runsPath(sparse.geom, sparse.runs);
        ctx.clip();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, iw, ih);
        ctx.restore();
      }
    }
    ctx.restore();
  }, [rasters, sparse, layers.uncertainty, layers.prediction, layers.coverage, px, py, width, height, iw, ih, asTable]);

  // ---- vector overlays derived from the grids
  // linear interpolation in cell-centre space (edges are in axis space; centres are midpoints in the scale space,
  // which for uniform grids equals the axis values; we approximate centres by edge midpoints in axis space)
  const centreFns = useCallback(
    (gm: GridGeom) => {
      const cxs: number[] = [];
      for (let i = 0; i < gm.nx; i++) cxs.push(xs((gm.xEdges[i]! + gm.xEdges[i + 1]!) / 2));
      const cys: number[] = [];
      for (let j = 0; j < gm.ny; j++) cys.push(ys(Math.sqrt(gm.yEdges[j]! * gm.yEdges[j + 1]!) || (gm.yEdges[j]! + gm.yEdges[j + 1]!) / 2));
      const lerp = (arr: number[], f: number) => {
        const n = arr.length;
        if (n < 2) return arr[0] ?? 0;
        const i = Math.max(0, Math.min(n - 2, Math.floor(f)));
        return arr[i]! + (arr[i + 1]! - arr[i]!) * (f - i);
      };
      return { fx: (f: number) => lerp(cxs, f), fy: (f: number) => lerp(cys, f) };
    },
    [xs, ys],
  );

  const ringsToPath = useCallback(
    (multi: Array<{ coordinates: number[][][] }>, gm: GridGeom) => {
      const { fx, fy } = centreFns(gm);
      let d = "";
      const pts: Array<[number, number]> = [];
      const visPts: Array<[number, number]> = [];
      for (const poly of multi) {
        for (const ring of poly.coordinates) {
          const cur: Array<[number, number]> = [];
          ring.forEach((pt, k) => {
            const X = fx(pt[0]! - 0.5);
            const Y = fy(pt[1]! - 0.5);
            d += `${k ? "L" : "M"}${X.toFixed(1)},${Y.toFixed(1)}`;
            cur.push([X, Y]);
          });
          d += "Z";
          visPts.push(...cur.filter(([X, Y]) => X > 24 && X < iw - 24 && Y > 14 && Y < ih - 14));
          pts.push(...cur);
        }
      }
      return { d, visPts };
    },
    [centreFns, iw, ih],
  );

  const predPaths = useMemo(() => {
    if (!layers.prediction || !rasters) return [];
    return rasters.contours.map((c) => ({ level: c.level, ...ringsToPath(c.multi.coordinates.map((coordinates) => ({ coordinates })), rasters.geom) }));
  }, [layers.prediction, rasters, ringsToPath]);

  const sparsePath = useMemo(() => {
    if (!layers.coverage || !sparse) return "";
    return ringsToPath(sparse.multi.coordinates.map((coordinates) => ({ coordinates })), sparse.geom).d;
  }, [layers.coverage, sparse, ringsToPath]);

  const supportedClip = useMemo(() => {
    if (!layers.prediction || !rasters) return null;
    const gm = rasters.geom;
    return rasters.supportedRuns.map(([j, i0, i1]) => {
      const xa = xs(gm.xEdges[i0]!);
      const xb = xs(gm.xEdges[i1]!);
      const ya = ys(gm.yEdges[j]!);
      const yb = ys(gm.yEdges[j + 1]!);
      return { x: Math.min(xa, xb), y: Math.min(ya, yb), w: Math.abs(xb - xa), h: Math.abs(yb - ya) };
    });
  }, [layers.prediction, rasters, xs, ys]);

  // ---- ticks
  const xT = useMemo(() => xs.ticks(Math.max(3, Math.floor(iw / 70))), [xs, iw]);
  const yT = useMemo(() => yTicks(view.y, yScale, Math.max(3, Math.floor(ih / 50)), (n) => ys.ticks(n)), [view.y, yScale, ih, ys]);

  // ---- items (points + candidates) in view
  const lo = (a: [number, number]) => Math.min(a[0], a[1]);
  const hi = (a: [number, number]) => Math.max(a[0], a[1]);
  const vis = useMemo(() => {
    const dx = (hi(view.x) - lo(view.x)) * 0.02;
    const dy = (hi(view.y) - lo(view.y)) * 0.02;
    const inView = (x: number, y: number) => x >= lo(view.x) - dx && x <= hi(view.x) + dx && y >= lo(view.y) - dy && y <= hi(view.y) + dy;
    const obs = layers.observations ? observations.filter((o) => Number.isFinite(o.x) && Number.isFinite(o.y) && inView(o.x, o.y)) : [];
    const cands = layers.candidates ? candidates.filter((c) => inView(c.x, c.y)) : [];
    return { obs, cands };
  }, [view, layers.observations, layers.candidates, observations, candidates]);

  const wholeGap = useMemo(() => {
    if (!layers.coverage || !sparse || !sparse.runs.length) return false;
    const cells = sparse.geom.nx * sparse.geom.ny;
    return cells > 0 && sparse.runs.reduce((a, r) => a + (r[2] - r[1]), 0) / cells >= 0.9;
  }, [layers.coverage, sparse]);

  // ---- candidates (D3): off-slice detection, coincident markers merged, rank 1 drawn last (on top)
  const sliceInfo = coverage?.slice ?? surface?.slice ?? null;
  const scales = coverage?.scales ?? surface?.scales ?? null;
  const candGroups: CandGroup[] = useMemo(() => {
    const s0 = sliceInfo?.value;
    const isOff = (v: number | null | undefined) => {
      if (v == null || s0 == null || !Number.isFinite(v)) return false;
      if (plane === "o2_flow") return v > 0 && s0 > 0 ? Math.abs(Math.log(v / s0)) > (scales?.p ?? 0.1) + 1e-9 : false;
      return v >= 0 && s0 >= 0 ? Math.abs(Math.log1p(v) - Math.log1p(s0)) > (scales?.flow ?? 0.5) + 1e-9 : false;
    };
    const groups: CandGroup[] = [];
    for (const c of [...vis.cands].sort((a, b) => a.rank - b.rank)) {
      const X = xs(c.x);
      const Y = ys(c.y);
      const m: CandMember = { ...c, off: isOff(c.slice) };
      const g = groups.find((q) => Math.hypot(q.X - X, q.Y - Y) < 12);
      if (g) g.members.push(m);
      else groups.push({ key: `c:${c.id}`, X, Y, members: [m], anyOn: false, label: "", half: 11 });
    }
    for (const g of groups) {
      g.anyOn = g.members.some((m) => !m.off);
      g.label = g.members.map((m) => m.rank).join(", ");
      g.half = g.members.length > 1 ? Math.max(11, textW(g.label, 10, 600) / 2 + 9) : 11;
    }
    return groups;
  }, [vis.cands, xs, ys, plane, sliceInfo?.value, scales?.p, scales?.flow]);
  const candGroupByKey = useMemo(() => new Map(candGroups.map((g) => [g.key, g])), [candGroups]);

  const items: Item[] = useMemo(
    () => [
      ...vis.obs.map((o) => ({ key: `o:${o.id}`, kind: "obs" as const, id: o.id, px: xs(o.x), py: ys(o.y) })),
      ...candGroups.map((g) => ({ key: g.key, kind: "cand" as const, id: g.members[0]!.id, px: g.X, py: g.Y })),
    ],
    [vis.obs, candGroups, xs, ys],
  );
  const tabKey = items.some((i) => i.key === activeKey) ? activeKey : (items[0]?.key ?? null);
  const highlight = useMemo(() => new Set(highlightObservationIds ?? []), [highlightObservationIds]);
  const obsById = useMemo(() => new Map(observations.map((o) => [o.id, o])), [observations]);
  const candById = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);

  const focusItem = useCallback(
    (key: string) => {
      setActiveKey(key);
      const el = document.getElementById(`${uid}-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`);
      (el as unknown as HTMLElement | null)?.focus();
    },
    [uid],
  );

  const onItemKey = (e: React.KeyboardEvent, it: Item) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      if (it.kind === "obs") onSelectObservation?.(it.id === selectedObservationId ? null : it.id);
      else {
        const g = candGroupByKey.get(it.key);
        const anySel = g ? g.members.some((m) => m.id === selectedCandidateId) : it.id === selectedCandidateId;
        onSelectCandidate?.(anySel ? null : it.id);
      }
      return;
    }
    const dir: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = dir[e.key];
    if (d) {
      e.preventDefault();
      e.stopPropagation();
      let best: Item | null = null;
      let bs = Infinity;
      for (const o of items) {
        if (o.key === it.key) continue;
        const vx = o.px - it.px;
        const vy = o.py - it.py;
        const along = vx * d[0] + vy * d[1];
        if (along <= 0.5) continue;
        const across = Math.abs(vx * d[1] - vy * d[0]);
        const s = along + 2 * across;
        if (s < bs) {
          bs = s;
          best = o;
        }
      }
      if (best) focusItem(best.key);
    }
  };

  const onWrapKey = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) {
      if (e.key === "Escape") {
        onSelectObservation?.(null);
        onSelectCandidate?.(null);
      }
      return;
    }
    const step = 0.12;
    switch (e.key) {
      case "ArrowLeft": panBy(iw * step, 0); break;
      case "ArrowRight": panBy(-iw * step, 0); break;
      case "ArrowUp": panBy(0, ih * step); break;
      case "ArrowDown": panBy(0, -ih * step); break;
      case "+": case "=": zoomBy(1.4); break;
      case "-": case "_": zoomBy(1 / 1.4); break;
      case "0": resetView(); break;
      case "Escape": onSelectObservation?.(null); onSelectCandidate?.(null); break;
      default: return;
    }
    e.preventDefault();
  };

  // ---- hover on empty plot area -> grid cell readout
  const onPlotMove = (e: React.PointerEvent<SVGRectElement>) => {
    if (e.buttons) return;
    const r = e.currentTarget.getBoundingClientRect();
    const lx = e.clientX - r.left;
    const ly = e.clientY - r.top;
    const xv = xs.invert(lx);
    const yv = ys.invert(ly);
    const src = rasters?.geom ?? sparse?.geom ?? null;
    const gridsOn = layers.prediction || layers.uncertainty || layers.coverage;
    if (!src || !gridsOn) return setHover(null);
    const i = bisect(src.xEdges, xv);
    const j = bisect(src.yEdges.slice().sort((a, b) => a - b), yv);
    if (i < 0 || j < 0) return setHover(null);
    const jj = src.yAscending ? j : src.ny - 1 - j;
    // Cell content changes only with the cell; the tooltip follows the pointer through a ref (no re-render).
    if (hover && hover.kind === "cell" && hover.i === i && hover.j === jj) {
      const el = tipRef.current;
      if (el) el.style.transform = tipTransform(lx + M.l, ly + M.t);
      return;
    }
    setHover({ kind: "cell", i, j: jj, x: lx + M.l, y: ly + M.t });
  };

  const xLabel = "Oxygen (% by volume)";
  const yLabel = plane === "o2_flow" ? "Airflow (cm/s, log scale)" : "Total pressure (kPa)";
  const yName = plane === "o2_flow" ? "Airflow" : "Pressure";
  const yUnit = plane === "o2_flow" ? "cm/s" : "kPa";
  const sliceName = plane === "o2_flow" ? "pressure" : "airflow";
  const sliceUnit = plane === "o2_flow" ? "kPa" : "cm/s";

  const counts = useMemo(() => {
    let s = 0;
    let n = 0;
    for (const o of vis.obs) {
      if (o.label === 1) s++;
      else if (o.label === 0) n++;
    }
    return { s, n };
  }, [vis.obs]);
  const summary = `${ariaLabel}. ${vis.obs.length} of ${observations.length} observations in view (${counts.s} flame sustained, ${counts.n} flame not sustained). Oxygen ${fmt(lo(view.x), 1)} to ${fmt(hi(view.x), 1)} percent, ${yName.toLowerCase()} ${fmt(lo(view.y))} to ${fmt(hi(view.y))} ${yUnit}.`;
  const kbdHint = "Arrows pan · + / − zoom · 0 reset · Tab to points, arrows between points, Enter select, Esc clear";

  const hasAssumed = vis.obs.some((o) => o.pressureAssumed);
  const hasUnlabelled = vis.obs.some((o) => o.label === null);
  const modelMissing = (layers.prediction || layers.uncertainty) && !rasters;
  const threshold = (coverage ?? surface)?.sparse_threshold ?? null;

  // ---- tooltip content
  const tip = (() => {
    if (!hover) return null;
    if (hover.kind === "obs") {
      const o = obsById.get(hover.id);
      if (!o) return null;
      return (
        <>
          <div className="font-medium text-fg">{o.title}</div>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-[12px]">
            <dt className="text-muted">Outcome</dt>
            <dd>{o.label === 1 ? "Flame sustained" : o.label === 0 ? "Flame not sustained" : "Not used for training"}</dd>
            <dt className="text-muted">O₂</dt><dd className="num">{fmt(o.x, 1)} %</dd>
            {plane === "o2_flow" ? (
              <><dt className="text-muted">Airflow</dt><dd className="num">{fmt(o.y)} cm/s</dd></>
            ) : (
              <><dt className="text-muted">Pressure</dt><dd className="num">{fmt(o.y, 1)} kPa{o.pressureAssumed ? " (assumed)" : ""}</dd></>
            )}
            {Object.entries(o.detail)
              .filter(([k]) => k !== "Outcome" && k !== "Oxygen" && k !== (plane === "o2_flow" ? "Airflow" : "Pressure"))
              .map(([k, v]) => (
                <span key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="break-words">{v}</dd></span>
              ))}
          </dl>
        </>
      );
    }
    if (hover.kind === "cand") {
      const g = candGroupByKey.get(`c:${hover.id}`);
      const members = g?.members ?? (candById.get(hover.id) ? [{ ...candById.get(hover.id)!, off: false }] : []);
      if (!members.length) return null;
      return (
        <>
          <div className="font-medium text-fg">{members.length > 1 ? `Research candidates ${g?.label}` : `Research candidate ${members[0]!.rank}`}</div>
          <div className="num text-[11px] text-muted">O₂ {fmt(members[0]!.x, 1)} %, {yName.toLowerCase()} {fmt(members[0]!.y)} {yUnit}</div>
          {members.length > 1 || members.some((m) => m.off) ? (
            <ul className="mt-1 space-y-0.5 text-[12px]">
              {members.map((m) => (
                <li key={m.id}>
                  <span className="num">{m.rank}</span>
                  {m.slice != null ? <span className="num"> · {sliceName} {fmt(m.slice)} {sliceUnit}</span> : null}
                  {m.off ? <span className="text-muted"> · off this slice</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      );
    }
    if (hover.kind === "ctx") {
      const c = contextPoints.find((p) => p.id === hover.id);
      if (!c) return null;
      return (
        <>
          <div className="font-medium text-fg">{c.investigation}</div>
          <div className="text-muted">{c.label}</div>
          <div className="font-mono text-[11px] tabular-nums">O2 {fmt(c.x, 1)} %, {yName.toLowerCase()} {fmt(c.y)} {yUnit}</div>
          <div className="mt-1 text-muted">Context: different apparatus, not used for modelling.</div>
        </>
      );
    }
    const gm = rasters?.geom ?? sparse?.geom;
    if (!gm) return null;
    const axisSrc = rasters ? surface : (coverage ?? surface);
    const cx = axisSrc?.x.values[hover.i];
    const cy = axisSrc?.y.values[hover.j];
    const p = surface && (hypotheticalSurface?.p_sustained ?? surface.p_sustained)?.[hover.j]?.[hover.i];
    const u = surface && (hypotheticalSurface?.latent_std_ratio ?? surface.latent_std_ratio)?.[hover.j]?.[hover.i];
    const v = surface?.verdict?.[hover.j]?.[hover.i];
    const nn = (coverage?.nn_distance ?? surface?.nn_distance)?.[hover.j]?.[hover.i];
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-[12px]">
        <dt className="text-muted">O₂</dt><dd className="num">{typeof cx === "number" ? fmt(cx, 1) : "n/a"} %</dd>
        <dt className="text-muted">{yName}</dt><dd className="num">{typeof cy === "number" ? fmt(cy) : "n/a"} {yUnit}</dd>
        {layers.prediction && (<><dt className="text-muted">P(sustained)</dt><dd className="num">{typeof p === "number" && v === "supported" ? fmt(p) : "not shown (not supported)"}</dd></>)}
        {layers.prediction && v && (<><dt className="text-muted">Verdict</dt><dd>{verdictLabel(v)}</dd></>)}
        {layers.uncertainty && (<><dt className="text-muted">Knowledge uncertainty</dt><dd className="num">{typeof u === "number" ? fmt(u) : "n/a"}</dd></>)}
        {layers.coverage && (<><dt className="text-muted">Nearest observation</dt><dd className="num">{typeof nn === "number" ? `${fmt(nn)} ref. dist.${threshold != null && nn > threshold ? " (sparse)" : ""}` : "n/a"}</dd></>)}
      </dl>
    );
  })();

  const kb = "Ctrl/Cmd + scroll or pinch to zoom, drag to pan";

  const clampX = (v: number) => Math.max(0, Math.min(iw, v));
  const clampY = (v: number) => Math.max(0, Math.min(ih, v));
  // ---- label layout: candidates are fixed obstacles; then the target label, the contour label, context labels
  const labelLayout = (() => {
    const placed: Box[] = candGroups.map((g) => ({ x: g.X - g.half - 2, y: g.Y - 13, w: g.half * 2 + 4 + (g.members.some((m) => m.off) ? 70 : 0), h: 26 }));
    const free = (b: Box) => b.x >= 0 && b.x + b.w <= iw && b.y >= 0 && b.y + b.h <= ih && !placed.some((q) => hit(q, b));
    const YYl = (v: number) => ys(yScale === "log" ? Math.max(v, 1e-3) : v);
    let tgt: { rx: number; ry: number; rw: number; rh: number; nx: number; ny: number; lab: { x: number; y: number; text: string } | null } | null = null;
    if (target) {
      const x0 = xs(target.xRange[0]);
      const x1 = xs(target.xRange[1]);
      const y0 = YYl(target.yRange[1]);
      const y1 = YYl(target.yRange[0]);
      const rx = Math.min(x0, x1);
      const ry = Math.min(y0, y1);
      const rw = Math.abs(x1 - x0);
      const rh = Math.abs(y1 - y0);
      const nx = xs(target.nominal[0]);
      const ny = YYl(target.nominal[1]);
      let text = `Target: ${target.label}`;
      const maxW = Math.max(40, iw - 8);
      while (text.length > 10 && textW(text, 11, 500) > maxW) text = `${text.slice(0, -2)}…`;
      const tw = textW(text, 11, 500);
      const cl = (x: number) => Math.max(2, Math.min(iw - tw - 2, x));
      const options: Box[] = [
        ...(rw >= tw + 8 && rh >= 22 ? [{ x: rx + 4, y: ry + 3, w: tw, h: 14 }] : []),
        { x: cl(rx), y: Math.min(ry, ny - 10) - 18, w: tw, h: 14 },
        { x: cl(rx), y: Math.min(ry, ny) - 32, w: tw, h: 14 },
        { x: cl(nx - tw / 2), y: Math.max(ry + rh, ny) + 18, w: tw, h: 14 },
        { x: cl(rx), y: Math.max(ry + rh, ny + 10) + 4, w: tw, h: 14 },
        { x: cl(nx + 16), y: ny - 7, w: tw, h: 14 },
        { x: cl(nx - tw - 16), y: ny - 7, w: tw, h: 14 },
      ];
      const pick = options.find(free) ?? options.find((b) => b.y >= 0 && b.y + b.h <= ih) ?? options[0]!;
      placed.push(pick);
      tgt = { rx, ry, rw, rh, nx, ny, lab: { x: pick.x, y: pick.y + 11, text } };
    }
    let contour: { x: number; y: number } | null = null;
    const mid = predPaths.find((c) => c.level === 0.5);
    if (layers.prediction && mid && rasters) {
      const gm = rasters.geom;
      const sortedY = gm.yEdges.slice().sort((a, b) => a - b);
      const okPt = (X: number, Y: number) => {
        const i = bisect(gm.xEdges, xs.invert(X));
        const j0 = bisect(sortedY, ys.invert(Y));
        if (i < 0 || j0 < 0) return false;
        const j = gm.yAscending ? j0 : gm.ny - 1 - j0;
        return surface?.verdict?.[j]?.[i] === "supported";
      };
      const tw = textW(CONTOUR_LABEL, 11, 500);
      const pts = mid.visPts.filter(([X, Y]) => okPt(X, Y));
      const order = pts.map((_, k) => k).sort((a, b) => Math.abs(a - pts.length / 2) - Math.abs(b - pts.length / 2));
      for (const k of order) {
        const [X, Y] = pts[k]!;
        const b = { x: Math.min(iw - tw - 2, X + 6), y: Y - 20, w: tw, h: 14 };
        if (free(b)) {
          placed.push(b);
          contour = { x: b.x, y: b.y + 11 };
          break;
        }
      }
    }
    const env = contextEnvelopes.flatMap((e, ei) => {
      const x0 = clampX(xs(e.xRange[0] ?? lo(fullX)));
      const x1 = clampX(xs(e.xRange[1] ?? hi(fullX)));
      const y0 = clampY(YYl(e.yRange[1] ?? hi(fullY)));
      const y1 = clampY(YYl(e.yRange[0] ?? lo(fullY)));
      const w = Math.abs(x1 - x0);
      const h = Math.abs(y1 - y0);
      if (w < 1 || h < 1) return [];
      const x = Math.min(x0, x1);
      const y = Math.min(y0, y1);
      // Readable tag (e.g. "Saffire-VI") instead of a numbered code; drawn only where it fits, full name on hover.
      const badge = e.short || `C${ei + 1}`;
      const bw = textW(badge, 10) + 2;
      let lab: { x: number; y: number } | null = null;
      if (w >= bw + 6 && h >= 16) {
        for (const b of [{ x: x + 3, y: y + 2, w: bw, h: 12 }, { x: x + w - bw - 3, y: y + 2, w: bw, h: 12 }, { x: x + 3, y: y + h - 14, w: bw, h: 12 }]) {
          if (free(b)) {
            placed.push(b);
            lab = { x: b.x + 1, y: b.y + 10 };
            break;
          }
        }
      }
      return [{ id: e.id, x, y, w, h, badge, label: e.label, lab }];
    });
    return { tgt, contour, env };
  })();
  const tgt = labelLayout.tgt;
  const contourLabel = labelLayout.contour;
  const envBoxes = labelLayout.env;

  // ---- annotation geometry
  const YY = (v: number) => ys(yScale === "log" ? Math.max(v, 1e-3) : v);

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-muted" id={`${uid}-hint`}>{asTable ? "Table of observations currently in view." : wrapFocus ? kbdHint : `${kb}; focus the map for keyboard controls`}</p>
        <div className="flex items-center gap-1.5">
          {!asTable && (
            <>
              <Button size="sm" aria-label="Zoom in" onClick={() => zoomBy(1.4)}>+</Button>
              <Button size="sm" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.4)}>&minus;</Button>
              <Button size="sm" onClick={resetView}>Reset view</Button>
            </>
          )}
          <Button size="sm" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
            {asTable ? "View as map" : "View as table"}
          </Button>
        </div>
      </div>

      {asTable ? (
        <div className="max-h-[520px] overflow-auto rounded-md border border-border" tabIndex={0} role="region" aria-label={`${ariaLabel}, table view`}>
          <table className="w-full border-collapse text-[12px]">
            <caption className="sr-only">{summary}</caption>
            <thead className="sticky top-0 bg-subtle text-left">
              <tr>
                {["Observation", "Experiment", "O2 (%)", `${yName} (${yUnit})`, "Outcome", "Pressure"].map((h) => (
                  <th key={h} scope="col" className="border-b border-border px-2 py-1.5 font-medium text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {vis.obs.length === 0 && (
                <tr><td colSpan={6} className="px-2 py-3 font-sans text-muted">No observations in the current view or layer selection.</td></tr>
              )}
              {vis.obs.map((o) => (
                <tr key={o.id} className={o.id === selectedObservationId ? "bg-accent-tint" : "border-b border-border"}>
                  <td className="px-2 py-1 font-sans">
                    <button type="button" className="text-left underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent" onClick={() => onSelectObservation?.(o.id)}>{o.title}</button>
                  </td>
                  <td className="px-2 py-1 font-sans">{o.experimentId}</td>
                  <td className="px-2 py-1">{fmt(o.x, 1)}</td>
                  <td className="px-2 py-1">{fmt(o.y)}</td>
                  <td className="px-2 py-1 font-sans">{o.label === 1 ? "sustained" : o.label === 0 ? "not sustained" : "not determined"}</td>
                  <td className="px-2 py-1 font-sans">{o.pressureAssumed ? "assumed" : "measured"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={wrapRef}
          className={`relative w-full select-none bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${heightProp === undefined ? plotClassName ?? "h-[520px]" : ""}`}
          style={heightProp === undefined ? undefined : { height: heightProp }}
          tabIndex={0}
          role="group"
          aria-label={summary}
          aria-describedby={`${uid}-hint`}
          onKeyDown={onWrapKey}
          onFocus={(e) => { if (e.target === e.currentTarget) setWrapFocus(true); }}
          onBlur={() => setWrapFocus(false)}
          onPointerLeave={() => setHover(null)}
        >
          <canvas ref={canvasRef} className="pointer-events-none absolute left-0 top-0" style={{ width, height }} aria-hidden />
          <svg width={width} height={height} role="none" className="absolute left-0 top-0" style={{ overflow: "visible" }}>
            <defs>
              <clipPath id={`${uid}-plot`}><rect x={0} y={0} width={iw} height={ih} /></clipPath>
              {supportedClip && (
                <clipPath id={`${uid}-sup`}>
                  {supportedClip.map((r, k) => <rect key={k} x={r.x} y={r.y} width={r.w} height={r.h} />)}
                </clipPath>
              )}
            </defs>
            {/* axes + grid (under content, outside zoom group) */}
            <g transform={`translate(${M.l},${M.t})`} aria-hidden>
              {xT.map((t) => (
                <g key={`x${t}`}>
                  <line x1={xs(t)} x2={xs(t)} y1={0} y2={ih} stroke="var(--border)" strokeWidth={1} opacity={0.7} />
                  <line x1={xs(t)} x2={xs(t)} y1={ih} y2={ih + 4} stroke="var(--border-strong)" />
                  <text x={xs(t)} y={ih + 17} textAnchor="middle" fontSize={11} className="font-mono" fill={MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>{fmtTick(t)}</text>
                </g>
              ))}
              {yT.map((t) => (
                <g key={`y${t}`}>
                  <line y1={ys(t)} y2={ys(t)} x1={0} x2={iw} stroke="var(--border)" strokeWidth={1} opacity={0.7} />
                  <line y1={ys(t)} y2={ys(t)} x1={-4} x2={0} stroke="var(--border-strong)" />
                  <text x={-8} y={ys(t) + 4} textAnchor="end" fontSize={11} className="font-mono" fill={MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>{fmtTick(t)}</text>
                </g>
              ))}
              <rect x={0} y={0} width={iw} height={ih} fill="none" stroke="var(--border-strong)" />
              <text x={iw / 2} y={ih + 38} textAnchor="middle" fontSize={12} fill={INK}>{xLabel}</text>
              <text transform={`translate(${-44},${ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fill={INK}>{yLabel}</text>
            </g>

            {/* interactive plot group (zoom target) */}
            <g ref={zoomRef} transform={`translate(${M.l},${M.t})`} style={{ cursor: "grab" }}>
              <rect x={0} y={0} width={iw} height={ih} fill="transparent" onPointerMove={onPlotMove} onPointerLeave={() => setHover(null)} onClick={() => { onSelectObservation?.(null); onSelectCandidate?.(null); }} />
              <g clipPath={`url(#${uid}-plot)`}>
                {layers.coverage && sparsePath && <path d={sparsePath} fill="none" stroke={GAP} strokeWidth={1} pointerEvents="none" />}

                {layers.prediction && predPaths.length > 0 && (
                  <g clipPath={supportedClip ? `url(#${uid}-sup)` : undefined} pointerEvents="none">
                    {predPaths.map((c) => (
                      <path key={c.level} d={c.d} fill="none" stroke={INK} strokeWidth={c.level === 0.5 ? 1.75 : 1} opacity={c.level === 0.5 ? 1 : 0.55} strokeDasharray={c.level === 0.5 ? undefined : "4 3"} strokeLinejoin="round" />
                    ))}
                  </g>
                )}

                {layers.context && envBoxes.map((b) => (
                  <g key={b.id} pointerEvents="none">
                    <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke={MUTED} strokeOpacity={0.45} strokeWidth={1} strokeDasharray="2 3" />
                    {b.lab && (
                      <text x={b.lab.x} y={b.lab.y} fontSize={10} fill={MUTED} stroke="var(--surface)" strokeWidth={3} paintOrder="stroke">{b.badge}<title>{`${b.label}: documented test conditions, not integrated into the model`}</title></text>
                    )}
                  </g>
                ))}

                {layers.target && tgt && (
                  <g pointerEvents="none">
                    <rect x={tgt.rx} y={tgt.ry} width={tgt.rw} height={tgt.rh} fill="none" stroke={INK} strokeWidth={1.5} strokeDasharray="6 3" />
                    <path d={`M${tgt.nx - 8},${tgt.ny}H${tgt.nx + 8}M${tgt.nx},${tgt.ny - 8}V${tgt.ny + 8}`} stroke={INK} strokeWidth={1.5} />
                  </g>
                )}

                {layers.context && contextPoints.map((c) => {
                  const X = xs(c.x);
                  const Y = YY(c.y);
                  return (
                    <g
                      key={c.id}
                      tabIndex={0}
                      role="img"
                      aria-label={`Context test (not modelled): ${c.investigation}, ${c.label}, oxygen ${fmt(c.x, 1)} percent, ${yName.toLowerCase()} ${fmt(c.y)} ${yUnit}`}
                      style={{ outline: "none" }}
                      onPointerEnter={() => setHover({ kind: "ctx", id: c.id, x: X + M.l, y: Y + M.t })}
                      onPointerLeave={() => setHover(null)}
                      onFocus={() => { setFocusKey(`x:${c.id}`); setHover({ kind: "ctx", id: c.id, x: X + M.l, y: Y + M.t }); }}
                      onBlur={() => { setFocusKey(null); setHover(null); }}
                    >
                      {focusKey === `x:${c.id}` && <circle cx={X} cy={Y} r={9} fill="none" stroke={ACCENT} strokeWidth={2} />}
                      <circle cx={X} cy={Y} r={9} fill="transparent" />
                      <path d={`M${X},${Y - 4.5}L${X + 4},${Y + 3}H${X - 4}Z`} fill="var(--surface)" stroke={MUTED} strokeWidth={1} />
                    </g>
                  );
                })}

                {vis.obs.map((o) => {
                  const key = `o:${o.id}`;
                  const X = xs(o.x);
                  const Y = ys(o.y);
                  const sel = o.id === selectedObservationId;
                  const hl = highlight.has(o.id);
                  const fill = o.label === 1 ? OBSERVED : o.label === 0 ? "var(--surface)" : "var(--observed-tint)";
                  return (
                    <g
                      key={key}
                      id={`${uid}-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
                      role="button"
                      tabIndex={tabKey === key ? 0 : -1}
                      aria-pressed={sel}
                      aria-label={`${o.title}, oxygen ${fmt(o.x, 1)} percent, ${yName.toLowerCase()} ${fmt(o.y)} ${yUnit}, ${o.label === 1 ? "flame sustained" : o.label === 0 ? "not sustained" : "outcome not determined"}${o.pressureAssumed ? ", pressure assumed" : ""}`}
                      style={{ outline: "none", cursor: "pointer" }}
                      onClick={(e) => { e.stopPropagation(); onSelectObservation?.(sel ? null : o.id); }}
                      onKeyDown={(e) => onItemKey(e, items.find((i) => i.key === key) ?? { key, kind: "obs", id: o.id, px: X, py: Y })}
                      onPointerEnter={() => setHover({ kind: "obs", id: o.id, x: X + M.l, y: Y + M.t })}
                      onPointerLeave={() => setHover(null)}
                      onFocus={() => { setActiveKey(key); setFocusKey(key); setHover({ kind: "obs", id: o.id, x: X + M.l, y: Y + M.t }); }}
                      onBlur={() => { setFocusKey(null); setHover(null); }}
                    >
                      <circle cx={X} cy={Y} r={10} fill="transparent" />
                      {o.pressureAssumed && <circle cx={X} cy={Y} r={7} fill="none" stroke={OBSERVED} strokeWidth={0.75} strokeOpacity={0.45} strokeDasharray="2 2" />}
                      <circle cx={X} cy={Y} r={4.5} fill={fill} stroke={o.label === 1 ? "var(--surface)" : OBSERVED} strokeWidth={o.label === 1 ? 1 : 1.5} />
                      {hl && <circle cx={X} cy={Y} r={9.5} fill="none" stroke={ACCENT} strokeWidth={1.5} />}
                      {(sel || focusKey === key) && <circle cx={X} cy={Y} r={12} fill="none" stroke={ACCENT} strokeWidth={2.5} />}
                    </g>
                  );
                })}

                {[...candGroups].reverse().map((g) => {
                  const { key, X, Y, half } = g;
                  const top = g.members[0]!;
                  const sel = g.members.some((m) => m.id === selectedCandidateId);
                  const offRanks = g.members.filter((m) => m.off).map((m) => m.rank);
                  const shape = (h: number, e: number) => `M${X - h - e},${Y}L${X - h + 11},${Y - 11 - e}H${X + h - 11}L${X + h + e},${Y}L${X + h - 11},${Y + 11 + e}H${X - h + 11}Z`;
                  const desc = g.members
                    .map((m) => `Research candidate ${m.rank}${m.slice != null ? `, ${sliceName} ${fmt(m.slice)} ${sliceUnit}` : ""}${m.off ? ", off this slice" : ""}`)
                    .join("; ");
                  return (
                    <g
                      key={key}
                      id={`${uid}-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
                      role="button"
                      tabIndex={tabKey === key ? 0 : -1}
                      aria-pressed={sel}
                      aria-label={`${desc}. Oxygen ${fmt(top.x, 1)} percent, ${yName.toLowerCase()} ${fmt(top.y)} ${yUnit}`}
                      style={{ outline: "none", cursor: "pointer" }}
                      onClick={(e) => { e.stopPropagation(); onSelectCandidate?.(sel ? null : top.id); }}
                      onKeyDown={(e) => onItemKey(e, items.find((i) => i.key === key) ?? { key, kind: "cand", id: top.id, px: X, py: Y })}
                      onPointerEnter={() => setHover({ kind: "cand", id: top.id, x: X + M.l, y: Y + M.t })}
                      onPointerLeave={() => setHover(null)}
                      onFocus={() => { setActiveKey(key); setFocusKey(key); setHover({ kind: "cand", id: top.id, x: X + M.l, y: Y + M.t }); }}
                      onBlur={() => { setFocusKey(null); setHover(null); }}
                    >
                      <path
                        d={shape(half, 0)}
                        fill={g.anyOn ? ACCENT : "var(--surface)"}
                        stroke={g.anyOn ? "var(--surface)" : ACCENT}
                        strokeWidth={1.5}
                      />
                      <text x={X} y={Y + 3.5} textAnchor="middle" fontSize={10} fontWeight={600} fill={g.anyOn ? "#fff" : ACCENT} pointerEvents="none" style={{ fontVariantNumeric: "tabular-nums" }}>{g.label}</text>
                      {offRanks.length > 0 && (
                        <text x={X + half + 5} y={Y + 3.5} fontSize={10} fill={MUTED} stroke="var(--surface)" strokeWidth={3} paintOrder="stroke" pointerEvents="none">
                          {offRanks.length === g.members.length ? "off-slice" : `${offRanks.join(", ")} off-slice`}
                        </text>
                      )}
                      {(sel || focusKey === key) && <path d={shape(half, 4)} fill="none" stroke={INK} strokeWidth={2} />}
                    </g>
                  );
                })}
              </g>
            </g>

            {/* labels that must sit above everything */}
            <g transform={`translate(${M.l},${M.t})`} pointerEvents="none" clipPath={`url(#${uid}-plot)`}>
              {layers.target && tgt?.lab && (
                <text x={tgt.lab.x} y={tgt.lab.y} fontSize={11} fontWeight={500} fill={INK} stroke="var(--surface)" strokeWidth={3} paintOrder="stroke">{tgt.lab.text}</text>
              )}
              {contourLabel && (
                <text x={contourLabel.x} y={contourLabel.y} fontSize={11} fontWeight={500} fill={INK} stroke="var(--surface)" strokeWidth={3.5} paintOrder="stroke">{CONTOUR_LABEL}</text>
              )}
              {layers.prediction && rasters && !rasters.supportedRuns.length && (
                <text x={iw / 2} y={ih - 12} textAnchor="middle" fontSize={12} fill={MUTED} stroke="var(--surface)" strokeWidth={4} paintOrder="stroke">No supported model estimate on this slice; P(sustained) is not drawn.</text>
              )}
              {wholeGap && (
                <text x={iw / 2} y={ih - 12} textAnchor="middle" fontSize={12} fill={MUTED} stroke="var(--surface)" strokeWidth={4} paintOrder="stroke">Sparse coverage across this whole slice</text>
              )}
              {modelMissing && (
                <text x={iw / 2} y={ih / 2} textAnchor="middle" fontSize={13} fill={MUTED} stroke="var(--surface)" strokeWidth={4} paintOrder="stroke">No fitted model grid for this group: prediction and uncertainty are not available.</text>
              )}
              {hypotheticalSurface && (layers.prediction || layers.uncertainty) && (
                <text x={8} y={16} fontSize={11} fill={INK} stroke="var(--surface)" strokeWidth={3} paintOrder="stroke">What-if surface (hypothetical observation added)</text>
              )}
            </g>
          </svg>
          {hover && tip && (
            <div
              ref={tipRef}
              role="tooltip"
              className="pointer-events-none absolute left-0 top-0 z-10 w-max max-w-[260px] rounded-md bg-surface px-2.5 py-2 text-[12px] shadow-popover"
              style={{ transform: tipTransform(hover.x, hover.y) }}
            >
              {tip}
            </div>
          )}
        </div>
      )}
      <MapLegend
        className="mt-3"
        layers={layers}
        plane={plane}
        sparseThreshold={threshold}
        hasAssumed={hasAssumed}
        hasUnlabelled={hasUnlabelled}
        hasHypothetical={!!hypotheticalSurface}
        hasContextEnvelopes={contextEnvelopes.length > 0}
        hasContextPoints={contextPoints.length > 0}
        hasTarget={!!target}
        hasCandidates={candidates.length > 0}
        modelMissing={modelMissing}
      />
    </div>
  );
}
