"use client";

import { CloudOff, Database, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDataMode } from "@/hooks/api/use-data-mode";
import type { ResponseMeta } from "@/lib/types";

export interface DataSourceBadgeProps {
  /** Meta of a specific response; when omitted the badge shows where the most recent response came from. */
  meta?: ResponseMeta | null;
  className?: string;
}

type View = { kind: "live" | "snapshot" | "unavailable" | "connecting"; modelVersion: string | null; generatedAt: string | null };

/**
 * "Live analysis" / "Precomputed snapshot · <model_version>" / "Analysis service unavailable".
 * In snapshot mode the snapshot badge is always visible (docs/API.md, Data modes).
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
  let title: string;
  let icon: React.ReactNode;
  switch (view.kind) {
    case "live":
      text = "Live analysis";
      title = "Results are computed by the running analysis service.";
      icon = <Radio aria-hidden />;
      break;
    case "snapshot":
      text = view.modelVersion ? `Precomputed snapshot · ${view.modelVersion}` : "Precomputed snapshot";
      title = `Results are precomputed${view.generatedAt ? ` (generated ${view.generatedAt})` : ""}; custom targets and arbitrary candidates require the live analysis service.`;
      icon = <Database aria-hidden />;
      break;
    case "unavailable":
      text = "Analysis service unavailable";
      title = "The analysis service could not be reached and no precomputed snapshot could be used.";
      icon = <CloudOff aria-hidden />;
      break;
    default:
      text = "Connecting to analysis";
      title = "Waiting for the first response from the analysis service.";
      icon = <Radio aria-hidden />;
  }

  return (
    <Badge
      role="status"
      title={title}
      data-testid="data-source-badge"
      data-source={view.kind}
      className={className}
    >
      {icon}
      <span className="num">{text}</span>
    </Badge>
  );
}
