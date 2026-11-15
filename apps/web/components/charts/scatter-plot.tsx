"use client";

import { CHART, linearScale, niceTicks, paddedDomain, useChartWidth } from "./chart-utils";
import { XAxis, YAxis } from "./axes";

export interface ScatterPoint {
  x: number;
  y: number;
  label: string;
}

export interface ScatterPlotProps {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  ariaLabel: string;
  className?: string;
}

export function ScatterPlot({ points, xLabel, yLabel, ariaLabel, className }: ScatterPlotProps) {
  const [ref, W] = useChartWidth(460, 520);
  const H = 300;
  const m = { top: 12, right: 16, bottom: 48, left: 60 };
  const xd = paddedDomain(points.map((p) => p.x), 0.06, 0);
  const yd = paddedDomain(points.map((p) => p.y), 0.06, 0);
  const x = linearScale(xd, [m.left, W - m.right]);
  const y = linearScale(yd, [H - m.bottom, m.top]);
  return (
    <div ref={ref} className={className}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} style={{ display: "block", maxWidth: "100%" }}>
        <YAxis scale={y} x={m.left} ticks={niceTicks(yd[0], yd[1], 5)} label={yLabel} width={W - m.left - m.right} />
        <XAxis scale={x} y={H - m.bottom} ticks={niceTicks(xd[0], xd[1], W < 400 ? 4 : 5)} label={xLabel} />
        {points.map((p) => (
          <circle key={p.label} cx={x(p.x)} cy={y(p.y)} r={4.5} fill={CHART.observed} fillOpacity={0.3} stroke={CHART.observed} strokeWidth={1.5}>
            <title>{`${p.label}: uncertainty ${p.x.toFixed(3)}, error ${p.y.toFixed(3)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
