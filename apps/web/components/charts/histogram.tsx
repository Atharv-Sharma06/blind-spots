import { CHART, FONT, linearScale, niceTicks } from "./chart-utils";
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
  const W = 480;
  const H = 210;
  const m = { top: 10, right: 14, bottom: 40, left: 52 };
  const maxC = Math.max(1, ...counts);
  const x = linearScale([edges[0] ?? 0, edges[edges.length - 1] ?? 1], [m.left, W - m.right]);
  const y = linearScale([0, maxC], [H - m.bottom, m.top]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className={className} style={{ width: "100%", height: "auto", maxWidth: W }}>
      <YAxis scale={y} x={m.left} ticks={niceTicks(0, maxC, 4)} label="Predictions" width={W - m.left - m.right} />
      <XAxis scale={x} y={H - m.bottom} ticks={niceTicks(edges[0] ?? 0, edges[edges.length - 1] ?? 1, 5)} label={xLabel} />
      {counts.map((c, i) => {
        const e0 = edges[i] ?? 0;
        const e1 = edges[i + 1] ?? e0;
        return (
        <g key={i}>
          <rect x={x(e0) + 1} width={Math.max(1, x(e1) - x(e0) - 2)} y={y(c)} height={H - m.bottom - y(c)} fill={CHART.plum} fillOpacity={0.4} stroke={CHART.plum}>
            <title>{`|error| ${e0.toFixed(2)} to ${e1.toFixed(2)}: ${c}`}</title>
          </rect>
          {c > 0 ? (
            <text x={(x(e0) + x(e1)) / 2} y={y(c) - 3} textAnchor="middle" fontSize={9} fill={CHART.muted} fontFamily={FONT}>
              {c}
            </text>
          ) : null}
        </g>
        );
      })}
    </svg>
  );
}
