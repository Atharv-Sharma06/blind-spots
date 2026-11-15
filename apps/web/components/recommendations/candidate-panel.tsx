"use client";

import { Crosshair, GitCompareArrows } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PanelSkeleton, QueryError } from "@/components/explore/query-state";
import { cn } from "@/lib/cn";
import { feasibilityLabel, fmtCmS, fmtFixed, fmtFractionPercent, fmtOxygen, fmtPressure, fmtProbability, reasonLabel } from "@/lib/format";
import type { Candidate, GroupSummary, RankResponse } from "@/lib/types";
import type { ApiQuery } from "@/hooks/api";

export interface CandidatePanelProps {
  query: ApiQuery<RankResponse>;
  group: GroupSummary | null;
  modelled: boolean;
  /** False when the target verdict is insufficient_evidence: P(sustained) is base-rate reversion and must not be shown. */
  showEstimate: boolean;
  pending: boolean;
  selectedId: string | null;
  compareIds: [string | null, string | null];
  onExplore: (c: Candidate) => void;
  onToggleCompare: (id: string) => void;
  onOpenCompare: () => void;
}

const isAssumptionDependent = (c: Candidate) => c.reasons.some((r) => r.code === "assumption_dependent");

function Conditions({ c }: { c: Candidate }) {
  return (
    <dl className="num grid grid-cols-3 gap-2 text-xs">
      <div>
        <dt className="text-muted">Oxygen</dt>
        <dd className="text-[13px] text-fg">{fmtOxygen(c.oxygen_percent)}</dd>
      </div>
      <div>
        <dt className="text-muted">Pressure</dt>
        <dd className="text-[13px] text-fg">{fmtPressure(c.pressure_kpa)}</dd>
      </div>
      <div>
        <dt className="text-muted">Airflow</dt>
        <dd className="text-[13px] text-fg">{fmtCmS(c.airflow_cm_s)}</dd>
      </div>
    </dl>
  );
}

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
  const { query, group, modelled, showEstimate, pending, selectedId, compareIds, onExplore, onToggleCompare, onOpenCompare } = p;
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
  if (query.isError && !r) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (!r || pending) return <PanelSkeleton label="Ranking candidates" />;
  if (r.status !== "ok" || r.candidates.length === 0) {
    return (
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
    );
  }

  const top = r.candidates[0] as Candidate;
  const rest = r.candidates.slice(1);
  const fe = feasibilityLabel(top.feasibility_status);
  const compareReady = compareIds[0] !== null && compareIds[1] !== null;
  const far = top.nn_distance > 1;
  const baselines: Array<[string, Candidate | null]> = [
    ["Blind Spots (expected information)", top],
    ["Random", r.baselines.random],
    ["Uncertainty sampling", r.baselines.uncertainty_sampling],
    ["Nearest gap", r.baselines.nearest_gap],
  ];

  return (
    <div className="space-y-4" data-testid="candidate-panel">
      <article
        aria-label="Top candidate"
        data-testid="top-candidate"
        className={cn("space-y-3 rounded-md border bg-surface p-3", selectedId === top.candidate_id ? "border-accent" : "border-border")}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
            <span aria-hidden className="inline-block size-2.5 rotate-45 bg-accent" />
            Candidate {top.rank}
          </h3>
          <Badge tone={top.feasibility_status === "within_demonstrated_envelope" ? "accent" : "neutral"}>{fe.label}</Badge>
        </div>
        <Conditions c={top} />

        <div>
          <p className="text-xs text-muted">Expected reduction of target uncertainty</p>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-2">
            <span className="num text-xl font-medium tracking-[-0.01em]" data-testid="evr-value">{fmtFractionPercent(top.evr_fraction)}</span>
            {isAssumptionDependent(top) ? <Badge tone="gap">assumption-dependent</Badge> : null}
          </p>
          <p className="mt-0.5 text-xs text-muted">One hypothetical new observation, as a share of current latent variance over the target. A model estimate.</p>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium">Why this candidate</p>
          <ul className="space-y-1">
            {top.reasons.filter((x) => showEstimate || x.code !== "near_decision_boundary").map((x) => (
              <li key={x.code} className="text-xs">
                <span className="font-medium text-fg">{reasonLabel(x.code)}.</span> <span className="text-muted">{x.message}</span>
              </li>
            ))}
          </ul>
        </div>

        <dl className="space-y-1.5 text-xs">
          <div>
            <dt className="font-medium text-fg">Evidence missing</dt>
            <dd className="text-muted">
              {far
                ? `No integrated observation within one reference distance; the nearest is ${fmtFixed(top.nn_distance, 1)} away.`
                : `Comparable observations exist nearby (nearest ${fmtFixed(top.nn_distance, 1)} reference distances).`}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Target</dt>
            <dd className="text-muted">{r.target.label}</dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Support status</dt>
            <dd className="num text-muted">
              {far ? "Outside observed support" : "Inside observed support"}
              {showEstimate ? ` · P(sustained) ${top.p_sustained === null ? "no supported estimate" : fmtProbability(top.p_sustained)} · latent std ratio ${fmtFixed(top.latent_std_ratio, 2)}` : " · No reliable P(sustained) estimate (the model reverts to the training base rate here)"}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-fg">Feasibility</dt>
            <dd className="text-muted">{fe.disclaimer}</dd>
          </div>
        </dl>

        {top.related_documented_investigations.length > 0 ? (
          <Callout variant="info" title={`Documented NASA work not integrated here (${top.related_documented_investigations.length})`}>
            <details><summary className="cursor-pointer text-xs text-fg">Show investigations</summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {top.related_documented_investigations.map((i) => (
                <li key={i.id} className="text-xs">Inside the documented test envelope of {i.name}; existing data may already inform this candidate.</li>
              ))}
            </ul></details>
          </Callout>
        ) : null}

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
            <li key={c.candidate_id} className={cn("space-y-1.5 p-3", selectedId === c.candidate_id && "bg-accent-tint")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium">Candidate {c.rank}</span>
                <span className="num text-xs text-muted">
                  {fmtFractionPercent(c.evr_fraction)} expected reduction{isAssumptionDependent(c) ? " · assumption-dependent" : ""}
                </span>
              </div>
              <Conditions c={c} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => onExplore(c)}>Explore candidate</Button>
                <CompareToggle id={c.candidate_id} ids={compareIds} onToggle={onToggleCompare} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">Pick two candidates to compare side by side.</p>
        <Button size="sm" variant="secondary" disabled={!compareReady} onClick={onOpenCompare} data-testid="open-compare">Compare selected</Button>
      </div>

      <section aria-label="Baseline comparison">
        <h3 className="mb-1.5 text-xs font-medium">Against baseline strategies</h3>
        <Table aria-label="Expected reduction of target uncertainty by selection strategy">
          <TableHeader>
            <tr>
              <TableHead>Strategy</TableHead>
              <TableHead numeric>Expected reduction</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {baselines.map(([name, c]) => (
              <TableRow key={name}>
                <TableCell>{name}</TableCell>
                <TableCell numeric>{c ? fmtFractionPercent(c.evr_fraction, 1) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-1 text-xs text-muted">
          The random baseline is a single seeded draw, not an average. Baseline picks can lie far from the target, which is why their expected reduction can be near 0 %.
          The retrospective test shows only a modest, non-uniform advantage over these baselines; see <a className="underline" href="/methodology#validation">Methodology, section 4</a>.
        </p>
      </section>

      {r.sensitivity.length > 0 ? (
        <section aria-label="Sensitivity to the assumed pressure correlation">
          <h3 className="mb-1 text-xs font-medium">Sensitivity to the assumed pressure correlation</h3>
          <p className="text-xs text-muted">
            Every integrated observation is near 1 atm, so the pressure length scale is fixed, not learned. Pressure extrapolation is assumption-driven.
          </p>
          <ul className="num mt-1.5 space-y-0.5 text-xs">
            {r.sensitivity.map((s) => (
              <li key={s.pressure_length_scale}>
                Length scale {s.pressure_length_scale}: {s.same_top_as_default ? "same top candidate" : s.top_candidate ? `top candidate changes (${fmtOxygen(s.top_candidate.oxygen_percent, 0)}, ${fmtFixed(s.top_candidate.pressure_kpa, 0)} kPa, ${fmtFixed(s.top_candidate.airflow_cm_s, 1)} cm/s)` : "no candidate"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="rounded-md border border-border px-3 py-2 text-xs">
        <summary className="cursor-pointer text-[13px] font-medium">Assumptions</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-muted">
          {r.assumptions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </details>

      <p className="border-t border-border pt-3 text-xs text-muted">{r.disclaimer}</p>
    </div>
  );
}
