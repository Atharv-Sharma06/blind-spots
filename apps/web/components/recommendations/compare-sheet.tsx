"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { PanelSkeleton } from "@/components/explore/query-state";
import { PanelError } from "@/components/target/panel-bits";
import { candidatePAllowed } from "@/components/target/evidence";
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
  a: pickA,
  b: pickB,
}: {
  showEstimate: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId: string;
  target: Target;
  a: Candidate | null;
  b: Candidate | null;
}) {
  // Canonical order by rank (the snapshot exports pairs (1,2), (1,3), (2,3)); results map back by rank.
  const [a, b] = pickA && pickB && pickB.rank < pickA.rank ? [pickB, pickA] : [pickA, pickB];
  const q = useCompareCandidates(open && a && b ? { group_id: groupId, target, a: pt(a), b: pt(b) } : null);
  // Placeholder data belongs to the previous pair: never show it under the new headings (a05-08).
  const d = q.isPlaceholderData ? undefined : q.data?.data;
  const verdict =
    d?.preferred === "indistinguishable" ? "Indistinguishable" : d?.preferred === "a" ? `Candidate ${a?.rank} preferred` : d?.preferred === "b" ? `Candidate ${b?.rank} preferred` : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title="Compare candidates"
        description="Two candidates side by side. Hypothetical model estimates only."
        className="sm:max-w-[640px]"
        onCloseAutoFocus={(e) => {
          // Return focus to the button that opened the sheet (WCAG 2.4.3, a11-05).
          const btn = document.querySelector<HTMLElement>('[data-testid="open-compare"]');
          if (btn) {
            e.preventDefault();
            btn.focus();
          }
        }}
      >
        {q.isError && !d ? <PanelError error={q.error} onRetry={() => void q.refetch()} what="This comparison" /> : null}
        {!d && !q.isError ? <PanelSkeleton label="Comparing candidates" /> : null}
        {d ? (
          <div className="space-y-4" data-testid="compare-sheet">
            <div className="flex items-center gap-2">
              <Badge tone={d.preferred === "indistinguishable" ? "neutral" : "accent"} data-testid="compare-verdict">{verdict}</Badge>
              <span className="text-xs text-muted">Both together would cut uncertainty by <span className="num text-fg">{fmtFractionPercent(d.both_evr_fraction)}</span></span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {([["a", d.a], ["b", d.b]] as const).map(([k, c]) => {
                const fe = feasibilityLabel(c.feasibility_status);
                return (
                  <article key={k} className={`min-w-0 rounded-md border p-2.5 sm:p-3 ${d.preferred === k ? "border-accent" : "border-border"}`}>
                    <h3 className="text-[13px] font-semibold">Test {k === "a" ? a?.rank : b?.rank}</h3>
                    <dl className="mt-2 space-y-1.5 text-xs">
                      <div><dt className="text-muted">Oxygen</dt><dd className="num">{fmtOxygen(c.oxygen_percent)}</dd></div>
                      <div><dt className="text-muted">Pressure</dt><dd className="num">{fmtPressure(c.pressure_kpa)}</dd></div>
                      <div><dt className="text-muted">Airflow</dt><dd className="num">{fmtCmS(c.airflow_cm_s)}</dd></div>
                      <div><dt className="text-muted">Cuts uncertainty by</dt><dd className="num text-sm font-medium">{fmtFractionPercent(c.evr_fraction)}</dd></div>
                      <div><dt className="text-muted">Chance the flame burns</dt><dd>{showEstimate && candidatePAllowed(c) ? <span className="num">{fmtProbability(c.p_sustained)}</span> : "Not shown: the evidence does not support an estimate here"}</dd></div>
                      <div><dt className="text-muted">Feasibility</dt><dd>{fe.label}. {fe.disclaimer}</dd></div>
                    </dl>
                  </article>
                );
              })}
            </div>
            <section>
              <h3 className="mb-1 text-xs font-medium">Why</h3>
              <ul className="space-y-1">
                {d.reasons.filter((r) => showEstimate || r.code !== "near_decision_boundary").map((r, i) => (
                  <li key={`${r.code}-${i}`} className="text-xs">
                    <span className="font-medium">{reasonLabel(r.code)}.</span> <span className="text-muted">{r.message}</span>
                  </li>
                ))}
              </ul>
            </section>
            <details className="rounded-md border border-border px-3 py-2 text-xs">
              <summary className="cursor-pointer text-[13px] font-medium">Technical details: assumptions</summary>
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
