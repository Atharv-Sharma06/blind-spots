"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { verdictLabel } from "@/lib/format";
import { isApiError } from "@/lib/api";
import { Callout } from "@/components/ui/callout";
import { Disclosure as UiDisclosure } from "@/components/ui/disclosure";
import { QueryError } from "@/components/explore/query-state";
import type { Verdict } from "@/lib/types";

/**
 * Verdict badge (visual audit a03-06): supported = neutral outline; extrapolation = warn text only;
 * insufficient evidence = the plum uncertainty hue. Never amber (gaps) or teal (candidates).
 */
export function VerdictBadge({ verdict, className, ...props }: { verdict: Verdict } & React.HTMLAttributes<HTMLSpanElement>) {
  const tone =
    verdict === "supported"
      ? "border-border-strong bg-surface text-fg px-1.5"
      : verdict === "extrapolation"
        ? "border-transparent bg-transparent px-0 text-warn"
        : "border-plum-3 bg-plum-1 text-plum-7 px-1.5";
  return (
    <span
      className={cn("inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-sm border text-xs font-medium leading-none", tone, className)}
      {...props}
    >
      {verdictLabel(verdict)}
    </span>
  );
}

/** The app-wide Disclosure (components/ui/disclosure.tsx), with spacing for the analysis column. */
export function Disclosure({ summary, children, ...props }: React.ComponentProps<typeof UiDisclosure>) {
  return (
    <UiDisclosure summary={summary} contentClassName="space-y-3 text-xs" {...props}>
      {children}
    </UiDisclosure>
  );
}

/**
 * Keeps the previous content in place while a new answer loads (no layout jump), but visibly marks it as
 * out of date: dimmed, inert, aria-busy, with an "Updating" label. Stale numbers are never presented as current.
 */
export function Updating({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div className="relative" aria-busy={active || undefined}>
      {active ? (
        <p role="status" className="absolute top-0 right-0 z-10 rounded-sm border border-border bg-surface px-1.5 py-0.5 text-xs text-muted">
          Updating…
        </p>
      ) : null}
      <div className={cn("transition-opacity duration-150", active && "pointer-events-none opacity-35 select-none")} inert={active || undefined}>
        {children}
      </div>
    </div>
  );
}

/** Query error for the analysis panels; snapshot gaps get honest copy that never asks visitors to run a service. */
export function PanelError({ error, onRetry, what = "This result" }: { error: unknown; onRetry?: () => void; what?: string }) {
  if (isApiError(error) && error.snapshotUnavailable) {
    return (
      <Callout variant="info" title="Not in this precomputed version">
        {what} is only in the full local version.
      </Callout>
    );
  }
  return <QueryError error={error} onRetry={onRetry} />;
}
