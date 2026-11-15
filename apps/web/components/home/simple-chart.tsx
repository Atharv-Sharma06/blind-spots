"use client";

import * as React from "react";
import { scaleLinear } from "d3-scale";
import { convexHull, paddedDomain, placeLabels, textWidth, type LabelItem } from "./simple-chart-model";

/** One ISS test result for the selected material. `burned`: the flame kept burning (filled dot); else it went out (hollow). */
export interface ChartDot {
  id: string;
  x: number;
  y: number;
  burned: boolean;
}

/** A cabin's air on the chart: `x`/`y` is its marker; `xLo..xHi` / `yLo..yHi` its documented range (equal when it is a single value). */
export interface ChartCabin {
  id: string;
  label: string;
  x: number;
  y: number;
  xLo: number;
  xHi: number;
  yLo: number;
  yHi: number;
}

export interface SimpleChartProps {
  dots: readonly ChartDot[];
  cabin: ChartCabin;
  others: readonly ChartCabin[];
  /** Kept for compatibility. The shaded region is always labelled "ISS tests". */
  regionLabel?: string;
  /** One sentence for screen readers (role="img"). */
  ariaLabel: string;
}

/** Heights are fixed by CSS before and after measuring, so nothing shifts while loading. */
export const CHART_HEIGHT_CLASS = "h-[300px] sm:h-[380px]";

function useBox<T extends HTMLElement>(): [React.RefObject<T | null>, { w: number; h: number }] {
  const ref = React.useRef<T | null>(null);
  const [box, setBox] = React.useState({ w: 0, h: 0 });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setBox((b) => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box];
}

const REGION_TEXT = "ISS tests";
const trim = (n: number) => String(Math.round(n * 10) / 10);

export function SimpleChart(props: SimpleChartProps) {
  const [ref, box] = useBox<HTMLDivElement>();
  return (
    <div ref={ref} className={`w-full ${CHART_HEIGHT_CLASS}`} data-testid="simple-chart">
      {box.w > 0 && box.h > 0 ? <ChartSvg {...props} width={box.w} height={box.h} /> : null}
    </div>
  );
}

const INK = "var(--fg)";
const MUTED = "var(--muted)";
const BLUE = "var(--observed)";
const YELLOW = "var(--accent)";
const HALO = { paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4, strokeLinejoin: "round" } as const;
const NUM = { fontVariantNumeric: "tabular-nums" } as const;

