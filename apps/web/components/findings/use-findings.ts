"use client";

import { useQuery } from "@tanstack/react-query";
import { api, request } from "@/lib/api";
import type { FindingsResponse } from "./types";

/** GET /api/findings (snapshot in snapshot mode; live API otherwise). */
export function useFindings() {
  return useQuery({
    queryKey: ["findings"],
    queryFn: async ({ signal }) =>
      (await request<FindingsResponse>("GET", "/api/findings", { signal }))
        .data,
    staleTime: Infinity,
    retry: false,
  });
}

/** GET /api/targets: documented atmosphere profiles (used for the Apollo line and the Moon/Mars markers). */
export function useTargets() {
  return useQuery({
    queryKey: ["findings", "targets"],
    queryFn: async ({ signal }) => (await api.targets(signal)).data,
    staleTime: Infinity,
  });
}
