import { CHART, FONT, linearScale } from "./chart-utils";
import { XAxis, YAxis } from "./axes";

export interface ReliabilityBinDatum {
  lo: number;
  hi: number;
  count: number;
  meanPredicted: number | null;
  observedFrequency: number | null;
}

export interface ReliabilityDiagramProps {
  bins: ReliabilityBinDatum[];
  ariaLabel: string;
  className?: string;
}

/** Predicted vs observed frequency per bin (dot area = bin count), with a count histogram below. */
export function ReliabilityDiagram({ bins, ariaLabel, className }: ReliabilityDiagramProps) {
  const W = 420;
  const topH = 280;
  const histH = 52;
  const m = { top: 10, right: 14, left: 46, gap: 40 };
  const x = linearScale([0, 1], [m.left, W - m.right]);
  const y = linearScale([0, 1], [m.top + topH, m.top]);
  const maxCount = Math.max(1, ...bins.map((b) => b.count));
  const hTop = m.top + topH + m.gap;
  const hy = linearScale([0, maxCount], [hTop + histH, hTop]);
  const H = hTop + histH + 28;
  const r = (c: number) => 3 + 7 * Math.sqrt(c / maxCount);
  const pts = bins.filter((b) => b.meanPredicted !== null && b.observedFrequency !== null);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className={className} style={{ width: "100%", height: "auto", maxWidth: W }}>
      <YAxis scale={y} x={m.left} ticks={ticks} label="Observed frequency" width={W - m.left - m.right} />
      <XAxis scale={x} y={m.top + topH} ticks={ticks} />
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke={CHART.ink} strokeDasharray="4 3" />
      <polyline fill="none" stroke={CHART.plum} strokeWidth={1.25} points={pts.map((b) => `${x(b.meanPredicted as number)},${y(b.observedFrequency as number)}`).join(" ")} />
      {pts.map((b) => (
        <circle key={b.lo} cx={x(b.meanPredicted as number)} cy={y(b.observedFrequency as number)} r={r(b.count)} fill={CHART.plum} fillOpacity={0.35} stroke={CHART.plum} strokeWidth={1.25}>
          <title>{`bin ${b.lo.toFixed(1)}-${b.hi.toFixed(1)}: n=${b.count}, mean predicted ${(b.meanPredicted as number).toFixed(2)}, observed ${(b.observedFrequency as number).toFixed(2)}`}</title>
        </circle>
      ))}
      {/* count histogram */}
      <g aria-hidden>
        <line x1={x(0)} x2={x(1)} y1={hTop + histH} y2={hTop + histH} stroke={CHART.axis} />
        {bins.map((b) => (
          <g key={b.lo}>
            <rect x={x(b.lo) + 1} width={Math.max(1, x(b.hi) - x(b.lo) - 2)} y={hy(b.count)} height={hTop + histH - hy(b.count)} fill={CHART.muted} fillOpacity={0.45} />
            {b.count > 0 ? (
              <text x={(x(b.lo) + x(b.hi)) / 2} y={hy(b.count) - 3} textAnchor="middle" fontSize={9} fill={CHART.muted} fontFamily={FONT}>
                {b.count}
              </text>
            ) : null}
          </g>
        ))}
        <text x={m.left - 7} y={hTop + 6} textAnchor="end" fontSize={10} fill={CHART.muted}>
          n
        </text>
        <text x={(x(0) + x(1)) / 2} y={H - 4} textAnchor="middle" fontSize={11} fill={CHART.muted}>
          Mean predicted probability of sustained flame (bin counts above)
        </text>
      </g>
    </svg>
  );
}
