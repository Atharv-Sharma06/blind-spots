"use client";

import { Callout } from "@/components/ui/callout";
import { Badge } from "@/components/ui/badge";
import { Metric } from "@/components/ui/metric";
import { QueryError, PanelSkeleton } from "@/components/explore/query-state";
import { decomposition, groupBalance, SMALL_SAMPLE_EXPERIMENTS } from "@/components/explore/model";
import {
  airflowBandSourceLabel,
  fmtCount,
  fmtFixed,
  fmtFractionPercent,
  fmtProbability,
  fmtPressure,
  fmtRange,
  reasonLabel,
  targetFlagLabel,
  verdictLabel,
} from "@/lib/format";
import type { AssessResponse, GroupSummary, ResolvedTarget } from "@/lib/types";
import type { ApiQuery } from "@/hooks/api";

function ResolvedTargetSummary({ t }: { t: ResolvedTarget }) {
  const band = t.airflow_band_source === ("custom" as string) ? { label: "User-selected airflow band", explanation: "" } : airflowBandSourceLabel(t.airflow_band_source);
  const note = (t as ResolvedTarget & { airflow_band_note?: string }).airflow_band_note;
  const o2Nominal = t.oxygen_percent.nominal;
  const pr = t.total_pressure_kpa;
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-medium text-fg">{t.label}</p>
      <dl className="num grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-muted">Oxygen</dt>
        <dd>{o2Nominal === null && t.oxygen_percent.max !== null ? `${fmtFixed(t.oxygen_percent.max, 1)} % (documented upper bound)` : fmtRange(t.oxygen_percent, "%")}</dd>
        <dt className="text-muted">Pressure</dt>
        <dd>{pr.nominal !== null ? fmtPressure(pr.nominal) : fmtRange(pr, "kPa")}</dd>
        <dt className="text-muted">Airflow band</dt>
        <dd>{fmtRange(t.airflow_cm_s, "cm/s", 2)}</dd>
      </dl>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer text-fg">Band source: {band.label}</summary>
        <p className="mt-1">{note ?? band.explanation}</p>
      </details>
      {(t.flags ?? []).map((f) => (
        <p key={f} className="text-xs text-muted">Flag: {targetFlagLabel(f)}</p>
      ))}
    </div>
  );
}

export function UncertaintyBar({ knowledge, variability }: { knowledge: number; variability: number }) {
  const k = Math.round(knowledge * 100);
  return (
    <div>
      <div
        role="img"
        aria-label={`Uncertainty decomposition: ${k}% limited knowledge, ${100 - k}% outcome variability`}
        className="flex h-2.5 w-full overflow-hidden rounded-sm border border-border"
      >
        <div style={{ width: `${knowledge * 100}%`, background: "var(--plum-6)" }} />
        <div style={{ width: `${variability * 100}%`, background: "var(--plum-2)" }} />
      </div>
      <div className="num mt-1 flex justify-between text-xs text-muted">
        <span>Limited knowledge {k}%</span>
        <span>Outcome variability {100 - k}%</span>
      </div>
    </div>
  );
}

export interface TargetAnalysisProps {
  query: ApiQuery<AssessResponse>;
  group: GroupSummary | null;
  pending: boolean;
}

