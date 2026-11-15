"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { useDataMode } from "@/hooks/api/use-data-mode";
import { cn } from "@/lib/cn";
import type { ResponseMeta } from "@/lib/types";

export interface DataSourceBadgeProps {
  /** Meta of a specific response; when omitted the badge shows where the most recent response came from. */
  meta?: ResponseMeta | null;
  className?: string;
}

/** "2026-11-15T19:54:30Z" becomes "2026-11-15" (same text on server and client, no locale formatting). */
const dateOnly = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : iso);

type View = { kind: "live" | "snapshot" | "unavailable" | "connecting"; modelVersion: string | null; generatedAt: string | null };

/**
 * Tiny chip (sidebar footer / phone footer): "Precomputed data" / "Live analysis" / "Analysis unavailable". One sentence of detail shows on
 * hover and keyboard focus and is read by screen readers. `data-source` carries the state for tests.
 */
export function DataSourceBadge({ meta, className }: DataSourceBadgeProps) {
  const dm = useDataMode();

  let view: View;
  if (meta) {
    view =
      meta.source === "live"
        ? { kind: "live", modelVersion: null, generatedAt: null }
        : { kind: "snapshot", modelVersion: meta.model_version ?? dm.modelVersion, generatedAt: meta.generated_at ?? dm.generatedAt };
  } else if (dm.mode === "snapshot" || dm.status === "snapshot") {
    view = { kind: "snapshot", modelVersion: dm.modelVersion, generatedAt: dm.generatedAt };
  } else if (dm.status === "live") {
    view = { kind: "live", modelVersion: null, generatedAt: null };
  } else if (dm.status === "unavailable") {
    view = { kind: "unavailable", modelVersion: null, generatedAt: null };
  } else {
    view = { kind: "connecting", modelVersion: null, generatedAt: null };
  }

  let text: string;
  let details: string;
  switch (view.kind) {
    case "live":
      text = "Live analysis";
      details = "Computed live, on request.";
      break;
    case "snapshot":
      text = "Precomputed data";
      details = `Saved results ${view.generatedAt ? `from ${dateOnly(view.generatedAt)}` : "computed ahead of time"}; custom cabins need live analysis.`;
      break;
    case "unavailable":
      text = "Analysis unavailable";
      details = "The analysis service did not respond.";
      break;
    default:
      text = "Connecting";
      details = "Checking the analysis service.";
  }

  return (
    <Tooltip content={details} side="bottom" align="end">
      <Badge
        role="status"
        tabIndex={0}
        data-testid="data-source-badge"
        data-source={view.kind}
        data-version={view.modelVersion ?? undefined}
        className={cn(
          "h-8 gap-1.5 rounded-full border-border bg-surface px-2.5 text-[length:var(--text-label)] font-normal text-muted transition-colors hover:border-border-strong hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:h-7",
          className,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            view.kind === "live" || view.kind === "snapshot" ? "bg-fg" : "border border-muted",
            view.kind === "connecting" && "motion-safe:animate-pulse",
          )}
        />
        <span>{text}</span>
        <span className="sr-only">. {details}</span>
      </Badge>
    </Tooltip>
  );
}
