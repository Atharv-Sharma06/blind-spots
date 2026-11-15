"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { verdictLabel } from "@/lib/format";
import { isApiError } from "@/lib/api";
import { Callout } from "@/components/ui/callout";
import { Disclosure as UiDisclosure } from "@/components/ui/disclosure";
import { QueryError } from "@/components/explore/query-state";
import type { Verdict } from "@/lib/types";

/** Status dot colours (light theme): covered = green, barely covered = amber, not covered = black. */
export const STATUS_DOT = {
  covered: "bg-[#2FD067]",
  partly: "bg-[#E8A33B]",
  blind: "bg-[#161616]",
} as const;

/**
 * Verdict chip: an outlined chip with a status dot. Supported = green dot (covered), extrapolation = amber dot
 * (barely covered), insufficient evidence = black dot (not covered). The words always carry the meaning too.
 */
export function VerdictBadge({ verdict, className, ...props }: { verdict: Verdict } & React.HTMLAttributes<HTMLSpanElement>) {
  const dot = verdict === "supported" ? STATUS_DOT.covered : verdict === "extrapolation" ? STATUS_DOT.partly : STATUS_DOT.blind;
  return (
    <span
      className={cn("inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 text-xs font-medium leading-none text-fg", className)}
      {...props}
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dot)} />
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
        <p role="status" className="absolute top-2 right-2 z-10 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-fg">
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
