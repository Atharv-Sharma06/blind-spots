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
 * Verdict chip: supported = periwinkle (covered), extrapolation = yellow (partly covered),
 * insufficient evidence = magenta/plum (blind spot). The words always carry the meaning too.
 */
export function VerdictBadge({ verdict, className, ...props }: { verdict: Verdict } & React.HTMLAttributes<HTMLSpanElement>) {
  const tone =
    verdict === "supported"
      ? "border-observed/30 bg-observed-tint text-periwinkle px-2.5"
      : verdict === "extrapolation"
        ? "border-accent/30 bg-accent-tint text-accent px-2.5"
        : "border-plum-3 bg-plum-2 text-plum-7 px-2.5";
  return (
    <span
      className={cn("inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full border text-xs font-medium leading-none", tone, className)}
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
        <p role="status" className="absolute top-2 right-2 z-10 rounded-full border border-border-strong bg-subtle px-2.5 py-0.5 text-xs text-fg">
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
