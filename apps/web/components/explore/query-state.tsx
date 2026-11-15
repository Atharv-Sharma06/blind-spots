"use client";

import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Callout } from "@/components/ui/callout";
import { isApiError } from "@/lib/api";

export function PanelSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div className="space-y-2 py-1" role="status" aria-label={label}>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}

/** Typed error for a failed query; snapshot gaps get the honest "requires the live analysis service" text. */
export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (isApiError(error) && error.snapshotUnavailable) {
    return (
      <Callout variant="info" title="Requires the live analysis service">
        This result is not in the precomputed snapshot. Run the analysis service locally to compute it.
      </Callout>
    );
  }
  if (isApiError(error)) return <ErrorState code={error.code} message={error.message} onRetry={onRetry} compact />;
  return <ErrorState code="backend_unavailable" onRetry={onRetry} compact />;
}
