"use client";

import { Crosshair, GitCompareArrows } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PanelSkeleton } from "@/components/explore/query-state";
import { cn } from "@/lib/cn";
import { feasibilityLabel, fmtCmS, fmtFixed, fmtFractionPercent, fmtKpa, fmtOxygen, fmtProbability, fmtPsia, kpaToPsia, reasonLabel } from "@/lib/format";
import type { Candidate, GroupSummary, RankResponse } from "@/lib/types";
import type { ApiQuery } from "@/hooks/api";
import { candidatePAllowed, distanceToTarget } from "@/components/target/evidence";
import { Disclosure, PanelError, Updating } from "@/components/target/panel-bits";

export interface CandidatePanelProps {
  query: ApiQuery<RankResponse>;
  group: GroupSummary | null;
  modelled: boolean;
  /** Kept for the workspace; candidate P is gated per point (D2) via candidatePAllowed. */
  showEstimate: boolean;
  pending: boolean;
  selectedId: string | null;
  compareIds: [string | null, string | null];
  onExplore: (c: Candidate) => void;
  onToggleCompare: (id: string) => void;
  onOpenCompare: () => void;
}

const isAssumptionDependent = (c: Candidate) => c.reasons.some((r) => r.code === "assumption_dependent");

export const AT_TARGET_TEXT =
  "The most informative single experiment is at the target conditions themselves; this follows from the model's distance-based (stationary) correlation assumption.";

function Conditions({ c }: { c: Candidate }) {
  return (
    <dl className="grid grid-cols-3 gap-2 text-xs">
      <div className="min-w-0">
        <dt className="text-muted">Oxygen</dt>
        <dd className="num text-[13px] text-fg">{fmtOxygen(c.oxygen_percent)}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-muted">Pressure</dt>
        <dd className="num text-[13px] whitespace-nowrap text-fg">{fmtKpa(c.pressure_kpa)}</dd>
        <dd className="num text-xs whitespace-nowrap text-muted">{fmtPsia(kpaToPsia(c.pressure_kpa))}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-muted">Airflow</dt>
        <dd className="num text-[13px] whitespace-nowrap text-fg">{fmtCmS(c.airflow_cm_s)}</dd>
      </div>
    </dl>
  );
}

const shortCond = (c: Candidate) => `${fmtOxygen(c.oxygen_percent, 1)}, ${fmtKpa(c.pressure_kpa)}, ${fmtCmS(c.airflow_cm_s)}`;

function CompareToggle({ id, ids, onToggle }: { id: string; ids: [string | null, string | null]; onToggle: (id: string) => void }) {
  const on = ids.includes(id);
  return (
    <Button variant={on ? "primary" : "secondary"} size="sm" aria-pressed={on} onClick={() => onToggle(id)}>
      <GitCompareArrows aria-hidden />
      {on ? "In comparison" : "Compare"}
    </Button>
  );
}

