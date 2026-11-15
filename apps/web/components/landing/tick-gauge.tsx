import * as React from "react";

const TICKS = 40;
const SWEEP = 250; // degrees of arc, open at the bottom

export interface TickGaugeProps {
  /** Share filled, 0 to 1. null draws only the grey track (a missing value stays missing). */
  value: number | null;
  size?: number;
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  ariaLabel: string;
}

/** Radial tick gauge: ~40 thin black ticks fading to light grey for the remainder, a big number centred. */
export function TickGauge({ value, size = 176, label, sublabel, ariaLabel }: TickGaugeProps) {
  const v = value == null || !Number.isFinite(value) ? null : Math.min(1, Math.max(0, value));
  const c = size / 2;
  const outer = c - 3;
  const inner = outer - size * 0.115;
  const filled = v == null ? 0 : Math.round(v * TICKS);
  const start = 90 + (360 - SWEEP) / 2; // bottom-left, measured clockwise from 3 o'clock
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i < TICKS; i++) {
    const deg = start + (i / (TICKS - 1)) * SWEEP;
    const a = (deg * Math.PI) / 180;
    const on = i < filled;
    const fade = on && i >= filled - 4 ? 0.45 + 0.55 * ((filled - 1 - i) / 3) : 1;
    ticks.push(
      <line
        key={i}
        x1={c + inner * Math.cos(a)}
        y1={c + inner * Math.sin(a)}
        x2={c + outer * Math.cos(a)}
        y2={c + outer * Math.sin(a)}
        stroke={on ? "#161616" : "#CFCCC4"}
        strokeOpacity={on ? fade : 1}
        strokeWidth={on ? 2.5 : 2}
        strokeLinecap="round"
      />,
    );
  }
  return (
    <div role="img" aria-label={ariaLabel} className="relative inline-grid shrink-0 place-items-center text-[#161616]" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="absolute inset-0">
        {ticks}
      </svg>
      {label != null || sublabel != null ? (
        <div aria-hidden="true" className="relative flex flex-col items-center text-center">
          {label != null ? <div className="text-[40px] leading-[44px] font-medium tracking-[-0.02em]">{label}</div> : null}
          {sublabel != null ? <div className="mt-0.5 max-w-[8.5rem] text-[13px] leading-4 text-[#6F6D68]">{sublabel}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
