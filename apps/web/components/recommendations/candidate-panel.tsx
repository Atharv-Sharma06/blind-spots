"use client";

import { Check, Crosshair, GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PanelSkeleton } from "@/components/explore/query-state";
import { cn } from "@/lib/cn";
import { feasibilityLabel, fmtCmS, fmtFixed, fmtFractionPercent, fmtKpa, fmtOxygen, reasonLabel } from "@/lib/format";
import { CANDIDATE_FRAMING } from "@/lib/copy";
import { pct } from "@/components/explore/plain";
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
  "The best test is at the cabin's own conditions. That follows from the model's assumption that nearby air behaves alike.";

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
      </div>
      <div className="min-w-0">
        <dt className="text-muted">Airflow</dt>
        <dd className="num text-[13px] whitespace-nowrap text-fg">{fmtCmS(c.airflow_cm_s)}</dd>
      </div>
    </dl>
  );
}

const shortCond = (c: Candidate) => `${fmtOxygen(c.oxygen_percent, 1)}, ${fmtKpa(c.pressure_kpa)}, ${fmtCmS(c.airflow_cm_s)}`;

function RowCompareToggle({ id, rank, ids, onToggle }: { id: string; rank: number; ids: [string | null, string | null]; onToggle: (id: string) => void }) {
  const on = ids.includes(id);
  return (
    <Button variant={on ? "primary" : "secondary"} size="icon" aria-pressed={on} aria-label={`Compare test ${rank}`} title={on ? "Added to compare" : "Compare"} onClick={() => onToggle(id)}>
      {on ? <Check aria-hidden /> : <GitCompareArrows aria-hidden />}
    </Button>
  );
}

function CompareToggle({ id, ids, onToggle }: { id: string; ids: [string | null, string | null]; onToggle: (id: string) => void }) {
  const on = ids.includes(id);
  return (
    <Button variant={on ? "primary" : "secondary"} size="sm" aria-pressed={on} onClick={() => onToggle(id)}>
      <GitCompareArrows aria-hidden />
      {on ? "Added" : "Compare"}
    </Button>
  );
}

/** Yellow rank badge (decorative: the rank is also in the text next to it). */
function RankBadge({ rank, active }: { rank: number; active?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "num grid size-10 shrink-0 place-items-center rounded-full text-[15px] font-semibold",
        active ? "bg-accent text-on-accent shadow-[0_0_18px_rgb(242_210_27/.35)]" : "border border-border bg-subtle text-fg",
      )}
    >
      {rank}
    </span>
  );
}

/** Headline percent: digits in the dot font, the % sign in the sans font (Doto draws % as a dotted X). */
function EvrValue({ text }: { text: string }) {
  const hasPct = text.endsWith("%");
  const digits = hasPct ? text.slice(0, -1) : text;
  return (
    <span className="inline-block align-[-0.12em] whitespace-nowrap text-accent" data-testid="evr-value">
      <span className="dotnum text-[34px]">{digits}</span>
      {hasPct ? <span className="ml-0.5 font-sans text-[22px] font-semibold">%</span> : null}
    </span>
  );
}

