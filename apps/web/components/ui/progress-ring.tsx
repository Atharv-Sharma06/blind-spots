import * as React from "react";
import { cn } from "@/lib/cn";

export interface ProgressRingProps {
  /** Share filled, 0 to 1. null draws no arc (a missing value stays missing). */
  value: number | null;
  size?: number;
  stroke?: number;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  ariaLabel: string;
  className?: string;
}

const TICKS = 60;

/** Thin light track, a signal-yellow arc for the value, small tick marks on the unfilled part and a centred label
 *  (pass a <DotNumber>). Exposed as one image with ariaLabel; the visible label is hidden from assistive tech. */
export function ProgressRing({ value, size = 120, stroke = 6, label, sublabel, ariaLabel, className }: ProgressRingProps) {
  const v = value == null || !Number.isFinite(value) ? null : Math.min(1, Math.max(0, value));
  const c = size / 2;
  const r = c - stroke / 2 - 1;
  const circ = 2 * Math.PI * r;
  const arcLen = v == null ? 0 : v * circ;
  // Ticks sit just inside the track and only on the part the arc has not reached.
  const tickOuter = r - stroke / 2 - 3;
  const tickInner = tickOuter - Math.max(3, size * 0.035);
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i < TICKS; i++) {
    const t = i / TICKS;
    if (v != null && t < v) continue;
    const a = t * 2 * Math.PI - Math.PI / 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    ticks.push(
      <line
        key={i}
        x1={c + tickInner * cos}
        y1={c + tickInner * sin}
        x2={c + tickOuter * cos}
        y2={c + tickOuter * sin}
        stroke="currentColor"
        strokeOpacity={0.35}
        strokeWidth={1}
        strokeLinecap="round"
      />,
    );
  }
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn("relative inline-grid shrink-0 place-items-center text-fg", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="absolute inset-0">
        <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeOpacity={0.22} strokeWidth={Math.max(1, stroke / 4)} />
        {ticks}
        {v != null && v > 0 ? (
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke="#f2d21b"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${circ}`}
            transform={`rotate(-90 ${c} ${c})`}
          />
        ) : null}
      </svg>
      {label != null || sublabel != null ? (
        <div aria-hidden="true" className="relative flex flex-col items-center justify-center text-center leading-none">
          {label != null ? <div>{label}</div> : null}
          {sublabel != null ? <div className="mt-1.5 text-label text-current/80">{sublabel}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
