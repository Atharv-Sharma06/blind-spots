"use client";

import type { ReactNode } from "react";
import { BackendGate } from "@/components/backend-gate";
import { Skeleton } from "@/components/ui/skeleton";

/** Table-shaped loading placeholder. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-1" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

export function DataPageState({ children }: { children: ReactNode }) {
  return <BackendGate loading={<TableSkeleton />}>{children}</BackendGate>;
}