export function TargetAnalysis({ query, group, pending }: TargetAnalysisProps) {
  const a = query.data?.data;
  if (query.isError && !a) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  if (!a || pending) return <PanelSkeleton label="Analysing target" />;

  const cov = a.coverage;
  const m = a.model;
  const modelled = m.model_status === "modeled";
  const dec = decomposition(m.epistemic_mean, m.aleatoric_mean);
  const bal = group ? groupBalance(group) : null;
  const showP = modelled && a.verdict !== "insufficient_evidence";

  return (
    <div className="space-y-4" data-testid="target-analysis" data-verdict={a.verdict}>
      <ResolvedTargetSummary t={a.target} />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={a.verdict === "supported" ? "accent" : a.verdict === "extrapolation" ? "gap" : "neutral"} data-testid="verdict-badge">
          {verdictLabel(a.verdict)}
        </Badge>
        {group ? <span className="text-xs text-muted">{group.label}</span> : null}
      </div>

      {a.verdict === "insufficient_evidence" ? (
        <Callout variant="insufficient">
          {!modelled ? "This group has too few training observations for a model; coverage is still shown." : null}
        </Callout>
      ) : null}
      {a.verdict === "extrapolation" ? (
        <Callout variant="info" title="Extrapolation: the target lies beyond the observed region; any estimate depends on model assumptions." />
      ) : null}

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Metric label="Comparable observations" value={fmtCount(cov.comparable_observations)} />
        <Metric label="Target points with ≥1 comparable" value={`${fmtCount(cov.points_with_comparable)} / ${fmtCount(cov.n_target_points)}`} />
        <Metric label="Nearest-neighbour distance (min)" value={fmtFixed(cov.nn_distance_min, 1)} unit="ref. units" />
        <Metric label="Inside observed region" value={fmtFractionPercent(cov.fraction_inside_hull)} />
        {showP ? (
          <div className="col-span-2">
            <Metric
              label={a.verdict === "extrapolation" ? "P(sustained), extrapolated" : "P(sustained) across target"}
              value={`${fmtProbability(m.p_sustained_min)} – ${fmtProbability(m.p_sustained_max)}`}
            />
            <p className="mt-0.5 text-xs text-muted">
              Mean {fmtProbability(m.p_sustained_mean)}. A model estimate, not a measurement.
              {a.verdict === "extrapolation" && (m.p_sustained_max ?? 0) - (m.p_sustained_min ?? 0) > 0.4 ? " Wide interval: treat as an assumption." : ""}
            </p>
          </div>
        ) : null}
      </div>

      <details className="text-xs text-muted" data-testid="class-balance-details">
        <summary className="cursor-pointer text-fg">Training data in this group</summary>
      {bal && bal.n > 0 ? (
        <p className="mt-1 text-xs text-muted" data-testid="class-balance">
          Training data in this group: {fmtCount(group?.n_experiments)} experiments, {bal.sustained} sustained / {bal.notSustained} not sustained
          {bal.majorityFraction !== null ? ` (majority-class baseline ${fmtFractionPercent(bal.majorityFraction)} ${bal.majorityLabel})` : ""}.
          {group && group.n_experiments < SMALL_SAMPLE_EXPERIMENTS ? " Small sample: treat estimates with caution." : ""}
        </p>
      ) : null}
      </details>

      {modelled && dec && a.verdict === "insufficient_evidence" ? (
        <p className="text-xs text-muted">Uncertainty decomposition: not meaningful without comparable evidence.</p>
      ) : null}
      {modelled && dec && a.verdict !== "insufficient_evidence" ? (
        <div>
          <p className="mb-1 text-xs font-medium text-fg">Uncertainty decomposition (target mean)</p>
          <UncertaintyBar knowledge={dec.knowledge} variability={dec.variability} />
        </div>
      ) : null}

      <details className="rounded-md border border-border px-3 py-2 text-[13px]" data-testid="why-uncertain">
        <summary className="cursor-pointer font-medium text-fg">Why is this region uncertain?</summary>
        {a.reasons.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No uncertainty flags were raised for this target.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {a.reasons.map((r) => (
              <li key={r.code} className="text-xs">
                <span className="font-medium text-fg">{reasonLabel(r.code)}</span>
                <span className="num text-muted"> · {r.value !== null ? fmtFixed(r.value, 2) : "—"}</span>
                <span className="block text-muted">{r.message}</span>
              </li>
            ))}
          </ul>
        )}
      </details>

      {a.documented_context.length > 0 ? (
        <Callout variant="info" title={`Documented NASA work not integrated here (${a.documented_context.length})`}>
          <p>These conditions are not represented in the integrated records.</p>
          <details className="mt-1">
            <summary className="cursor-pointer text-xs text-fg">Show investigations</summary>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {a.documented_context.map((c) => (
                <li key={c.id} className="text-xs">
                  {c.name}: {c.overlap === "contains_target_nominal" ? "documented envelope contains the target" : "documented envelope overlaps the target region"}.
                </li>
              ))}
            </ul>
          </details>
        </Callout>
      ) : null}

      <details className="text-xs text-muted"><summary className="cursor-pointer text-fg">Full summary</summary><p className="mt-1">{a.summary}</p></details>
    </div>
  );
}

