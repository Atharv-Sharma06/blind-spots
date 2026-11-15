import { canonicalJson } from "@/lib/snapshot";

/**
 * Stable TanStack Query keys. GET keys carry the (cleaned) params object; POST keys carry the canonical
 * JSON of the body (keys sorted recursively), so equal requests share a cache entry.
 */
export const queryKeys = {
  all: ["api"] as const,
  health: () => ["api", "health"] as const,
  investigations: () => ["api", "investigations"] as const,
  groups: () => ["api", "groups"] as const,
  experiments: (q: unknown) => ["api", "experiments", canonicalJson(q ?? {})] as const,
  experiment: (id: string) => ["api", "experiment", id] as const,
  observations: (group: string | null | undefined) => ["api", "observations", group ?? null] as const,
  targets: () => ["api", "targets"] as const,
  context: () => ["api", "context"] as const,
  coverage: (q: unknown) => ["api", "coverage", canonicalJson(q)] as const,
  surface: (q: unknown) => ["api", "surface", canonicalJson(q)] as const,
  predict: (body: unknown) => ["api", "predict", canonicalJson(body)] as const,
  assess: (body: unknown) => ["api", "target-assess", canonicalJson(body)] as const,
  rank: (body: unknown) => ["api", "candidates-rank", canonicalJson(body)] as const,
  compare: (body: unknown) => ["api", "candidates-compare", canonicalJson(body)] as const,
  counterfactual: (body: unknown) => ["api", "candidates-counterfactual", canonicalJson(body)] as const,
  modelMetadata: (group: string | null | undefined) => ["api", "model-metadata", group ?? null] as const,
  validation: () => ["api", "model-validation"] as const,
  methodology: () => ["api", "methodology"] as const,
  sources: () => ["api", "sources"] as const,
  brief: (body: unknown) => ["api", "brief", canonicalJson(body)] as const,
  snapshotManifest: () => ["snapshot", "manifest"] as const,
};
