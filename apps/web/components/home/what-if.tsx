"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useCounterfactual } from "@/hooks/api";
import { fmtFixed, isNum } from "@/lib/format";
import type { Candidate, CounterfactualResponse } from "@/lib/types";

/** Binding sentence (SPEC hard rules): the numbers below are model updates, never results. */
export const WHAT_IF_DISCLAIMER = "Hypothetical model updates, not experimental results.";

/**
 * The plain view only reads the scalar change in uncertainty, which does not depend on the plane or slice the
 * Explorer would draw. This pair has a precomputed answer for every cabin x material x top-3 candidate in the
 * snapshot, so the same request works in snapshot and live mode.
 */
const WHAT_IF_PLANE = "o2_pressure" as const;
const WHAT_IF_SLICE = 3;

/** "−18 %": the drop in uncertainty as a signed percentage (proper minus sign). */
export function uncertaintyChange(reductionFraction: number): string {
  return `${fmtFixed(-reductionFraction * 100, 0)} %`;
}

interface Row {
  key: "sustained" | "not_sustained";
  label: string;
  value: string | null;
}

function rows(d: CounterfactualResponse): Row[] {
  const pick = (o: "sustained" | "not_sustained") => d.scenarios.find((s) => s.outcome === o);
  const val = (o: "sustained" | "not_sustained") => {
    const f = pick(o)?.variance_reduction_fraction;
    return isNum(f) ? uncertaintyChange(f) : null;
  };
  return [
    { key: "sustained", label: "If the flame keeps burning", value: val("sustained") },
    { key: "not_sustained", label: "If it goes out", value: val("not_sustained") },
  ];
}

export interface WhatIfProps {
  /** Cabin (atmosphere profile id). */
  cabin: string;
  /** Material (analysis group id) the ranking was made for. */
  groupId: string;
  /** Candidate 1 of the ranking. */
  candidate: Candidate;
}

/** "What would we learn?": how the model's uncertainty about the cabin changes if candidate 1 were measured. */
export function WhatIf({ cabin, groupId, candidate }: WhatIfProps) {
  const q = useCounterfactual({
    group_id: groupId,
    target: { profile_id: cabin },
    candidate: { oxygen_percent: candidate.oxygen_percent, airflow_cm_s: candidate.airflow_cm_s, pressure_kpa: candidate.pressure_kpa },
    plane: WHAT_IF_PLANE,
    slice: WHAT_IF_SLICE,
  });
  const d = q.data?.data;
  const list = d ? rows(d) : [];
  const complete = list.length === 2 && list.every((r) => r.value !== null);

  return (
    <div id="what-if" data-tour="what-if" aria-labelledby="what-if-h" role="group" className="scroll-mt-20 rounded-xl border border-border bg-subtle p-4 md:p-6">
      <h3 id="what-if-h" className="text-title font-semibold">
        What would we learn?
      </h3>
      <p className="mt-1 text-prose text-muted">Uncertainty change after test 1:</p>

      <div className="mt-4 min-h-[7.5rem] md:min-h-[4rem]" aria-busy={!d && !q.isError ? true : undefined}>
        {complete ? (
          <ul className="grid gap-2 md:grid-cols-2" aria-label="Uncertainty change after test 1">
            {list.map((r) => (
              <li key={r.key} className="flex min-h-12 items-baseline justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3" data-testid={`what-if-${r.key}`}>
                <span className="text-prose">{r.label}</span>
                <span className="num whitespace-nowrap text-title font-semibold">{r.value}</span>
              </li>
            ))}
          </ul>
        ) : q.isError && !d ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-prose text-muted">
              {q.error?.snapshotUnavailable ? "No preview for this cabin and material." : "Could not load the preview."}
            </p>
            {q.error?.snapshotUnavailable ? null : (
              <Button variant="secondary" className="h-10 px-4 md:h-9" onClick={() => void q.refetch()}>
                Try again
              </Button>
            )}
          </div>
        ) : d ? (
          <p className="text-prose text-muted">No preview for this cabin and material.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2" role="status" aria-label="Loading">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
        )}
      </div>

      <p className="mt-4 text-ui font-medium">{WHAT_IF_DISCLAIMER}</p>
    </div>
  );
}
