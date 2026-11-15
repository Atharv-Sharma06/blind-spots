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
const HALO = { paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3.5, strokeLinejoin: "round" } as const;

function ChartSvg({ dots, cabin, others, ariaLabel, width, height }: SimpleChartProps & { width: number; height: number }) {
  const narrow = width < 480;
  const [hover, setHover] = React.useState<number | null>(null);
  const m = { t: 12, r: narrow ? 14 : 22, b: narrow ? 42 : 44, l: narrow ? 46 : 50 };
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
  // Only "This cabin" and the shaded region are labelled. Other cabins are small dots whose names show on hover or tap.
  const items: (LabelItem & { bold?: boolean })[] = [{ id: "cabin", x: cx, y: cy, text: "This cabin", fontSize: narrow ? 13 : 14, r: 8, bold: true }];
  const avoid = [
    ...(regionPos ? [{ x0: regionPos.x, x1: regionPos.x + regionW, y0: regionPos.y - regionFont, y1: regionPos.y + 3 }] : []),
  ];
  const labels = placeLabels(
    items,
    { x0: 0, x1: iw, y0: 0, y1: ih },
    [{ x: cx, y: cy, r: 8 }, ...clusters.map((c) => ({ x: c.x, y: c.y, r: 4 })), ...dots.map((d) => ({ x: x(d.x), y: y(d.y), r: 4 }))],
    avoid,
  );
  const hot = hover !== null ? clusters[hover] : undefined;
  const hotText = hot ? hot.names.join(", ") : "";
  const hotW = hot ? textWidth(hotText, labelFont, true) + 12 : 0;
  const hotX = hot ? Math.min(Math.max(hot.x - hotW / 2, 0), Math.max(iw - hotW, 0)) : 0;
  const hotY = hot ? (hot.y - 30 >= 0 ? hot.y - 30 : hot.y + 12) : 0;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="block select-none">
      <g transform={`translate(${m.l},${m.t})`}>
        {/* light horizontal guides only */}
        {yTicks.map((t) => (
          <line key={`gy${t}`} x1={0} x2={iw} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} strokeOpacity={0.7} />
        ))}

        {/* where ISS tests ran */}
        {hullPath ? <path d={hullPath} fill={BLUE} fillOpacity={0.1} stroke={BLUE} strokeOpacity={0.45} strokeWidth={1} strokeLinejoin="round" /> : null}
        {band ? <rect x={band.x} y={band.y} width={band.w} height={band.h} rx={6} fill={BLUE} fillOpacity={0.1} stroke={BLUE} strokeOpacity={0.45} strokeWidth={1} /> : null}
        {regionPos ? (
          <text x={regionPos.x} y={regionPos.y} fontSize={regionFont} fontWeight={600} fill={BLUE} style={HALO}>
            {REGION_TEXT}
          </text>
        ) : null}

        {/* this cabin's range, when it has one */}
        {showBox ? (
          <rect x={boxX0} y={boxY0} width={Math.max(boxX1 - boxX0, 1)} height={Math.max(boxY1 - boxY0, 1)} fill={INK} fillOpacity={0.06} stroke={INK} strokeWidth={1.25} strokeDasharray="4 3" />
        ) : null}

        {/* test results */}
        {dots.map((d) =>
          d.burned ? (
            <circle key={d.id} cx={x(d.x)} cy={y(d.y)} r={3.4} fill={BLUE} fillOpacity={0.8} />
          ) : (
            <circle key={d.id} cx={x(d.x)} cy={y(d.y)} r={3.2} fill="var(--surface)" fillOpacity={0.35} stroke={BLUE} strokeWidth={1.4} />
          ),
        )}

        {/* other cabins: small unlabelled dots; the name shows on hover or tap, and every cabin is in the table */}
        {clusters.map((c, i) => (
          <g key={`oc${i}`} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover((h) => (h === i ? null : h))} onClick={() => setHover((h) => (h === i ? null : i))}>
            <circle cx={c.x} cy={c.y} r={18} fill="transparent" />
            <circle cx={c.x} cy={c.y} r={hover === i ? 5 : 3.5} fill={MUTED} fillOpacity={hover === i ? 0.95 : 0.6} stroke="var(--surface)" strokeWidth={1} />
            <title>{c.names.join(", ")}</title>
          </g>
        ))}
        {/* this cabin */}
        <circle cx={cx} cy={cy} r={7.5} fill={INK} stroke="var(--surface)" strokeWidth={2.5} />
        {(() => {
          const l =
            labels.get("cabin") ??
            ({ x: Math.min(Math.max(cx, 40), iw - 40), y: Math.max(cy - 18, 8), anchor: "middle", text: "This cabin" } as const);
          return l ? (
            <text x={l.x} y={l.y} textAnchor={l.anchor} dominantBaseline="central" fontSize={narrow ? 13 : 14} fontWeight={700} fill={INK} style={HALO}>
              {l.text}
            </text>
          ) : null;
        })()}

        {hot ? (
          <g pointerEvents="none">
            <rect x={hotX} y={hotY} width={hotW} height={20} rx={4} fill="var(--surface)" stroke="var(--border-strong)" />
            <text x={hotX + hotW / 2} y={hotY + 10} textAnchor="middle" dominantBaseline="central" fontSize={labelFont} fontWeight={600} fill={INK}>
              {hotText}
            </text>
          </g>
        ) : null}

        {/* axes */}
        <line x1={0} x2={iw} y1={ih} y2={ih} stroke="var(--border-strong)" />
        <line x1={0} x2={0} y1={0} y2={ih} stroke="var(--border-strong)" />
        {xTicks.map((t) => (
          <g key={`tx${t}`}>
            <line x1={x(t)} x2={x(t)} y1={ih} y2={ih + 4} stroke="var(--border-strong)" />
            <text x={x(t)} y={ih + 18} textAnchor="middle" fontSize={12} fill={MUTED}>
              {trim(t)}
            </text>
          </g>
        ))}
        {yTicks.map((t) => (
          <text key={`ty${t}`} x={-8} y={y(t)} textAnchor="end" dominantBaseline="central" fontSize={12} fill={MUTED}>
            {trim(t)}
          </text>
        ))}
        <text x={iw / 2} y={ih + (narrow ? 36 : 38)} textAnchor="middle" fontSize={12} fontWeight={500} fill={INK}>
          Oxygen (%)
        </text>
        <text transform={`translate(${-m.l + 12},${ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fontWeight={500} fill={INK}>
          Pressure (kPa)
        </text>
      </g>
    </svg>
  );
}
