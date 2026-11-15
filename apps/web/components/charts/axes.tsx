import { CHART, FONT, SANS, TEXT, tickLabel, type LinearScale } from "./chart-utils";

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function XAxis({ scale, y, ticks, label, height }: { scale: LinearScale; y: number; ticks: number[]; label?: string; height?: number }) {
  const [x0, x1] = scale.range;
  return (
    <g aria-hidden>
      <line x1={x0} x2={x1} y1={y} y2={y} stroke={CHART.axis} />
      {ticks.map((t) => (
        <g key={t} transform={`translate(${scale(t)},0)`}>
          {height ? <line y1={y} y2={y - height} stroke={CHART.grid} /> : null}
          <line y1={y} y2={y + 4} stroke={CHART.axis} />
          <text y={y + 16} textAnchor="middle" fontSize={TEXT.tick} fill={CHART.muted} fontFamily={FONT}>
            {tickLabel(t)}
          </text>
        </g>
      ))}
      {label ? (
        <text x={(x0 + x1) / 2} y={y + 34} textAnchor="middle" fontSize={TEXT.label} fill={CHART.muted} fontFamily={SANS}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

export function YAxis({ scale, x, ticks, label, width }: { scale: LinearScale; x: number; ticks: number[]; label?: string; width?: number }) {
  const [y0, y1] = scale.range;
  return (
    <g aria-hidden>
      <line x1={x} x2={x} y1={y0} y2={y1} stroke={CHART.axis} />
      {ticks.map((t) => (
        <g key={t} transform={`translate(0,${scale(t)})`}>
          {width ? <line x1={x} x2={x + width} stroke={CHART.grid} /> : null}
          <line x1={x - 4} x2={x} stroke={CHART.axis} />
          <text x={x - 7} dy="0.32em" textAnchor="end" fontSize={TEXT.tick} fill={CHART.muted} fontFamily={FONT}>
            {tickLabel(t)}
          </text>
        </g>
      ))}
      {label ? (
        <text transform={`translate(${x - 42},${(y0 + y1) / 2}) rotate(-90)`} textAnchor="middle" fontSize={TEXT.label} fill={CHART.muted} fontFamily={SANS}>
          {label}
        </text>
      ) : null}
    </g>
  );
}
