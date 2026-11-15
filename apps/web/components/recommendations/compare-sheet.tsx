"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DotNumber } from "@/components/ui/dot-number";
import { Callout } from "@/components/ui/callout";
import { PanelSkeleton } from "@/components/explore/query-state";
import { PanelError } from "@/components/target/panel-bits";
import { candidatePAllowed } from "@/components/target/evidence";
import { useCompareCandidates } from "@/hooks/api";
import { feasibilityLabel, fmtCmS, fmtFractionPercent, fmtOxygen, fmtPressure, fmtProbability, reasonLabel } from "@/lib/format";
import { CANDIDATE_FRAMING } from "@/lib/copy";
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
    d?.preferred === "indistinguishable" ? "No clear winner" : d?.preferred === "a" ? `Test ${a?.rank} is better` : d?.preferred === "b" ? `Test ${b?.rank} is better` : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title="Compare two tests"
        description="Model estimates, not test results."
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
        {!d && !q.isError ? <PanelSkeleton label="Comparing tests" /> : null}
        {d ? (
          <div className="space-y-4" data-testid="compare-sheet">
            <div className="flex items-center gap-2">
              <span data-testid="compare-verdict" className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium whitespace-nowrap text-fg">
                <span aria-hidden className={`size-2 rounded-full ${d.preferred === "indistinguishable" ? "bg-border-strong" : "bg-[#2FD067]"}`} />
                {verdict}
              </span>
              <span className="text-xs text-muted">Both together cut uncertainty by <span className="num text-fg">{fmtFractionPercent(d.both_evr_fraction)}</span></span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {([["a", d.a], ["b", d.b]] as const).map(([k, c]) => {
                const win = d.preferred === k;
                return (
                  <article key={k} className={`min-w-0 p-4 sm:p-5 ${win ? "card-ink text-white" : "card"}`}>
                    <div className="flex items-center gap-2">
                      <span aria-hidden className={`num grid size-8 shrink-0 place-items-center rounded-full text-xs font-medium ${win ? "bg-white text-[#161616]" : "border border-border bg-surface text-fg"}`}>{k === "a" ? a?.rank : b?.rank}</span>
                      <h3 className="text-[16px] font-medium">Test {k === "a" ? a?.rank : b?.rank}</h3>
                    </div>
                    <p className={`num mt-2 text-xs ${win ? "text-white/70" : "text-muted"}`}>{fmtOxygen(c.oxygen_percent)}, {fmtPressure(c.pressure_kpa)}, {fmtCmS(c.airflow_cm_s)}</p>
                    <dl className="mt-3 space-y-2 text-xs">
                      <div><dt className={win ? "text-white/70" : "text-muted"}>Cuts uncertainty by</dt><DotNumber as="dd" className={`mt-1 block text-[32px] leading-none font-medium ${win ? "text-white" : "text-fg"}`}>{fmtFractionPercent(c.evr_fraction)}</DotNumber></div>
                      <div><dt className={win ? "text-white/70" : "text-muted"}>Flame chance</dt><dd>{showEstimate && candidatePAllowed(c) ? <span className="num">{fmtProbability(c.p_sustained)}</span> : "No estimate: too little evidence"}</dd></div>
                    </dl>
                  </article>
                );
              })}
            </div>
            <details className="card px-5 py-4 text-xs">
              <summary className="cursor-pointer text-[14px] font-medium">Technical details</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-muted">
                {d.reasons.filter((r) => showEstimate || r.code !== "near_decision_boundary").map((r, i) => (
                  <li key={`${r.code}-${i}`}>
                    <span className="font-medium text-fg">{reasonLabel(r.code)}.</span> {r.message}
                  </li>
                ))}
                {([d.a, d.b] as const).map((c, i) => {
                  const fe = feasibilityLabel(c.feasibility_status);
                  return <li key={`fe-${i}`}>Test {i === 0 ? a?.rank : b?.rank}: {fe.label}. {fe.disclaimer}</li>;
                })}
                {d.assumptions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </details>
            <Callout variant="info">{CANDIDATE_FRAMING}</Callout>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
