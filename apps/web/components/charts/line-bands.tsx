"use client";

import { CHART, SANS, TEXT, linearScale, niceTicks, paddedDomain, useChartWidth } from "./chart-utils";
import { XAxis, YAxis } from "./axes";

export interface LineSeries {
  key: string;
  label: string;
  stroke: string;
  dash?: string;
  points: { x: number; mean: number; ci: [number, number] | null }[];
}

export interface LineBandsProps {
  series: LineSeries[];
  xLabel: string;
  yLabel: string;
  /** Optional horizontal reference (e.g. majority-class baseline). */
  reference?: { value: number; label: string } | null;
  ariaLabel: string;
  className?: string;
}

/** Mean curves with 95 % interval bands; direct legend below the chart. */
export function LineBands({ series, xLabel, yLabel, reference, ariaLabel, className }: LineBandsProps) {
  const [ref, W] = useChartWidth(640, 720);
  const H = W < 480 ? 260 : 300;
  const m = { top: 12, right: 16, bottom: 48, left: 60 };
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const ys = series.flatMap((s) => s.points.flatMap((p) => [p.mean, ...(p.ci ?? [])]));
  if (reference) ys.push(reference.value);
  const xd: [number, number] = [Math.min(...xs), Math.max(...xs)];
  const yd = paddedDomain(ys, 0.06);
  const x = linearScale(xd, [m.left, W - m.right]);
  const y = linearScale(yd, [H - m.bottom, m.top]);
  const xt = niceTicks(xd[0], xd[1], Math.min(W < 480 ? 5 : 10, xd[1] - xd[0]));
  return (
    <div ref={ref} className={className}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} style={{ display: "block", maxWidth: "100%" }}>
        <YAxis scale={y} x={m.left} ticks={niceTicks(yd[0], yd[1], 5)} label={yLabel} width={W - m.left - m.right} />
        <XAxis scale={x} y={H - m.bottom} ticks={xt} label={xLabel} />
        {reference ? (
          <g>
            <line x1={x(xd[0])} x2={x(xd[1])} y1={y(reference.value)} y2={y(reference.value)} stroke={CHART.muted} strokeWidth={1.25} strokeDasharray="2 3" />
            <text x={x(xd[1])} y={y(reference.value) - 5} textAnchor="end" fontSize={TEXT.value} fill={CHART.muted} fontFamily={SANS}>
              {reference.label}
            </text>
          </g>
        ) : null}
        {series.map((s) => {
          const withCi = s.points.filter((p) => p.ci);
          const band =
            withCi.length > 1
              ? `M${withCi.map((p) => `${x(p.x)},${y((p.ci as [number, number])[1])}`).join("L")}L${[...withCi]
                  .reverse()
                  .map((p) => `${x(p.x)},${y((p.ci as [number, number])[0])}`)
                  .join("L")}Z`
              : null;
          return (
            <g key={s.key}>
              {band ? <path d={band} fill={s.stroke} fillOpacity={0.1} stroke="none" /> : null}
              <polyline fill="none" stroke={s.stroke} strokeWidth={s.key === "evr" ? 2.5 : 1.75} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dash} points={s.points.map((p) => `${x(p.x)},${y(p.mean)}`).join(" ")} />
            </g>
          );
        })}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden>
              <line x1="0" x2="22" y1="4" y2="4" stroke={s.stroke} strokeWidth="2" strokeDasharray={s.dash} />
            </svg>
            {s.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-fg/10" aria-hidden />
          95 % interval across seeds
        </li>
      </ul>
    </div>
  );
}
