"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useExploreStore } from "@/lib/explore-store";
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
  /**
   * True when slice values / custom targets must snap to / be limited by the snapshot: snapshot mode, or
   * auto mode while the live service is down (answers come from the snapshot; a05-13).
   */
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
  // Explore slices snap to the exported slices while answers come from the snapshot (idempotent).
  const snap = isSnapshot ? (manifest?.slices ?? null) : null;
  useEffect(() => {
    if (!isSnapshot || snap) useExploreStore.getState().setSnapSlices(snap);
  }, [isSnapshot, snap]);
  return {
    mode,
    status,
    isSnapshot,
    snapshotOnly: isSnapshot,
    manifest,
    slices: manifest?.slices ?? null,
    modelVersion: storeModel ?? manifest?.model_version ?? null,
    generatedAt: storeGenerated ?? manifest?.generated_at ?? null,
    manifestLoading: m.fetchStatus === "fetching",
  };
}