function ChartSvg({ dots, cabin, others, ariaLabel, width, height }: SimpleChartProps & { width: number; height: number }) {
  const narrow = width < 480;
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [hover, setHover] = React.useState<number | null>(null);
  const m = { t: 14, r: narrow ? 14 : 22, b: narrow ? 42 : 44, l: narrow ? 46 : 50 };
  const iw = Math.max(width - m.l - m.r, 10);
  const ih = Math.max(height - m.t - m.b, 10);

  const geo = React.useMemo(() => {
    const xd = paddedDomain([...dots.map((d) => d.x), cabin.xLo, cabin.xHi], { minSpan: 8, min: 0, max: 105 });
    const yd = paddedDomain([...dots.map((d) => d.y), cabin.yLo, cabin.yHi], { minSpan: 8, min: 0, max: 105 });
    const x = scaleLinear().domain(xd).range([0, iw]);
    const y = scaleLinear().domain(yd).range([ih, 0]);
    const hull = convexHull(dots.map((d) => ({ x: d.x, y: d.y }))).map((p) => ({ x: x(p.x), y: y(p.y) }));
    return { xd, yd, x, y, hull };
  }, [dots, cabin, iw, ih]);
  const { x, y, hull, xd, yd } = geo;

  // Few ticks: the exact numbers are in the table.
  const xTicks = x.ticks(narrow ? 3 : 4).filter((t) => t >= 0 && t <= 100);
  const yTicks = y.ticks(4).filter((t) => t >= 0);

  // Region where ISS tests ran: the convex hull of the dots; a thin band when the dots form (almost) a line.
  const dotBox = dots.length
    ? {
        x0: Math.min(...dots.map((d) => x(d.x))),
        x1: Math.max(...dots.map((d) => x(d.x))),
        y0: Math.min(...dots.map((d) => y(d.y))),
        y1: Math.max(...dots.map((d) => y(d.y))),
      }
    : null;
  const flat = !!dotBox && (dotBox.y1 - dotBox.y0 < 8 || dotBox.x1 - dotBox.x0 < 8);
  const hullPath = !flat && hull.length >= 3 ? `M${hull.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L")}Z` : null;
  const band = flat && dotBox
    ? {
        x: dotBox.x0 - 7,
        y: Math.min(dotBox.y0, (dotBox.y0 + dotBox.y1) / 2 - 5) - 2,
        w: dotBox.x1 - dotBox.x0 + 14,
        h: Math.max(dotBox.y1 - dotBox.y0 + 4, 12),
      }
    : null;
  const hullBox = hullPath && dotBox ? dotBox : band ? { x0: band.x, x1: band.x + band.w, y0: band.y, y1: band.y + band.h } : null;
  const regionFont = narrow ? 11 : 12;
  const regionW = textWidth(REGION_TEXT, regionFont, true);
  let regionPos: { x: number; y: number } | null = null;
  if (hullBox) {
    const big = hullBox.y1 - hullBox.y0 > 44 && hullBox.x1 - hullBox.x0 > regionW + 20;
    const px = Math.min(Math.max(hullBox.x0, 0), Math.max(iw - regionW, 0));
    if (big) regionPos = { x: hullBox.x0 + 8, y: hullBox.y0 + regionFont + 6 };
    else if (hullBox.y1 + regionFont + 8 < ih) regionPos = { x: px, y: hullBox.y1 + regionFont + 6 };
    else regionPos = { x: px, y: Math.max(hullBox.y0 - 8, regionFont) };
  }

  // Markers and labels.
  const cx = x(cabin.x);
  const cy = y(cabin.y);
  const boxX0 = x(cabin.xLo);
  const boxX1 = x(cabin.xHi);
  const boxY0 = y(cabin.yHi);
  const boxY1 = y(cabin.yLo);
  const showBox = boxX1 - boxX0 > 6 || boxY1 - boxY0 > 6;

  // Other cabins: only those inside the drawn axes; ones that sit on top of each other share one label.
  const visibleOthers = others.filter((o) => o.x >= xd[0] && o.x <= xd[1] && o.y >= yd[0] && o.y <= yd[1] && Math.hypot(x(o.x) - cx, y(o.y) - cy) > 7);
  const clusters: { x: number; y: number; names: string[] }[] = [];
  for (const o of visibleOthers) {
    const ox = x(o.x);
    const oy = y(o.y);
    const hit = clusters.find((c) => Math.hypot(c.x - ox, c.y - oy) < 9);
    if (hit) hit.names.push(o.label);
    else clusters.push({ x: ox, y: oy, names: [o.label] });
  }

  const labelFont = narrow ? 11 : 12;
  const cabinFont = narrow ? 13 : 14;
  // Only "This cabin" and the shaded region are labelled. Other cabins are small dots whose names show on hover or tap.
  const items: (LabelItem & { bold?: boolean })[] = [{ id: "cabin", x: cx, y: cy, text: "This cabin", fontSize: cabinFont, r: 11, bold: true }];
  const avoid = [
    ...(regionPos ? [{ x0: regionPos.x, x1: regionPos.x + regionW, y0: regionPos.y - regionFont, y1: regionPos.y + 3 }] : []),
  ];
  const labels = placeLabels(
    items,
    { x0: 0, x1: iw, y0: 0, y1: ih },
    [{ x: cx, y: cy, r: 11 }, ...clusters.map((c) => ({ x: c.x, y: c.y, r: 4 })), ...dots.map((d) => ({ x: x(d.x), y: y(d.y), r: 4 }))],
    avoid,
  );
  const hot = hover !== null ? clusters[hover] : undefined;
  const hotText = hot ? hot.names.join(", ") : "";
  // The pill hugs the real text width once it is measured; the estimate is only the first frame.
  const hotRef = React.useRef<SVGTextElement | null>(null);
  const [hotMeasured, setHotMeasured] = React.useState<{ text: string; w: number } | null>(null);
  React.useLayoutEffect(() => {
    const el = hotRef.current;
    if (!el || !hotText) return;
    const w = el.getComputedTextLength();
    if (w > 0) setHotMeasured((p) => (p && p.text === hotText && Math.abs(p.w - w) < 0.5 ? p : { text: hotText, w }));
  }, [hotText]);
  const hotW = hot ? (hotMeasured?.text === hotText ? hotMeasured.w : textWidth(hotText, labelFont)) + 22 : 0;
  const hotX = hot ? Math.min(Math.max(hot.x - hotW / 2, 0), Math.max(iw - hotW, 0)) : 0;
  const hotY = hot ? (hot.y - 32 >= 0 ? hot.y - 32 : hot.y + 12) : 0;
  const cabinLabel =
    labels.get("cabin") ?? ({ x: Math.min(Math.max(cx, 40), iw - 40), y: Math.max(cy - 20, 8), anchor: "middle", text: "This cabin" } as const);

  const ids = { grid: `${uid}-grid`, clip: `${uid}-clip`, soft: `${uid}-soft`, glow: `${uid}-glow` };
  const grid = narrow ? 14 : 16;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="block select-none" onClick={() => setHover(null)}>
      <defs>
        {/* faint dot grid, echoing the page background */}
        <pattern id={ids.grid} width={grid} height={grid} patternUnits="userSpaceOnUse">
          <circle cx={grid / 2} cy={grid / 2} r={0.9} fill={INK} fillOpacity={0.11} />
        </pattern>
        <clipPath id={ids.clip}>
          <rect x={-2} y={-m.t} width={iw + 4} height={ih + m.t + 2} rx={10} />
        </clipPath>
        {/* soft glow for the ISS-tests region */}
        <filter id={ids.soft} filterUnits="userSpaceOnUse" x={-40} y={-40} width={iw + 80} height={ih + 80}>
          <feGaussianBlur stdDeviation={narrow ? 8 : 12} />
        </filter>
        {/* this cabin's yellow glow */}
        <radialGradient id={ids.glow}>
          <stop offset="0%" stopColor={YELLOW} stopOpacity={0.6} />
          <stop offset="40%" stopColor={YELLOW} stopOpacity={0.24} />
          <stop offset="100%" stopColor={YELLOW} stopOpacity={0} />
        </radialGradient>
      </defs>
      <g transform={`translate(${m.l},${m.t})`}>
        <rect x={0} y={0} width={iw} height={ih} fill={`url(#${ids.grid})`} />
        {/* very faint dotted guides at the y ticks */}
        {yTicks.map((t) => (
          <line key={`gy${t}`} x1={0} x2={iw} y1={y(t)} y2={y(t)} stroke={INK} strokeOpacity={0.14} strokeWidth={1} strokeDasharray="1 5" strokeLinecap="round" />
        ))}

        <g clipPath={`url(#${ids.clip})`}>
          {/* where ISS tests ran: a soft periwinkle glow under a crisp light outline */}
          {hullPath ? (
            <>
              <path d={hullPath} fill={BLUE} fillOpacity={0.28} stroke={BLUE} strokeOpacity={0.28} strokeWidth={14} strokeLinejoin="round" filter={`url(#${ids.soft})`} />
              <path d={hullPath} fill={BLUE} fillOpacity={0.08} stroke={BLUE} strokeOpacity={0.5} strokeWidth={1} strokeLinejoin="round" />
            </>
          ) : null}
          {band ? (
            <>
              <rect x={band.x - 4} y={band.y - 4} width={band.w + 8} height={band.h + 8} rx={(band.h + 8) / 2} fill={BLUE} fillOpacity={0.32} filter={`url(#${ids.soft})`} />
              <rect x={band.x} y={band.y} width={band.w} height={band.h} rx={Math.min(band.h / 2, 8)} fill={BLUE} fillOpacity={0.08} stroke={BLUE} strokeOpacity={0.5} strokeWidth={1} />
            </>
          ) : null}
        </g>
        {regionPos ? (
          <text x={regionPos.x} y={regionPos.y} fontSize={regionFont} fontWeight={600} fill={BLUE} style={{ ...HALO, letterSpacing: "0.01em" }}>
            {REGION_TEXT}
          </text>
        ) : null}

        {/* this cabin's range, when it has one */}
        {showBox ? (
          <rect
            x={boxX0}
            y={boxY0}
            width={Math.max(boxX1 - boxX0, 1)}
            height={Math.max(boxY1 - boxY0, 1)}
            rx={4}
            fill={YELLOW}
            fillOpacity={0.07}
            stroke={YELLOW}
            strokeOpacity={0.75}
            strokeWidth={1.25}
            strokeDasharray="1.5 4"
            strokeLinecap="round"
          />
        ) : null}

        {/* test results: filled = kept burning, hollow = went out */}
        {dots.map((d) =>
          d.burned ? (
            <circle key={d.id} cx={x(d.x)} cy={y(d.y)} r={3.4} fill={BLUE} fillOpacity={0.92} stroke="var(--surface)" strokeOpacity={0.6} strokeWidth={0.75} />
          ) : (
            <circle key={d.id} cx={x(d.x)} cy={y(d.y)} r={3.1} fill="var(--surface)" fillOpacity={0.55} stroke={BLUE} strokeWidth={1.4} />
          ),
        )}

        {/* other cabins: small unlabelled dots; the name shows on hover or tap, and every cabin is in the table */}
        {clusters.map((c, i) => (
          <g
            key={`oc${i}`}
            onPointerEnter={() => setHover(i)}
            // A touch "leave" fires right after the tap, so only a mouse or pen leaving hides the name.
            onPointerLeave={(e) => {
              if (e.pointerType !== "touch") setHover((h) => (h === i ? null : h));
            }}
            onClick={(e) => {
              e.stopPropagation();
              setHover(i);
            }}
            className="cursor-pointer"
          >
            <circle cx={c.x} cy={c.y} r={18} fill="transparent" />
            {hover === i ? <circle cx={c.x} cy={c.y} r={8} fill="none" stroke={MUTED} strokeOpacity={0.5} strokeWidth={1} /> : null}
            <circle cx={c.x} cy={c.y} r={hover === i ? 4.5 : 3} fill={MUTED} fillOpacity={hover === i ? 0.95 : 0.55} />
            <title>{c.names.join(", ")}</title>
          </g>
        ))}

        {/* this cabin: signal-yellow marker with a soft glow */}
        <g pointerEvents="none">
          <circle cx={cx} cy={cy} r={narrow ? 24 : 30} fill={`url(#${ids.glow})`} />
          <circle cx={cx} cy={cy} r={11} fill="none" stroke={YELLOW} strokeOpacity={0.45} strokeWidth={1} />
          <circle cx={cx} cy={cy} r={6.5} fill={YELLOW} stroke="var(--surface)" strokeWidth={2} />
          <text x={cabinLabel.x} y={cabinLabel.y} textAnchor={cabinLabel.anchor} dominantBaseline="central" fontSize={cabinFont} fontWeight={600} fill={YELLOW} style={{ ...HALO, letterSpacing: "0.01em" }}>
            {cabinLabel.text}
          </text>
        </g>

        {hot ? (
          <g pointerEvents="none">
            <rect x={hotX} y={hotY} width={hotW} height={22} rx={11} fill="var(--subtle)" stroke="var(--border-strong)" />
            <text ref={hotRef} x={hotX + hotW / 2} y={hotY + 11} textAnchor="middle" dominantBaseline="central" fontSize={labelFont} fontWeight={500} fill={INK}>
              {hotText}
            </text>
          </g>
        ) : null}

        {/* axes: a faint baseline, muted numbers */}
        <line x1={0} x2={iw} y1={ih} y2={ih} stroke="var(--border-strong)" strokeOpacity={0.8} />
        {xTicks.map((t) => (
          <g key={`tx${t}`}>
            <line x1={x(t)} x2={x(t)} y1={ih} y2={ih + 4} stroke="var(--border-strong)" />
            <text x={x(t)} y={ih + 18} textAnchor="middle" fontSize={12} fill={MUTED} style={NUM}>
              {trim(t)}
            </text>
          </g>
        ))}
        {yTicks.map((t) => (
          <text key={`ty${t}`} x={-10} y={y(t)} textAnchor="end" dominantBaseline="central" fontSize={12} fill={MUTED} style={NUM}>
            {trim(t)}
          </text>
        ))}
        <text x={iw / 2} y={ih + (narrow ? 36 : 38)} textAnchor="middle" fontSize={12} fontWeight={500} fill={MUTED} style={{ letterSpacing: "0.02em" }}>
          Oxygen (%)
        </text>
        <text transform={`translate(${-m.l + 12},${ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fontWeight={500} fill={MUTED} style={{ letterSpacing: "0.02em" }}>
          Pressure (kPa)
        </text>
      </g>
    </svg>
  );
}
