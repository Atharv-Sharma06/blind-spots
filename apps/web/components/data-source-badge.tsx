"use client";

import { CloudOff, Database, Radio } from "lucide-react";
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
 * Small, quiet chip in the header: "Precomputed data" / "Live analysis" / "Analysis unavailable". The details (when
 * saved results were computed, what they cannot do) appear on hover and keyboard focus, and are read
 * by screen readers. `data-source` carries the state for tests.
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
  let icon: React.ReactNode;
  switch (view.kind) {
    case "live":
      text = "Live analysis";
      details = "Results are computed on request.";
      icon = <Radio aria-hidden />;
      break;
    case "snapshot": {
      const saved = view.generatedAt ? `These answers were computed on ${dateOnly(view.generatedAt)} and saved with the site.` : "These answers were computed ahead of time and saved with the site.";
      details =
        (dm.mode === "auto" ? "The live service did not respond, so you see saved results. " : "") +
        saved +
        " Custom cabins and custom experiments need the full local version.";
      text = "Precomputed data";
      icon = <Database aria-hidden />;
      break;
    }
    case "unavailable":
      text = "Analysis unavailable";
      details = "The live service could not be reached and no saved results could be used.";
      icon = <CloudOff aria-hidden />;
      break;
    default:
      text = "Connecting";
      details = "Waiting for the first response.";
      icon = <Radio aria-hidden />;
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
          "h-10 gap-1.5 rounded-md border-transparent bg-transparent px-1.5 font-normal md:h-6 text-muted transition-colors hover:border-border hover:text-fg",
          className,
        )}
      >
        {icon}
        <span>{text}</span>
        <span className="sr-only">. {details}</span>
      </Badge>
    </Tooltip>
  );
}
