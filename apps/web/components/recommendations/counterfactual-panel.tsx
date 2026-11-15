"use client";

import { useEffect, useRef } from "react";
import { DotNumber } from "@/components/ui/dot-number";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PanelSkeleton } from "@/components/explore/query-state";
import { PanelError } from "@/components/target/panel-bits";
import { candidatePAllowed } from "@/components/target/evidence";
import { useCounterfactual } from "@/hooks/api";
import { pct, pctSigned } from "@/components/explore/plain";
import { fmtCmS, fmtFractionPercent, fmtOxygen, fmtPressure } from "@/lib/format";
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
    const sel = candidate.rank === 1 ? '[data-testid="explore-candidate"]' : `button[aria-label="What if? Test ${candidate.rank}"]`;
    requestAnimationFrame(() => document.querySelector<HTMLElement>(sel)?.focus());
  };
  // Placeholder data belongs to the previous candidate: never show it under this heading (a05-08).
  const d = q.isPlaceholderData ? undefined : q.data?.data;
  const pAtCandidate = d?.p_sustained_at_candidate ?? null;
  const candP = showEstimate && pAtCandidate !== null && candidatePAllowed({ p_sustained: pAtCandidate, latent_std_ratio: candidate.latent_std_ratio });
  const targetP = d?.target_p_supported === true;

  return (
    <section id="counterfactual-preview" aria-label="What-if preview" className="card-indigo space-y-4 p-5 text-white sm:p-6" data-testid="counterfactual-panel">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 ref={headingRef} tabIndex={-1} className="text-[17px] font-semibold outline-none">If test {candidate.rank} were done</h3>
          <p className="num mt-0.5 text-xs text-white/75">
            {fmtOxygen(candidate.oxygen_percent)}, {fmtPressure(candidate.pressure_kpa)}, {fmtCmS(candidate.airflow_cm_s)}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close what-if preview" onClick={close} className="-mt-1 -mr-1.5 size-10 rounded-full bg-black/30 text-white hover:bg-black/50">
          <X aria-hidden />
        </Button>
      </div>

      {q.isError && !d ? <PanelError error={q.error} onRetry={() => void q.refetch()} what="This counterfactual preview" /> : null}
      {!d && !q.isError ? <PanelSkeleton label="Working out the what-if" /> : null}
      {d ? (
        <>
          <ul className="space-y-2">
            {d.scenarios.map((s) => (
              <li key={s.outcome} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[var(--radius-lg)] bg-black/30 px-4 py-3 ring-1 ring-white/10" data-testid={`scenario-${s.outcome}`}>
                <span className="min-w-[10rem] flex-1 text-[14px] font-medium text-white">
                  {s.outcome === "sustained" ? "If the flame keeps burning" : "If it goes out"}
                  {candP ? <span className="block text-xs text-white/70">{fmtFractionPercent(s.probability)} likely</span> : null}
                </span>
                <span className="ml-auto shrink-0 text-right">
                  <span className="block text-xs text-white/70">uncertainty </span>
                  <DotNumber className="mt-1 block text-[28px] text-white">{pctSigned(-s.variance_reduction_fraction)}</DotNumber>
                  {targetP ? (
                    <span className="num mt-1 block text-xs text-white/70">
                      flame chance {pct(s.target_p_mean)} ({pctSigned(s.target_p_mean - d.current.target_p_mean)})
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-white/75">
            On average, uncertainty about this cabin drops by <span className="num font-semibold text-periwinkle">{pct(d.expected_variance_reduction_fraction)}</span>.
            {candP ? null : " No flame estimate there: too little evidence."}
            {targetP ? <> Flame chance now: <span className="num text-white">{pct(d.current.target_p_mean)}</span>.</> : null}
          </p>
          <Badge tone="neutral" data-testid="hypothetical-label" className="h-auto max-w-full whitespace-normal py-1 leading-snug">{HYPOTHETICAL_LABEL}</Badge>
          <div>
            <p className="mb-1 text-xs font-medium">Show on the chart</p>
            <SegmentedControl
              size="sm"
              aria-label="Show on the chart"
              value={outcome ?? "off"}
              onValueChange={(v) => onOutcome(v === "off" ? null : (v as HypotheticalOutcome))}
              options={[
                { value: "off", label: "Now" },
                { value: "sustained", label: "If it burns" },
                { value: "not_sustained", label: "If it goes out" },
              ]}
            />
            {outcome ? (
              <p className="mt-1.5 text-xs text-white/75" data-testid="hypothetical-map-note">
                The chart shows the model after this made-up result.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
