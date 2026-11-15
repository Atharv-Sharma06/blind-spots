import * as React from "react";
import { cn } from "@/lib/cn";

export interface ProgressRingProps {
  /** Share filled, 0 to 1. null draws no filled ticks (a missing value stays missing). */
  value: number | null;
  size?: number;
  /** Scales the tick thickness. */
  stroke?: number;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  ariaLabel: string;
  className?: string;
}

const TICKS = 40;
/** The gauge is an open arc: 250 degrees, gap at the bottom. */
const SWEEP = (250 * Math.PI) / 180;
const FADE = 3;

/** Radial tick gauge (BizLink style): about 40 thin tick lines on an open arc, black for the filled share and light grey
 *  for the rest, with a centred label (pass a <DotNumber>) and a small caption. Exposed as one image with ariaLabel; the
 *  visible label is hidden from assistive tech. */
export function ProgressRing({ value, size = 120, stroke = 6, label, sublabel, ariaLabel, className }: ProgressRingProps) {
  const v = value == null || !Number.isFinite(value) ? null : Math.min(1, Math.max(0, value));
  const c = size / 2;
  const outer = c - 2;
  const inner = outer - Math.max(8, size * 0.13);
  const width = Math.max(1.25, stroke / 4);
  const start = -Math.PI / 2 - SWEEP / 2;
  const filledCount = v == null ? 0 : Math.round(v * TICKS);
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i < TICKS; i++) {
    const a = start + (i / (TICKS - 1)) * SWEEP;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const filled = i < filledCount;
    // The last few filled ticks fade towards the grey remainder.
    const fromEnd = filledCount - 1 - i;
    const opacity = filled ? (fromEnd < FADE ? 0.55 + 0.15 * fromEnd : 1) : 1;
    ticks.push(
      <line
        key={i}
        x1={c + inner * cos}
        y1={c + inner * sin}
        x2={c + outer * cos}
        y2={c + outer * sin}
        stroke={filled ? "var(--fg)" : "var(--border-strong)"}
        strokeOpacity={opacity}
        strokeWidth={filled ? width * 1.15 : width}
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
        {ticks}
      </svg>
      {label != null || sublabel != null ? (
        <div aria-hidden="true" className="relative flex flex-col items-center justify-center text-center leading-none">
          {label != null ? <div>{label}</div> : null}
          {sublabel != null ? <div className="mt-1.5 text-label text-muted">{sublabel}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
