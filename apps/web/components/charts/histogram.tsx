"use client";

import { CHART, FONT, TEXT, linearScale, niceTicks, useChartWidth } from "./chart-utils";
import { XAxis, YAxis } from "./axes";

export interface HistogramProps {
  /** Bin edges (length = counts.length + 1). */
  edges: number[];
  counts: number[];
  xLabel: string;
  ariaLabel: string;
  className?: string;
}

export function Histogram({ edges, counts, xLabel, ariaLabel, className }: HistogramProps) {
  const [ref, W] = useChartWidth(440, 560);
  const H = 240;
  const m = { top: 18, right: 14, bottom: 46, left: 58 };
  const maxC = Math.max(1, ...counts);
  const x = linearScale([edges[0] ?? 0, edges[edges.length - 1] ?? 1], [m.left, W - m.right]);
  const y = linearScale([0, maxC], [H - m.bottom, m.top]);
  return (
    <div ref={ref} className={className}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} style={{ display: "block", maxWidth: "100%" }}>
        <YAxis scale={y} x={m.left} ticks={niceTicks(0, maxC, 4)} label="Predictions" width={W - m.left - m.right} />
        <XAxis scale={x} y={H - m.bottom} ticks={niceTicks(edges[0] ?? 0, edges[edges.length - 1] ?? 1, W < 400 ? 4 : 5)} label={xLabel} />
        {counts.map((c, i) => {
          const e0 = edges[i] ?? 0;
          const e1 = edges[i + 1] ?? e0;
          const bw = x(e1) - x(e0);
          return (
            <g key={i}>
              <rect x={x(e0) + 2} width={Math.max(1, bw - 4)} y={y(c)} height={H - m.bottom - y(c)} fill={CHART.ink} rx={3}>
                <title>{`|error| ${e0.toFixed(2)} to ${e1.toFixed(2)}: ${c}`}</title>
              </rect>
              {c > 0 && bw >= 22 ? (
                <text x={(x(e0) + x(e1)) / 2} y={y(c) - 4} textAnchor="middle" fontSize={TEXT.value} fill={CHART.muted} fontFamily={FONT}>
                  {c}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
