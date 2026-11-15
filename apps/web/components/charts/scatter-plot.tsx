import { CHART, linearScale, niceTicks, paddedDomain } from "./chart-utils";
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
  const W = 480;
  const H = 290;
  const m = { top: 10, right: 14, bottom: 42, left: 52 };
  const xd = paddedDomain(points.map((p) => p.x), 0.06, 0);
  const yd = paddedDomain(points.map((p) => p.y), 0.06, 0);
  const x = linearScale(xd, [m.left, W - m.right]);
  const y = linearScale(yd, [H - m.bottom, m.top]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className={className} style={{ width: "100%", height: "auto", maxWidth: W }}>
      <YAxis scale={y} x={m.left} ticks={niceTicks(yd[0], yd[1], 5)} label={yLabel} width={W - m.left - m.right} />
      <XAxis scale={x} y={H - m.bottom} ticks={niceTicks(xd[0], xd[1], 5)} label={xLabel} />
      {points.map((p) => (
        <circle key={p.label} cx={x(p.x)} cy={y(p.y)} r={4} fill={CHART.plum} fillOpacity={0.4} stroke={CHART.plum} strokeWidth={1.25}>
          <title>{`${p.label}: uncertainty ${p.x.toFixed(3)}, error ${p.y.toFixed(3)}`}</title>
        </circle>
      ))}
    </svg>
  );
}