export function CandidatePanel(p: CandidatePanelProps) {
  const { query, group, modelled, pending, selectedId, compareIds, onExplore, onToggleCompare, onOpenCompare } = p;
  if (!modelled) {
    return (
      <EmptyState
        compact
        title="No candidates for this group"
        description={`${group?.label ?? "This group"} has too few training observations for a model (${group?.model_reason ?? "insufficient data"}). Coverage is still shown on the map.`}
      />
    );
  }
  const r = query.data?.data;
  if (query.isError && !r) return <PanelError error={query.error} onRetry={() => void query.refetch()} what="This ranking" />;
  if (!r) return <PanelSkeleton label="Ranking candidates" />;
  if (r.status !== "ok" || r.candidates.length === 0) {
    return (
      <Updating active={pending}>
        <EmptyState
          compact
          title={r.status === "model_unavailable" ? "Model unavailable" : r.status === "no_informative_candidates" ? "No informative candidates" : "No eligible candidates"}
          description={
            r.status === "model_unavailable"
              ? "No trained model is available for this group."
              : r.status === "no_informative_candidates"
                ? "Under the model, no candidate in the analysis domain is correlated with this target, so none would reduce its uncertainty and a ranking would only reflect tie-breaking."
                : "No candidate in the analysis domain adds information about this target."
          }
        />
      </Updating>
    );
  }

  const top = r.candidates[0] as Candidate;
  const rest = r.candidates.slice(1);
  const fe = feasibilityLabel(top.feasibility_status);
  const compareReady = compareIds[0] !== null && compareIds[1] !== null;
  const far = top.nn_distance > 1;
  const showP = candidatePAllowed(top);
  const dTarget = distanceToTarget(top, r.target);
  const backendAtTarget = top.reasons.some((x) => (x.code as string) === "at_target_conditions");
  const atTarget = !backendAtTarget && dTarget !== null && dTarget <= 1;
  const why = top.reasons.filter((x) => x.code !== "assumption_dependent" && (showP || x.code !== "near_decision_boundary"));
  const baselines: Array<[string, Candidate | null]> = [
    ["Random", r.baselines.random],
    ["Uncertainty sampling", r.baselines.uncertainty_sampling],
    ["Nearest gap", r.baselines.nearest_gap],
  ];

  return (
    <Updating active={pending}>
      <div className="space-y-4" data-testid="candidate-panel">
        <article
          aria-label="Top candidate"
          data-testid="top-candidate"
          className={cn("space-y-3 rounded-md border bg-surface p-3", selectedId === top.candidate_id ? "border-accent" : "border-border")}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
              <span aria-hidden className="inline-block size-2.5 rotate-45 bg-accent" />
              Candidate {top.rank}
            </h3>
            <Badge tone="neutral">{fe.label}</Badge>
          </div>
          <Conditions c={top} />

          <div>
            <p className="text-xs text-muted">Expected reduction of target uncertainty</p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-2">
              <span className="num text-xl font-medium tracking-[-0.01em]" data-testid="evr-value">{fmtFractionPercent(top.evr_fraction)}</span>
              {isAssumptionDependent(top) ? <span className="text-xs text-muted">depends on the assumed pressure correlation</span> : null}
            </p>
            <p className="mt-0.5 text-xs text-muted">Share of the target&apos;s current knowledge uncertainty that one hypothetical observation here would remove. A model estimate.</p>
          </div>

          <div className="space-y-1.5 text-xs">
            <p className="font-medium text-fg">Why this candidate</p>
            {atTarget ? <p className="text-fg">{AT_TARGET_TEXT}</p> : null}
            {why.length > 0 ? (
              <ul className="space-y-1">
                {why.map((x) => (
                  <li key={x.code}>
                    <span className="font-medium text-fg">{reasonLabel(x.code)}.</span> <span className="text-muted">{x.message}</span>
                  </li>
                ))}
              </ul>
            ) : !atTarget ? (
              <p className="text-muted">It has the highest expected uncertainty reduction among the candidates in the analysis domain.</p>
            ) : null}
            <p className="text-muted">
              {far
                ? `No integrated observation within one reference distance; the nearest is ${fmtFixed(top.nn_distance, 1)} away.`
                : `Nearby evidence: the nearest integrated observation is ${fmtFixed(top.nn_distance, 1)} reference distances away.`}
              {showP ? (
                <> Model P(sustained) here <span className="num">{fmtProbability(top.p_sustained)}</span> (a model estimate).</>
              ) : (
                " No P(sustained) is shown here: the evidence does not support an estimate at this point."
              )}
            </p>
            {top.related_documented_investigations.length > 0 ? (
              <p className="text-muted">
                Inside the documented test envelope of {top.related_documented_investigations.map((i) => i.name.split(" (")[0]).join("; ")} (not integrated); existing data may already inform this candidate.
              </p>
            ) : null}
            <p className="text-muted">{fe.disclaimer}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => onExplore(top)} data-testid="explore-candidate">
              <Crosshair aria-hidden />
              Explore candidate
            </Button>
            <CompareToggle id={top.candidate_id} ids={compareIds} onToggle={onToggleCompare} />
          </div>
        </article>

        {rest.length > 0 ? (
          <ul className="divide-y divide-border rounded-md border border-border" aria-label="Other ranked candidates">
            {rest.map((c) => (
              <li key={c.candidate_id} className={cn("space-y-2 p-3", selectedId === c.candidate_id && "bg-accent-tint")}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-medium">Candidate {c.rank}</span>
                  <span className="text-xs text-muted">
                    <span className="num text-fg">{fmtFractionPercent(c.evr_fraction)}</span> expected reduction
                  </span>
                </div>
                <p className="num text-xs text-fg">{shortCond(c)}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => onExplore(c)} aria-label={`Explore candidate ${c.rank}`}>
                    <Crosshair aria-hidden />
                    Explore
                  </Button>
                  <CompareToggle id={c.candidate_id} ids={compareIds} onToggle={onToggleCompare} />
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">Pick two candidates to compare side by side.</p>
          <Button size="sm" variant="secondary" disabled={!compareReady} onClick={onOpenCompare} data-testid="open-compare">Compare selected</Button>
        </div>

        <Disclosure summary="How this ranking compares with simpler rules">
          <section aria-label="Baseline comparison">
            <p className="mb-1.5 text-muted">
              Each rule&apos;s pick is scored with the same measure: the expected uncertainty reduction if this baseline&apos;s pick were tested instead.
            </p>
            <Table aria-label="Expected reduction of target uncertainty by selection strategy">
              <TableHeader>
                <tr>
                  <TableHead>Strategy and its pick</TableHead>
                  <TableHead numeric>Expected reduction</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    Blind Spots (target-aware)
                    <span className="num block text-xs text-muted">{shortCond(top)}</span>
                  </TableCell>
                  <TableCell numeric>{fmtFractionPercent(top.evr_fraction, 1)}</TableCell>
                </TableRow>
                {baselines.map(([name, c]) => (
                  <TableRow key={name}>
                    <TableCell>
                      {name}
                      {c ? <span className="num block text-xs text-muted">{shortCond(c)}</span> : null}
                    </TableCell>
                    <TableCell numeric>{c ? fmtFractionPercent(c.evr_fraction, 1) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-1 text-muted">
              The random baseline is a single seeded draw. Picks far from the target remove almost none of its uncertainty, hence values near 0%. On held-out data the advantage is modest and not uniform; see{" "}
              <a className="underline" href="/methodology#trust">Methodology</a>.
            </p>
          </section>
          {r.sensitivity.length > 0 ? (
            <section aria-label="Sensitivity to the assumed pressure correlation">
              <p className="font-medium text-fg">Sensitivity to the assumed pressure correlation</p>
              <p className="text-muted">Every integrated observation is near 1 atm, so the pressure length scale is fixed, not learned.</p>
              <ul className="mt-1 space-y-0.5 text-muted">
                {r.sensitivity.map((s) => (
                  <li key={s.pressure_length_scale}>
                    Length scale <span className="num text-fg">{s.pressure_length_scale}</span>:{" "}
                    {s.same_top_as_default ? "same top candidate" : s.top_candidate ? <>top candidate changes to <span className="num">{shortCond(s.top_candidate)}</span></> : "no candidate"}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {r.assumptions.length > 0 ? (
            <section aria-label="Assumptions">
              <p className="font-medium text-fg">Assumptions</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-muted">
                {r.assumptions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </Disclosure>

        <p className="border-t border-border pt-3 text-xs text-muted">{r.disclaimer}</p>
      </div>
    </Updating>
  );
}