export function CandidatePanel(p: CandidatePanelProps) {
  const { query, group, modelled, pending, selectedId, compareIds, onExplore, onToggleCompare, onOpenCompare } = p;
  if (!modelled) {
    return (
      <EmptyState
        compact
        title="No prediction for this material"
        description={`Too few test results for a model (${group?.model_reason ?? "insufficient data"}). Try another material.`}
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
          title={r.status === "model_unavailable" ? "No model yet" : "No useful next test"}
          description={
            r.status === "model_unavailable"
              ? "There is no model for this material. Try another material."
              : "No candidate would teach the model about this cabin. Try another material."
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
    ["Most uncertain", r.baselines.uncertainty_sampling],
    ["Nearest gap", r.baselines.nearest_gap],
  ];

  return (
    <Updating active={pending}>
      <div className="space-y-4" data-testid="candidate-panel">
        <article
          aria-label="Top candidate"
          data-testid="top-candidate"
          className={cn("card space-y-4 p-5 sm:p-6", selectedId === top.candidate_id && "ring-2 ring-accent/70")}
        >
          <div className="flex items-center gap-2.5">
            <RankBadge rank={top.rank} active />
            <h3 className="text-[15px] font-semibold">Test {top.rank}: most informative</h3>
          </div>
          <Conditions c={top} />

          <div>
            <p className="text-[15px] leading-snug text-fg">
              Would cut the model&apos;s uncertainty about this cabin by{" "}
              <EvrValue text={fmtFractionPercent(top.evr_fraction)} />.
            </p>
            <p className="mt-0.5 text-xs text-muted">
              A model estimate{isAssumptionDependent(top) ? ", based on an assumed pressure link" : ""}.
            </p>
          </div>

          {atTarget ? <p className="text-xs text-fg">{AT_TARGET_TEXT}</p> : null}
          <p className="text-xs text-muted">
            Nearest ISS test: {fmtFixed(top.nn_distance, 1)} steps away{far ? "" : " (nearby)"}.
            {showP ? <> Flame chance: <span className="num text-fg">{pct(top.p_sustained)}</span>.</> : " No flame estimate: too little evidence."}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => onExplore(top)} data-testid="explore-candidate">
              <Crosshair aria-hidden />
              What would we learn?
            </Button>
            <CompareToggle id={top.candidate_id} ids={compareIds} onToggle={onToggleCompare} />
          </div>
        </article>

        {rest.length > 0 ? (
          <ul className="space-y-2" aria-label="Other ranked candidates">
            {rest.map((c) => (
              <li key={c.candidate_id} className={cn("card flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-xl)] p-3.5", selectedId === c.candidate_id && "ring-2 ring-accent/70")}>
                <RankBadge rank={c.rank} />
                <p className="min-w-[10rem] flex-1 text-[13px]">
                  <span className="font-medium">Test {c.rank}</span>{" "}
                  <span className="text-muted">cuts <span className="num text-fg">{fmtFractionPercent(c.evr_fraction)}</span></span>
                  <span className="num block text-xs text-muted">{shortCond(c)}</span>
                </p>
                <div className="ml-auto flex shrink-0 gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => onExplore(c)} aria-label={`What if? Test ${c.rank}`}>
                    <Crosshair aria-hidden />
                    What if?
                  </Button>
                  <RowCompareToggle id={c.candidate_id} rank={c.rank} ids={compareIds} onToggle={onToggleCompare} />
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {compareIds[0] !== null || compareIds[1] !== null ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">{compareReady ? "Two tests ready." : "Add one more to compare."}</p>
            <Button size="sm" variant="secondary" disabled={!compareReady} onClick={onOpenCompare} data-testid="open-compare">Compare the two</Button>
          </div>
        ) : null}

        <Disclosure summary="Technical details">
          <section aria-label="Why this test" className="space-y-1.5">
            <p className="font-medium text-fg">Why this test</p>
            {why.length > 0 ? (
              <ul className="space-y-1">
                {why.map((x) => (
                  <li key={x.code}>
                    <span className="font-medium text-fg">{reasonLabel(x.code)}.</span> <span className="text-muted">{x.message}</span>
                  </li>
                ))}
              </ul>
            ) : !atTarget ? (
              <p className="text-muted">It cuts the most uncertainty of all candidates.</p>
            ) : null}
            {top.related_documented_investigations.length > 0 ? (
              <p className="text-muted">
                Inside the range of {top.related_documented_investigations.map((i) => i.name.split(" (")[0]).join("; ")} (not in our data), so existing results may already help.
              </p>
            ) : null}
            <p className="text-muted"><span className="font-medium text-fg">{fe.label}.</span> {fe.disclaimer}</p>
          </section>
          <section aria-label="Baseline comparison">
            <p className="mb-1.5 font-medium text-fg">How this ranking compares with simpler rules</p>
            <Table aria-label="Uncertainty cut by each way of picking a test">
              <TableHeader>
                <tr>
                  <TableHead>Way of picking</TableHead>
                  <TableHead numeric>Uncertainty cut</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    Blind Spots
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
              Random is one seeded draw. On held-out data the gain is modest; see{" "}
              <a className="underline" href="/methodology#trust">How it works</a>.
            </p>
          </section>
          {r.sensitivity.length > 0 ? (
            <section aria-label="If the assumed pressure link changes">
              <p className="font-medium text-fg">If the assumed pressure link changes</p>
              <p className="text-muted">All ISS tests are near 1 atm, so this link is set, not learned.</p>
              <ul className="mt-1 space-y-0.5 text-muted">
                {r.sensitivity.map((s) => (
                  <li key={s.pressure_length_scale}>
                    Setting <span className="num text-fg">{s.pressure_length_scale}</span>:{" "}
                    {s.same_top_as_default ? "same top test" : s.top_candidate ? <>top test becomes <span className="num">{shortCond(s.top_candidate)}</span></> : "no test"}
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

        <p className="border-t border-border/70 pt-3 text-xs leading-relaxed text-muted">{CANDIDATE_FRAMING}</p>
      </div>
    </Updating>
  );
}
