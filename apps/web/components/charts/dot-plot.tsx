"use client";

import { CHART, FONT, SANS, TEXT, linearScale, niceTicks, paddedDomain, useChartWidth } from "./chart-utils";
import { XAxis } from "./axes";

export interface DotRow {
  label: string;
  value: number | null;
  ci: [number, number] | null;
  /** The model of interest is drawn solid ink; comparison rows are muted. */
  emphasis?: boolean;
}

export interface DotPlotProps {
  rows: DotRow[];
  xLabel: string;
  /** Optional vertical reference line (e.g. the majority-class value). */
  reference?: { value: number; label: string } | null;
  ariaLabel: string;
  className?: string;
}

/** Point estimate with 95 % interval per row; missing values stay visibly missing. Labels sit above the rows on narrow screens. */
export function DotPlot({ rows, xLabel, reference, ariaLabel, className }: DotPlotProps) {
  const [ref, W] = useChartWidth(640, 720);
  const stacked = W < 520;
  const ROW_H = stacked ? 40 : 28;
  const m = { top: reference ? 22 : 8, right: 18, bottom: 46, left: stacked ? 12 : 200 };
  const H = m.top + rows.length * ROW_H + m.bottom;
  const vals = rows.flatMap((r) => [...(r.value !== null ? [r.value] : []), ...(r.ci ?? [])]);
  if (reference) vals.push(reference.value);
  const dom = paddedDomain(vals, 0.08);
  const x = linearScale(dom, [m.left, W - m.right]);
  const ticks = niceTicks(dom[0], dom[1], stacked ? 4 : 6);
  const yBottom = m.top + rows.length * ROW_H;
  return (
    <div ref={ref} className={className}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} style={{ display: "block", maxWidth: "100%" }}>
        <XAxis scale={x} y={yBottom} ticks={ticks} label={xLabel} height={rows.length * ROW_H} />
        {reference ? (
          <g>
            <line x1={x(reference.value)} x2={x(reference.value)} y1={m.top - 4} y2={yBottom} stroke={CHART.muted} strokeDasharray="4 3" />
            <text x={x(reference.value)} y={m.top - 9} textAnchor="middle" fontSize={TEXT.value} fill={CHART.muted} fontFamily={SANS}>
              {reference.label}
            </text>
          </g>
        ) : null}
        {rows.map((r, i) => {
          const top = m.top + i * ROW_H;
          const cy = stacked ? top + 27 : top + ROW_H / 2;
          return (
            <g key={r.label}>
              <text
                x={stacked ? m.left : m.left - 12}
                y={stacked ? top + 11 : cy}
                dy={stacked ? undefined : "0.32em"}
                textAnchor={stacked ? "start" : "end"}
                fontSize={TEXT.label}
                fill={CHART.ink}
                fontWeight={r.emphasis ? 600 : 400}
                fontFamily={SANS}
              >
                {r.label}
              </text>
              {r.ci ? (
                <g stroke={r.emphasis ? CHART.ink : CHART.muted} strokeWidth={1.5}>
                  <line x1={x(r.ci[0])} x2={x(r.ci[1])} y1={cy} y2={cy} />
                  <line x1={x(r.ci[0])} x2={x(r.ci[0])} y1={cy - 4} y2={cy + 4} />
                  <line x1={x(r.ci[1])} x2={x(r.ci[1])} y1={cy - 4} y2={cy + 4} />
                </g>
              ) : null}
              {r.value !== null ? (
                <circle cx={x(r.value)} cy={cy} r={4.5} fill={r.emphasis ? CHART.ink : CHART.surface} stroke={r.emphasis ? CHART.ink : CHART.muted} strokeWidth={1.5}>
                  <title>{`${r.label}: ${r.value.toFixed(3)}${r.ci ? ` (95 % interval ${r.ci[0].toFixed(3)} to ${r.ci[1].toFixed(3)})` : ""}`}</title>
                </circle>
              ) : (
                <text x={m.left + 4} y={cy} dy="0.32em" fontSize={TEXT.value} fill={CHART.muted} fontFamily={FONT}>
                  not available
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
