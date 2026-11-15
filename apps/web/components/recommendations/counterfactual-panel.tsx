"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PanelSkeleton } from "@/components/explore/query-state";
import { PanelError } from "@/components/target/panel-bits";
import { candidatePAllowed } from "@/components/target/evidence";
import { useCounterfactual } from "@/hooks/api";
import { fmtCmS, fmtFractionPercent, fmtOxygen, fmtPressure, fmtProbability, fmtSigned } from "@/lib/format";
import type { Candidate, HypotheticalOutcome, Plane, Target } from "@/lib/types";

export const HYPOTHETICAL_LABEL = "Hypothetical outcome — not an experimental result";

export interface CounterfactualPanelProps {
  groupId: string;
  target: Target;
  candidate: Candidate;
  plane: Plane;
  slice: number;
  showEstimate: boolean;
  outcome: HypotheticalOutcome | null;
  onOutcome: (o: HypotheticalOutcome | null) => void;
  onClose: () => void;
}

export function CounterfactualPanel({ groupId, target, candidate, plane, slice, showEstimate, outcome, onOutcome, onClose }: CounterfactualPanelProps) {
  const q = useCounterfactual({
    group_id: groupId,
    target,
    candidate: { oxygen_percent: candidate.oxygen_percent, airflow_cm_s: candidate.airflow_cm_s, pressure_kpa: candidate.pressure_kpa },
    plane,
    slice,
  });
  // Move focus to the preview when it opens (a11-06); on close, return it to the candidate's Explore button.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: false });
  }, [candidate.candidate_id]);
  const close = () => {
    onClose();
    const sel = candidate.rank === 1 ? '[data-testid="explore-candidate"]' : `button[aria-label="Explore candidate ${candidate.rank}"]`;
    requestAnimationFrame(() => document.querySelector<HTMLElement>(sel)?.focus());
  };
  // Placeholder data belongs to the previous candidate: never show it under this heading (a05-08).
  const d = q.isPlaceholderData ? undefined : q.data?.data;
  const pAtCandidate = d?.p_sustained_at_candidate ?? null;
  const candP = showEstimate && pAtCandidate !== null && candidatePAllowed({ p_sustained: pAtCandidate, latent_std_ratio: candidate.latent_std_ratio });
  const targetP = d?.target_p_supported === true;

  return (
    <section id="counterfactual-preview" aria-label="Counterfactual preview" className="space-y-3" data-testid="counterfactual-panel">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 ref={headingRef} tabIndex={-1} className="text-[13px] font-semibold outline-none">What if this were measured?</h3>
          <p className="mt-0.5 text-xs text-muted">
            Candidate {candidate.rank}: {fmtOxygen(candidate.oxygen_percent)}, {fmtPressure(candidate.pressure_kpa)}, {fmtCmS(candidate.airflow_cm_s)}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close counterfactual preview" onClick={close} className="-mt-1 -mr-1.5 size-7">
          <X aria-hidden />
        </Button>
      </div>
      <Badge tone="neutral" data-testid="hypothetical-label">{HYPOTHETICAL_LABEL}</Badge>

      {q.isError && !d ? <PanelError error={q.error} onRetry={() => void q.refetch()} what="This counterfactual preview" /> : null}
      {!d && !q.isError ? <PanelSkeleton label="Computing hypothetical outcomes" /> : null}
      {d ? (
        <>
          <p className="text-xs text-muted">
            {candP ? <>Model P(sustained) at the candidate: <span className="num text-fg">{fmtProbability(pAtCandidate)}</span>. </> : "No P(sustained) is shown at the candidate: the evidence does not support an estimate there. "}
            {targetP ? <>Target P(sustained) now <span className="num text-fg">{fmtProbability(d.current.target_p_mean)}</span>.</> : "Only the change in the target's uncertainty is reported."}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {d.scenarios.map((s) => (
              <div key={s.outcome} className="rounded-md border border-border p-2.5" data-testid={`scenario-${s.outcome}`}>
                <p className="text-xs font-medium text-fg">{s.outcome === "sustained" ? "If the flame is sustained" : "If the flame is not sustained"}</p>
                {candP ? <p className="mt-1 text-[13px]">Probability <span className="num">{fmtFractionPercent(s.probability)}</span></p> : null}
                <dl className="mt-1 space-y-0.5 text-xs text-muted">
                  {targetP ? (
                    <div className="flex justify-between gap-2">
                      <dt>Target P(sustained)</dt>
                      <dd className="num text-fg">
                        {fmtProbability(s.target_p_mean)} ({fmtSigned(s.target_p_mean - d.current.target_p_mean)})
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-2">
                    <dt>Change in target uncertainty</dt>
                    <dd className="num text-fg">{fmtFractionPercent(-s.variance_reduction_fraction)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">Expected uncertainty reduction, averaged over both outcomes: <span className="num text-fg">{fmtFractionPercent(d.expected_variance_reduction_fraction)}</span>.</p>
          <div>
            <p className="mb-1 text-xs font-medium">Show on map</p>
            <SegmentedControl
              size="sm"
              aria-label="Hypothetical surface on the map"
              value={outcome ?? "off"}
              onValueChange={(v) => onOutcome(v === "off" ? null : (v as HypotheticalOutcome))}
              options={[
                { value: "off", label: "Current model" },
                { value: "sustained", label: "If sustained" },
                { value: "not_sustained", label: "If not sustained" },
              ]}
            />
            {outcome ? (
              <p className="mt-1.5 text-xs text-muted" data-testid="hypothetical-map-note">
                Map shows the model after a hypothetical outcome{candP ? ` (${fmtFractionPercent(d.scenarios.find((s) => s.outcome === outcome)?.probability)} likely under the model)` : ""}. {HYPOTHETICAL_LABEL}.
              </p>
            ) : null}
          </div>
          <p className="text-xs text-muted">{d.note}</p>
        </>
      ) : null}
    </section>
  );
}
