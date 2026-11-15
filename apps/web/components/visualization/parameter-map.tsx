"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { contours as d3contours, type ContourMultiPolygon } from "d3-contour";
import { scaleLinear, scaleLog } from "d3-scale";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity } from "d3-zoom";
import { Button } from "@/components/ui/button";
import type { CoverageResponse, SurfaceResponse } from "@/lib/types";
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
  candidates?: Array<{ id: string; rank: number; x: number; y: number; title: string }>;
  contextEnvelopes?: Array<{ id: string; label: string; xRange: [number | null, number | null]; yRange: [number | null, number | null] }>;
  contextPoints?: Array<{ id: string; x: number; y: number; label: string; investigation: string }>;
  highlightObservationIds?: string[];
  selectedObservationId?: string | null;
  selectedCandidateId?: string | null;
  viewDomain?: ViewDomain | null;
  onViewDomainChange?: (d: ViewDomain) => void;
  onSelectObservation?: (id: string | null) => void;
  onSelectCandidate?: (id: string | null) => void;
  height?: number;
  ariaLabel: string;
};

const M = { l: 58, r: 18, t: 12, b: 46 };
const CONTOUR_LEVELS = [0.1, 0.5, 0.9];

type Grid = number[][];
type Item = { key: string; kind: "obs" | "cand"; id: string; px: number; py: number };
type Hover =
  | { kind: "obs"; id: string; x: number; y: number }
  | { kind: "cand"; id: string; x: number; y: number }
  | { kind: "ctx"; id: string; x: number; y: number }
  | { kind: "cell"; i: number; j: number; x: number; y: number; px: number; py: number };

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
  const supported = (i: number, j: number) => (verdict ? verdictAt(i, j) !== "insufficient_evidence" : true);

  let unc: HTMLCanvasElement | null = null;
  let pred: HTMLCanvasElement | null = null;
  let hasExtrapolation = false;
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
          const ext = verdictAt(i, j) === "extrapolation";
          if (ext) hasExtrapolation = true;
          pc[1].data[o] = 23;
          pc[1].data[o + 1] = 23;
          pc[1].data[o + 2] = 26;
          pc[1].data[o + 3] = Math.round(255 * (0.03 + 0.17 * Math.min(1, Math.max(0, v))) * (ext ? 0.55 : 1));
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
    const flat = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = at(p[j], i);
      flat[j * nx + i] = typeof v === "number" && Number.isFinite(v) ? v : 0;
    }
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
    plane, xDomain, yDomain, yScale, observations, coverage, surface, hypotheticalSurface, layers, target,
    candidates = [], contextEnvelopes = [], contextPoints = [], highlightObservationIds, selectedObservationId,
    selectedCandidateId, viewDomain, onViewDomainChange, onSelectObservation, onSelectCandidate, height = 520, ariaLabel,
  } = props;
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

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => {
      const w = e[0]?.contentRect.width;
      if (w && w > 120) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [asTable]);

  const domKey = `${xDomain.join(",")}|${yDomain.join(",")}|${yScale}|${plane}`;
  const internal = internalRaw && internalRaw.key === domKey ? internalRaw.v : null;
  const setInternal = useCallback((v: ViewDomain | null) => setInternalRaw(v ? { key: domKey, v } : null), [domKey]);

  const view: ViewDomain = useMemo(() => viewDomain ?? internal ?? { x: xDomain, y: yDomain }, [viewDomain, internal, xDomain, yDomain]);
  const iw = Math.max(50, width - M.l - M.r);
  const ih = Math.max(50, height - M.t - M.b);

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
    live.current.onViewDomainChange?.({ x: xDomain, y: yDomain });
  }, [xDomain, yDomain, setInternal]);

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
        if (layers.coverage) ctx.globalAlpha = 0.5;
        ctx.drawImage(rasters.unc, rx, ry, rw, rh);
        ctx.restore();
      }
      if (layers.prediction && rasters.pred) ctx.drawImage(rasters.pred, rx, ry, rw, rh);
      if (layers.prediction && rasters.insufficientRuns.length) {
        const pat = hatchPattern(ctx, "rgba(107,106,101,0.45)", dpr, 6);
        if (pat) {
          ctx.save();
          runsPath(rasters.geom, rasters.insufficientRuns);
          ctx.clip();
          ctx.fillStyle = pat;
          ctx.fillRect(0, 0, iw, ih);
          ctx.restore();
        }
      }
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
        ctx.globalAlpha = 1;
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "rgba(107,106,101,1)";
        ctx.textAlign = "center";
        ctx.fillText("No supported estimate in this slice", iw / 2, Math.min(ih - 8, 18));
        ctx.restore();
      }
      const pat = whole ? null : hatchPattern(ctx, GAP, dpr, 8);
      if (pat) {
        ctx.save();
        runsPath(sparse.geom, sparse.runs);
        ctx.clip();
        ctx.globalAlpha = 0.6;
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
      let best: Array<[number, number]> = [];
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
          const vis = cur.filter(([X, Y]) => X > 24 && X < iw - 24 && Y > 14 && Y < ih - 14);
          if (vis.length > best.length) best = vis;
          pts.push(...cur);
        }
      }
      return { d, labelPt: best.length ? best[Math.floor(best.length / 2)]! : null };
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
    if (!layers.prediction || !rasters || !rasters.hasInsufficient) return null;
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

  const items: Item[] = useMemo(
    () => [
      ...vis.obs.map((o) => ({ key: `o:${o.id}`, kind: "obs" as const, id: o.id, px: xs(o.x), py: ys(o.y) })),
      ...vis.cands.map((c) => ({ key: `c:${c.id}`, kind: "cand" as const, id: c.id, px: xs(c.x), py: ys(c.y) })),
    ],
    [vis, xs, ys],
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
      else onSelectCandidate?.(it.id === selectedCandidateId ? null : it.id);
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
    setHover({ kind: "cell", i, j: src.yAscending ? j : src.ny - 1 - j, x: xv, y: yv, px: lx + M.l, py: ly + M.t });
  };

  const xLabel = "Oxygen (% by volume)";
  const yLabel = plane === "o2_flow" ? "Airflow (cm/s, log scale)" : "Total pressure (kPa)";
  const yName = plane === "o2_flow" ? "Airflow" : "Pressure";
  const yUnit = plane === "o2_flow" ? "cm/s" : "kPa";

  const counts = useMemo(() => {
    let s = 0;
    let n = 0;
    for (const o of vis.obs) {
      if (o.label === 1) s++;
      else if (o.label === 0) n++;
    }
    return { s, n };
  }, [vis.obs]);
  const summary = `${ariaLabel}. ${vis.obs.length} of ${observations.length} observations in view (${counts.s} flame sustained, ${counts.n} not sustained). Oxygen ${fmt(lo(view.x), 1)} to ${fmt(hi(view.x), 1)} percent, ${yName.toLowerCase()} ${fmt(lo(view.y))} to ${fmt(hi(view.y))} ${yUnit}. Focus the map, then use arrow keys to pan, plus and minus to zoom, 0 to reset, arrow keys to move between points, Tab to leave the map, Enter to select, Escape to clear.`;

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
          <div className="text-muted">Experiment {o.experimentId}</div>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 font-mono text-[11px] tabular-nums">
            <dt className="text-muted">O2</dt><dd>{fmt(o.x, 1)} %</dd>
            <dt className="text-muted">{yName}</dt><dd>{fmt(o.y)} {yUnit}</dd>
            <dt className="text-muted">Outcome</dt>
            <dd>{o.label === 1 ? "flame sustained" : o.label === 0 ? "not sustained" : "not determined"}</dd>
            <dt className="text-muted">Pressure</dt><dd>{o.pressureAssumed ? "assumed" : "measured"}</dd>
            {Object.entries(o.detail).map(([k, v]) => (
              <span key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="break-words font-sans">{v}</dd></span>
            ))}
          </dl>
        </>
      );
    }
    if (hover.kind === "cand") {
      const c = candById.get(hover.id);
      if (!c) return null;
      return (
        <>
          <div className="font-medium text-fg">Candidate {c.rank}: {c.title}</div>
          <div className="font-mono text-[11px] tabular-nums text-muted">O2 {fmt(c.x, 1)} %, {yName.toLowerCase()} {fmt(c.y)} {yUnit}</div>
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
    const p = surface && (hypotheticalSurface?.p_sustained ?? surface.p_sustained)?.[hover.j]?.[hover.i];
    const u = surface && (hypotheticalSurface?.latent_std_ratio ?? surface.latent_std_ratio)?.[hover.j]?.[hover.i];
    const v = surface?.verdict?.[hover.j]?.[hover.i];
    const nn = (coverage?.nn_distance ?? surface?.nn_distance)?.[hover.j]?.[hover.i];
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 font-mono text-[11px] tabular-nums">
        <dt className="text-muted">O2</dt><dd>{fmt(hover.x, 1)} %</dd>
        <dt className="text-muted">{yName}</dt><dd>{fmt(hover.y)} {yUnit}</dd>
        {layers.prediction && (<><dt className="text-muted">p(sustained)</dt><dd>{typeof p === "number" && v !== "insufficient_evidence" ? fmt(p) : "no supported estimate"}</dd></>)}
        {layers.prediction && v && (<><dt className="text-muted">Verdict</dt><dd>{v.replace("_", " ")}</dd></>)}
        {layers.uncertainty && (<><dt className="text-muted">Std ratio</dt><dd>{typeof u === "number" ? fmt(u) : "n/a"}</dd></>)}
        {layers.coverage && (<><dt className="text-muted">Nearest obs.</dt><dd>{typeof nn === "number" ? `${fmt(nn)} ${threshold != null && nn > threshold ? "(sparse)" : ""}` : "n/a"}</dd></>)}
      </dl>
    );
  })();

  const kb = "Ctrl/Cmd + scroll or pinch to zoom, drag to pan";

  // ---- annotation geometry
  const YY = (v: number) => ys(yScale === "log" ? Math.max(v, 1e-3) : v);
  const clampX = (v: number) => Math.max(0, Math.min(iw, v));
  const clampY = (v: number) => Math.max(0, Math.min(ih, v));

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-muted" id={`${uid}-hint`}>{asTable ? "Table of observations currently in view." : kb}</p>
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
          className="relative w-full select-none rounded-md border border-border bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{ height }}
          tabIndex={0}
          role="group"
          aria-label={summary}
          aria-describedby={`${uid}-hint`}
          onKeyDown={onWrapKey}
          onPointerLeave={() => setHover(null)}
        >
          <canvas ref={canvasRef} className="pointer-events-none absolute left-0 top-0" style={{ width, height }} aria-hidden />
          <svg width={width} height={height} className="absolute left-0 top-0" style={{ overflow: "visible" }}>
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
                      <path key={c.level} d={c.d} fill="none" stroke={INK} strokeWidth={c.level === 0.5 ? 2 : 1} opacity={c.level === 0.5 ? 1 : 0.6} strokeLinejoin="round" />
                    ))}
                  </g>
                )}

                {layers.context && contextEnvelopes.map((e, ei) => {
                  const x0 = clampX(xs(e.xRange[0] ?? lo(xDomain)));
                  const x1 = clampX(xs(e.xRange[1] ?? hi(xDomain)));
                  const y0 = clampY(YY(e.yRange[1] ?? hi(yDomain)));
                  const y1 = clampY(YY(e.yRange[0] ?? lo(yDomain)));
                  const w = Math.abs(x1 - x0);
                  const h = Math.abs(y1 - y0);
                  if (w < 1 || h < 1) return null;
                  const badge = `C${ei + 1}`;
                  return (
                    <g key={e.id} pointerEvents="none">
                      <rect x={Math.min(x0, x1)} y={Math.min(y0, y1)} width={w} height={h} fill="none" stroke={MUTED} strokeWidth={1} strokeDasharray="3 3" />
                      <rect x={Math.min(x0, x1)} y={Math.min(y0, y1)} width={20} height={13} fill="var(--surface)" stroke={MUTED} strokeWidth={1} />
                      <text x={Math.min(x0, x1) + 10} y={Math.min(y0, y1) + 10} fontSize={9.5} textAnchor="middle" fill={MUTED}>{badge}</text>
                      <title>{`${badge}: ${e.label}: documented test conditions (not integrated)`}</title>
                    </g>
                  );
                })}

                {layers.target && target && (() => {
                  const x0 = xs(target.xRange[0]);
                  const x1 = xs(target.xRange[1]);
                  const y0 = YY(target.yRange[1]);
                  const y1 = YY(target.yRange[0]);
                  const nx = xs(target.nominal[0]);
                  const ny = YY(target.nominal[1]);
                  const rx = Math.min(x0, x1);
                  const ry = Math.min(y0, y1);
                  const ly = ry < 14 ? ry + 12 : ry - 5;
                  return (
                    <g pointerEvents="none">
                      <rect x={rx} y={ry} width={Math.abs(x1 - x0)} height={Math.abs(y1 - y0)} fill="none" stroke={INK} strokeWidth={1.5} strokeDasharray="6 3" />
                      <path d={`M${nx - 8},${ny}H${nx + 8}M${nx},${ny - 8}V${ny + 8}`} stroke={INK} strokeWidth={1.5} />
                      <text x={Math.max(2, rx)} y={ly} fontSize={11} fontWeight={500} fill={INK} stroke="var(--surface)" strokeWidth={3} paintOrder="stroke">{`Target: ${target.label}`}</text>
                    </g>
                  );
                })()}

                {layers.context && contextPoints.map((c) => {
                  const X = xs(c.x);
                  const Y = YY(c.y);
                  return (
                    <g key={c.id} onPointerEnter={() => setHover({ kind: "ctx", id: c.id, x: X + M.l, y: Y + M.t })} onPointerLeave={() => setHover(null)}>
                      <circle cx={X} cy={Y} r={9} fill="transparent" />
                      <path d={`M${X},${Y - 5}L${X + 4.5},${Y + 3.5}H${X - 4.5}Z`} fill="var(--surface)" stroke={MUTED} strokeWidth={1.2} />
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
                      {o.pressureAssumed && <circle cx={X} cy={Y} r={7.5} fill="none" stroke={OBSERVED} strokeWidth={1} strokeDasharray="2 2" />}
                      <circle cx={X} cy={Y} r={4.5} fill={fill} stroke={o.label === 1 ? "var(--surface)" : OBSERVED} strokeWidth={o.label === 1 ? 1 : 1.5} />
                      {hl && <circle cx={X} cy={Y} r={9.5} fill="none" stroke={ACCENT} strokeWidth={1.5} />}
                      {(sel || focusKey === key) && <circle cx={X} cy={Y} r={12} fill="none" stroke={ACCENT} strokeWidth={2.5} />}
                    </g>
                  );
                })}

                {vis.cands.map((c) => {
                  const key = `c:${c.id}`;
                  const X = xs(c.x);
                  const Y = ys(c.y);
                  const sel = c.id === selectedCandidateId;
                  return (
                    <g
                      key={key}
                      id={`${uid}-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
                      role="button"
                      tabIndex={tabKey === key ? 0 : -1}
                      aria-pressed={sel}
                      aria-label={`Candidate ${c.rank}: ${c.title}, oxygen ${fmt(c.x, 1)} percent, ${yName.toLowerCase()} ${fmt(c.y)} ${yUnit}`}
                      style={{ outline: "none", cursor: "pointer" }}
                      onClick={(e) => { e.stopPropagation(); onSelectCandidate?.(sel ? null : c.id); }}
                      onKeyDown={(e) => onItemKey(e, items.find((i) => i.key === key) ?? { key, kind: "cand", id: c.id, px: X, py: Y })}
                      onPointerEnter={() => setHover({ kind: "cand", id: c.id, x: X + M.l, y: Y + M.t })}
                      onPointerLeave={() => setHover(null)}
                      onFocus={() => { setActiveKey(key); setFocusKey(key); setHover({ kind: "cand", id: c.id, x: X + M.l, y: Y + M.t }); }}
                      onBlur={() => { setFocusKey(null); setHover(null); }}
                    >
                      <path d={`M${X},${Y - 11}L${X + 11},${Y}L${X},${Y + 11}L${X - 11},${Y}Z`} fill={ACCENT} stroke="var(--surface)" strokeWidth={1.5} />
                      <text x={X} y={Y + 3.5} textAnchor="middle" fontSize={10} fontWeight={600} fill="#fff" pointerEvents="none">{c.rank}</text>
                      {(sel || focusKey === key) && <path d={`M${X},${Y - 15}L${X + 15},${Y}L${X},${Y + 15}L${X - 15},${Y}Z`} fill="none" stroke={INK} strokeWidth={2} />}
                    </g>
                  );
                })}
              </g>
            </g>

            {/* labels that must sit above everything */}
            <g transform={`translate(${M.l},${M.t})`} pointerEvents="none" clipPath={`url(#${uid}-plot)`}>
              {(() => {
                const mid = predPaths.find((c) => c.level === 0.5);
                if (!layers.prediction || !mid?.labelPt) return null;
                const [X, Y] = mid.labelPt;
                return (
                  <text x={X + 6} y={Y - 6} fontSize={11} fontWeight={500} fill={INK} stroke="var(--surface)" strokeWidth={3.5} paintOrder="stroke">predicted flammability boundary (p = 0.5)</text>
                );
              })()}
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
              role="tooltip"
              className="pointer-events-none absolute z-10 max-w-[260px] rounded-md bg-surface px-2.5 py-2 text-[12px] shadow-popover"
              style={{
                left: Math.min(hover.x + 14, Math.max(8, width - 270)),
                top: Math.max(8, Math.min(hover.kind === "cell" ? hover.py + 14 : hover.y + 14, height - 150)),
              }}
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
