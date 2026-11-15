"use client";

import { useQuery } from "@tanstack/react-query";
import { useDataSourceStore, type DataSourceStatus } from "@/lib/api";
import { getDataMode, loadSnapshotManifest } from "@/lib/snapshot";
import type { DataMode, SnapshotManifest } from "@/lib/types";
import { queryKeys } from "./keys";

export interface UseDataMode {
  /** NEXT_PUBLIC_DATA_MODE (default auto). */
  mode: DataMode;
  /** What the most recent response came from. */
  status: DataSourceStatus;
  /** True when answers come from the precomputed snapshot (snapshot mode, or auto after fallback). */
  isSnapshot: boolean;
  /** True when slice values / custom targets must snap to / be limited by the snapshot. */
  snapshotOnly: boolean;
  manifest: SnapshotManifest | null;
  /** manifest.slices; null until the manifest loads (or when no snapshot is deployed). */
  slices: SnapshotManifest["slices"] | null;
  modelVersion: string | null;
  generatedAt: string | null;
  manifestLoading: boolean;
}

/**
 * Data mode + snapshot manifest. The manifest is fetched once (cached) only when the snapshot is in use (mode `snapshot`, or `auto` after a fallback).
 * Feature code uses `isSnapshot` / `slices` to snap the slice control and to show
 * "requires the live analysis service" for custom targets and arbitrary candidates.
 */
export function useDataMode(): UseDataMode {
  const mode = getDataMode();
  const status = useDataSourceStore((s) => s.status);
  const storeModel = useDataSourceStore((s) => s.modelVersion);
  const storeGenerated = useDataSourceStore((s) => s.generatedAt);
  const m = useQuery<SnapshotManifest, Error>({
    queryKey: queryKeys.snapshotManifest(),
    queryFn: () => loadSnapshotManifest(),
    enabled: mode === "snapshot" || status === "snapshot",
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  const manifest = m.data ?? null;
  const isSnapshot = mode === "snapshot" || status === "snapshot";
  return {
    mode,
    status,
    isSnapshot,
    snapshotOnly: mode === "snapshot",
    manifest,
    slices: manifest?.slices ?? null,
    modelVersion: storeModel ?? manifest?.model_version ?? null,
    generatedAt: storeGenerated ?? manifest?.generated_at ?? null,
    manifestLoading: m.fetchStatus === "fetching",
  };
}
