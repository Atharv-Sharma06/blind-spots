import { CHART, FONT, linearScale, niceTicks, paddedDomain } from "./chart-utils";
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

const ROW_H = 26;

/** Point estimate with 95 % interval per row; missing values stay visibly missing. */
export function DotPlot({ rows, xLabel, reference, ariaLabel, className }: DotPlotProps) {
  const W = 560;
  const m = { top: 8, right: 16, bottom: 40, left: 190 };
  const H = m.top + rows.length * ROW_H + m.bottom;
  const vals = rows.flatMap((r) => [...(r.value !== null ? [r.value] : []), ...(r.ci ?? [])]);
  if (reference) vals.push(reference.value);
  const dom = paddedDomain(vals, 0.08);
  const x = linearScale(dom, [m.left, W - m.right]);
  const ticks = niceTicks(dom[0], dom[1], 5);
  const yBottom = m.top + rows.length * ROW_H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className={className} style={{ width: "100%", height: "auto", maxWidth: W }}>
      <XAxis scale={x} y={yBottom} ticks={ticks} label={xLabel} height={rows.length * ROW_H} />
      {reference ? (
        <g>
          <line x1={x(reference.value)} x2={x(reference.value)} y1={m.top} y2={yBottom} stroke={CHART.ink} strokeDasharray="4 3" />
          <text x={x(reference.value) + 4} y={m.top + 9} fontSize={10} fill={CHART.muted}>
            {reference.label}
          </text>
        </g>
      ) : null}
      {rows.map((r, i) => {
        const cy = m.top + i * ROW_H + ROW_H / 2;
        return (
          <g key={r.label}>
            <text x={m.left - 10} y={cy} dy="0.32em" textAnchor="end" fontSize={11} fill={CHART.ink} fontWeight={r.emphasis ? 600 : 400} fontFamily={FONT}>
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
              <circle cx={x(r.value)} cy={cy} r={4} fill={r.emphasis ? CHART.ink : CHART.surface} stroke={r.emphasis ? CHART.ink : CHART.muted} strokeWidth={1.5} />
            ) : (
              <text x={m.left + 4} y={cy} dy="0.32em" fontSize={10} fill={CHART.muted}>
                not available
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
