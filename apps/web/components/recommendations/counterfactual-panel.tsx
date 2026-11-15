"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PanelSkeleton, QueryError } from "@/components/explore/query-state";
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
  const d = q.data?.data;

  return (
    <section id="counterfactual-preview" aria-label="Counterfactual preview" className="space-y-3" data-testid="counterfactual-panel">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold">What if this were measured?</h3>
          <p className="num mt-0.5 text-xs text-muted">
            Candidate {candidate.rank}: {fmtOxygen(candidate.oxygen_percent)}, {fmtPressure(candidate.pressure_kpa)}, {fmtCmS(candidate.airflow_cm_s)}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close counterfactual preview" onClick={onClose} className="-mt-1 -mr-1.5 size-7">
          <X aria-hidden />
        </Button>
      </div>
      <Badge tone="neutral" data-testid="hypothetical-label">{HYPOTHETICAL_LABEL}</Badge>

      {q.isError && !d ? <QueryError error={q.error} onRetry={() => void q.refetch()} /> : null}
      {!d && !q.isError ? <PanelSkeleton label="Computing hypothetical outcomes" /> : null}
      {d ? (
        <>
          {showEstimate ? (
            <p className="num text-xs text-muted">
              Model P(sustained) at the candidate: {fmtProbability(d.p_sustained_at_candidate)}. Target P(sustained) now {fmtProbability(d.current.target_p_mean)}.
            </p>
          ) : (
            <p className="text-xs text-muted">P(sustained) is not shown: it is n/a (reverts to training base rate) for a target without comparable evidence. Only the change in uncertainty is reported.</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {d.scenarios.map((s) => (
              <div key={s.outcome} className="rounded-md border border-border p-2.5" data-testid={`scenario-${s.outcome}`}>
                <p className="text-xs font-medium text-fg">{s.outcome === "sustained" ? "If the flame is sustained" : "If the flame is not sustained"}</p>
                {showEstimate ? <p className="num mt-1 text-[13px]">Probability {fmtFractionPercent(s.probability)}</p> : null}
                <dl className="num mt-1 space-y-0.5 text-xs text-muted">
                  {showEstimate ? (
                    <div className="flex justify-between gap-2">
                      <dt>Target P(sustained)</dt>
                      <dd className="text-fg">
                        {fmtProbability(s.target_p_mean)} ({fmtSigned(s.target_p_mean - d.current.target_p_mean)})
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-2">
                    <dt>Target uncertainty</dt>
                    <dd className="text-fg">{fmtFractionPercent(-s.variance_reduction_fraction)} variance</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
          <p className="num text-xs text-muted">Expected variance reduction across both outcomes: {fmtFractionPercent(d.expected_variance_reduction_fraction)}.</p>
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
                Map shows the model after a hypothetical outcome{showEstimate ? ` (${fmtFractionPercent(d.scenarios.find((s) => s.outcome === outcome)?.probability)} likely under the model)` : ""}. {HYPOTHETICAL_LABEL}.
              </p>
            ) : null}
          </div>
          <p className="text-xs text-muted">{d.note}</p>
        </>
      ) : null}
    </section>
  );
}
