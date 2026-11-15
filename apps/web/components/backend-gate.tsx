"use client";

import type { ReactNode } from "react";
import { useHealth } from "@/hooks/use-health";
import { ErrorState } from "@/components/ui/error-state";
import { Callout } from "@/components/ui/callout";

export interface BackendGateProps {
  /** Rendered while the first health check is in flight. */
  loading: ReactNode;
  /** Rendered when the service responds (ok or degraded). */
  children: ReactNode;
  compact?: boolean;
  align?: "start" | "center";
}

/**
 * Honest gate for panels that need the analysis service. Shows loading, a typed error when the
 * service is unreachable, and a degraded notice above the content when it answers but is unhealthy.
 */
export function BackendGate({ loading, children, compact, align }: BackendGateProps) {
  const { state, error, refetch } = useHealth();
  if (state === "loading") return <>{loading}</>;
  if (state === "unavailable") {
    return <ErrorState code={error?.code ?? "backend_unavailable"} message={error?.message} onRetry={refetch} compact={compact} align={align} />;
  }
  return (
    <>
      {state === "degraded" ? (
        <Callout variant="warning" title="The analysis service reports a degraded state" className="mb-3">
          Some results may be missing until its dataset or model artifacts are available.
        </Callout>
      ) : null}
      {children}
    </>
  );
}
