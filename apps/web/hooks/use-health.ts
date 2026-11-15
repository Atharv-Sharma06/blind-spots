"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isApiError, type ApiError } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";

export type BackendState = "loading" | "ok" | "degraded" | "unavailable";

export interface UseHealth {
  state: BackendState;
  health: HealthResponse | undefined;
  error: ApiError | null;
  refetch: () => void;
}

/** Polls /api/health. Single source of truth for "is the analysis service usable?". */
export function useHealth(): UseHealth {
  const q = useQuery<HealthResponse, Error>({
    queryKey: ["health"],
    queryFn: ({ signal }) => api.health(signal),
    retry: false,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  let state: BackendState;
  if (q.data) state = q.data.status === "ok" ? "ok" : "degraded";
  else if (q.isError) state = "unavailable";
  else state = "loading";

  return {
    state,
    health: q.data,
    error: q.error && isApiError(q.error) ? q.error : null,
    refetch: () => void q.refetch(),
  };
}
