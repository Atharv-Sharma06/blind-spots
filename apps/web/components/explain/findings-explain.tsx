"use client";

import * as React from "react";
import type { FindingsResponse } from "@/components/findings/types";
import { ExplainButton } from "./explain-button";

/** Stays under the route's 6 KB body limit with room for the JSON envelope. */
const MAX_CONTEXT_BYTES = 5_000;

const bytes = (v: unknown): number => new TextEncoder().encode(JSON.stringify(v)).length;

/** The Findings page context for "Explain with SI": the summary counts, the top materials' finding sentences and the top cabins' sentences. */
export function findingsContext(d: FindingsResponse): Record<string, unknown> {
  const materials = [...d.materials].sort((a, b) => a.rank - b.rank);
  const cabins = [...d.cabins].sort((a, b) => a.rank - b.rank);
  const build = (nMat: number, perMat: number, withInterpretation: boolean, nCab: number) => ({
    page_title: "What the ISS fire tests show",
    iss_test_results: d.summary.n_observations,
    kept_burning: d.summary.n_sustained,
    went_out: d.summary.n_not_sustained,
    materials: d.summary.n_groups,
    ranking_rule: d.ranking_rule,
    top_materials: materials.slice(0, nMat).map((m) => ({
      rank: m.rank,
      material: m.label,
      iss_test_results: m.n_observations,
      findings: m.findings.slice(0, perMat).map((f) => (withInterpretation ? { headline: f.headline, interpretation: f.interpretation } : f.headline)),
    })),
    cabins_ranked: cabins.slice(0, nCab).map((c) => c.sentence),
  });
  // Largest context that fits, trimming the least important parts first.
  for (const [nMat, perMat, interp, nCab] of [
    [3, 3, true, 3],
    [3, 2, true, 3],
    [3, 2, false, 3],
    [2, 2, false, 2],
    [1, 2, false, 1],
  ] as const) {
    const c = build(nMat, perMat, interp, nCab);
    if (bytes(c) <= MAX_CONTEXT_BYTES) return c;
  }
  return build(1, 1, false, 0);
}

export function FindingsExplain({ data, className }: { data: FindingsResponse; className?: string }) {
  const context = React.useMemo(() => findingsContext(data), [data]);
  return <ExplainButton kind="findings" context={context} className={className} />;
}
