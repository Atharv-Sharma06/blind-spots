import * as React from "react";
import { cn } from "@/lib/cn";

export interface MetricProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  /** Pass null/undefined for a missing value: it renders as an en dash and is announced as "not available". */
  value: React.ReactNode | null | undefined;
  unit?: string;
  /** Sample size, rendered as "n=12". */
  n?: number | null;
  size?: "md" | "lg";
}

/** Label + mono value + unit + optional n=. Missing values stay visibly missing. */
export function Metric({ label, value, unit, n, size = "md", className, ...props }: MetricProps) {
  const missing = value === null || value === undefined || value === "";
  return (
    <div className={cn("min-w-0", className)} {...props}>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={cn("num text-fg", size === "lg" ? "text-heading font-semibold" : "text-ui")}>
          {missing ? (
            <>
              <span aria-hidden>&ndash;</span>
              <span className="sr-only">not available</span>
            </>
          ) : (
            value
          )}
        </span>
        {unit && !missing ? <span className="text-xs text-muted">{unit}</span> : null}
        {typeof n === "number" ? <span className="num ml-1 text-xs text-muted">n={n}</span> : null}
      </div>
    </div>
  );
}
