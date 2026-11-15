"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { PanelSkeleton, QueryError } from "@/components/explore/query-state";
import { useCompareCandidates } from "@/hooks/api";
import { feasibilityLabel, fmtCmS, fmtFractionPercent, fmtOxygen, fmtPressure, fmtProbability, reasonLabel } from "@/lib/format";
import type { Candidate, Target } from "@/lib/types";

const pt = (c: Candidate) => ({ oxygen_percent: c.oxygen_percent, airflow_cm_s: c.airflow_cm_s, pressure_kpa: c.pressure_kpa });

/** Feature B: two candidates side by side (POST /api/candidates/compare). */
export function CompareSheet({
  open,
  onOpenChange,
  groupId,
  target,
  showEstimate,
  a,
  b,
}: {
  showEstimate: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId: string;
  target: Target;
  a: Candidate | null;
  b: Candidate | null;
}) {
  const q = useCompareCandidates(open && a && b ? { group_id: groupId, target, a: pt(a), b: pt(b) } : null);
  const d = q.data?.data;
  const verdict =
    d?.preferred === "indistinguishable" ? "Indistinguishable" : d?.preferred === "a" ? `Candidate ${a?.rank} preferred` : d?.preferred === "b" ? `Candidate ${b?.rank} preferred` : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Compare candidates" description="Computational research candidates; hypothetical model estimates only." className="sm:max-w-[640px]">
        {q.isError && !d ? <QueryError error={q.error} onRetry={() => void q.refetch()} /> : null}
        {!d && !q.isError ? <PanelSkeleton label="Comparing candidates" /> : null}
        {d ? (
          <div className="space-y-4" data-testid="compare-sheet">
            <div className="flex items-center gap-2">
              <Badge tone={d.preferred === "indistinguishable" ? "neutral" : "accent"} data-testid="compare-verdict">{verdict}</Badge>
              <span className="num text-xs text-muted">Both together: {fmtFractionPercent(d.both_evr_fraction)} expected reduction</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([["a", d.a], ["b", d.b]] as const).map(([k, c]) => {
                const fe = feasibilityLabel(c.feasibility_status);
                return (
                  <article key={k} className={`rounded-md border p-3 ${d.preferred === k ? "border-accent" : "border-border"}`}>
                    <h3 className="text-[13px] font-semibold">Candidate {k === "a" ? a?.rank : b?.rank}</h3>
                    <dl className="num mt-2 space-y-1.5 text-xs">
                      <div><dt className="text-muted">Oxygen</dt><dd>{fmtOxygen(c.oxygen_percent)}</dd></div>
                      <div><dt className="text-muted">Pressure</dt><dd>{fmtPressure(c.pressure_kpa)}</dd></div>
                      <div><dt className="text-muted">Airflow</dt><dd>{fmtCmS(c.airflow_cm_s)}</dd></div>
                      <div><dt className="text-muted">Expected reduction</dt><dd className="text-sm font-medium">{fmtFractionPercent(c.evr_fraction)}</dd></div>
                      <div><dt className="text-muted">P(sustained)</dt><dd>{showEstimate ? fmtProbability(c.p_sustained) : "n/a (reverts to training base rate)"}</dd></div>
                      <div><dt className="text-muted">Feasibility</dt><dd className="font-sans">{fe.label}. {fe.disclaimer}</dd></div>
                    </dl>
                  </article>
                );
              })}
            </div>
            <section>
              <h3 className="mb-1 text-xs font-medium">Reasons</h3>
              <ul className="space-y-1">
                {d.reasons.filter((r) => showEstimate || r.code !== "near_decision_boundary").map((r, i) => (
                  <li key={`${r.code}-${i}`} className="text-xs">
                    <span className="font-medium">{reasonLabel(r.code)}.</span> <span className="text-muted">{r.message}</span>
                  </li>
                ))}
              </ul>
            </section>
            <details className="rounded-md border border-border px-3 py-2 text-xs">
              <summary className="cursor-pointer text-[13px] font-medium">Assumptions</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-muted">
                {d.assumptions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </details>
            <Callout variant="info">Computational research candidates requiring qualified scientific review, established safety procedures and formal feasibility assessment.</Callout>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
