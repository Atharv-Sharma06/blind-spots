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

/** Oxygen, pressure and airflow as three label/value rows with big medium numbers (white on the ink card, ink on white). */
function Conditions({ c, ink }: { c: Candidate; ink?: boolean }) {
  const val = cn("num text-[22px] leading-none font-medium whitespace-nowrap", ink ? "text-on-ink" : "text-fg");
  const row = cn("flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0", ink ? "border-on-ink/15" : "border-border");
  const lab = cn("text-sm", ink ? "text-on-ink/70" : "text-muted");
  return (
    <dl className={cn("divide-y", ink ? "divide-on-ink/15" : "divide-border")}>
      <div className={row}>
        <dt className={lab}>Oxygen</dt>
        <dd className={val}>{fmtOxygen(c.oxygen_percent)}</dd>
      </div>
      <div className={row}>
        <dt className={lab}>Pressure</dt>
        <dd className={val}>{fmtKpa(c.pressure_kpa)}</dd>
      </div>
      <div className={row}>
        <dt className={lab}>Airflow</dt>
        <dd className={val}>{fmtCmS(c.airflow_cm_s)}</dd>
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

/** Compare toggle on the ink card: a white pill when added, an outlined white pill otherwise. */
function CompareToggle({ id, ids, onToggle }: { id: string; ids: [string | null, string | null]; onToggle: (id: string) => void }) {
  const on = ids.includes(id);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onToggle(id)}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-[14px] border px-4 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink",
        on ? "border-on-ink bg-on-ink text-ink-card" : "border-on-ink/45 text-on-ink hover:bg-on-ink/10",
      )}
    >
      <GitCompareArrows aria-hidden className="size-4" />
      {on ? "Added" : "Compare"}
    </button>
  );
}

/** Rank number in a round badge (decorative: the rank is also in the text next to it). */
function RankBadge({ rank, active }: { rank: number; active?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "num grid size-10 shrink-0 place-items-center rounded-full text-[15px] font-medium",
        active ? "bg-on-ink text-ink-card" : "border border-border bg-surface text-fg",
      )}
    >
      {rank}
    </span>
  );
}

/** Headline percent as a big medium number. */
function EvrValue({ text }: { text: string }) {
  return (
    <span className="inline-block align-[-0.08em] text-[40px] leading-none font-medium tracking-[-0.02em] whitespace-nowrap text-on-ink" data-testid="evr-value">
      {text}
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
          className={cn("card-ink space-y-5 p-6 text-on-ink sm:p-7", selectedId === top.candidate_id && "ring-2 ring-cta")}
        >
          <div className="flex items-center gap-3">
            <RankBadge rank={top.rank} active />
            <h3 className="text-xl leading-7 font-medium">Test {top.rank}: most informative</h3>
          </div>
          <Conditions c={top} ink />

          <div>
            <p className="text-[16px] leading-snug text-on-ink">
              Would cut the model&apos;s uncertainty about this cabin by{" "}
              <EvrValue text={fmtFractionPercent(top.evr_fraction)} />.
            </p>
            <p className="mt-1 text-xs text-on-ink/70">
              A model estimate{isAssumptionDependent(top) ? ", based on an assumed pressure link" : ""}.
            </p>
          </div>

          {atTarget ? <p className="text-xs text-on-ink">{AT_TARGET_TEXT}</p> : null}
          <p className="text-xs text-on-ink/70">
            Nearest ISS test: {fmtFixed(top.nn_distance, 1)} steps away{far ? "" : " (nearby)"}.
            {showP ? <> Flame chance: <span className="num text-on-ink">{pct(top.p_sustained)}</span>.</> : " No flame estimate: too little evidence."}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onExplore(top)}
              data-testid="explore-candidate"
              className="inline-flex min-h-11 items-center gap-2 rounded-[14px] bg-on-ink px-4 text-[15px] font-medium text-ink-card transition-colors hover:bg-on-ink/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-ink"
            >
              <Crosshair aria-hidden className="size-4" />
              What would we learn?
            </button>
            <CompareToggle id={top.candidate_id} ids={compareIds} onToggle={onToggleCompare} />
          </div>
        </article>

        {rest.length > 0 ? (
          <ul className="space-y-2" aria-label="Other ranked candidates">
            {rest.map((c) => (
              <li key={c.candidate_id} className={cn("card flex flex-wrap items-center justify-between gap-3 p-4", selectedId === c.candidate_id && "ring-2 ring-fg")}>
                <RankBadge rank={c.rank} />
                <p className="min-w-[10rem] flex-1 text-[15px]">
                  <span className="font-medium">Test {c.rank}</span>{" "}
                  <span className="text-muted">cuts <span className="num text-fg">{fmtFractionPercent(c.evr_fraction)}</span></span>
                  <span className="num mt-0.5 block text-xs text-muted">{shortCond(c)}</span>
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

        <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted">{CANDIDATE_FRAMING}</p>
      </div>
    </Updating>
  );
}
