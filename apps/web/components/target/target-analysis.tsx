"use client";

import { Callout } from "@/components/ui/callout";
import { Metric } from "@/components/ui/metric";
import { PanelSkeleton } from "@/components/explore/query-state";
import { decomposition, groupBalance, SMALL_SAMPLE_EXPERIMENTS } from "@/components/explore/model";
import {
  airflowBandSourceLabel,
  fmtCount,
  fmtFixed,
  fmtFractionPercent,
  fmtOxygen,
  fmtPressure,
  fmtProbability,
  isNum,
  reasonLabel,
  targetFlagLabel,
  verdictLabel,
} from "@/lib/format";
import type { AssessResponse, GroupSummary, Range, ResolvedTarget } from "@/lib/types";
import type { ApiQuery } from "@/hooks/api";
import { pointsSupported, targetPAllowed, verdictSentence } from "./evidence";
import { Disclosure, PanelError, Updating, VerdictBadge } from "./panel-bits";
import { InvestigationRelevance } from "./investigation-relevance";

function o2Text(r: Range): string {
  if (isNum(r.nominal)) {
    const extra = isNum(r.min) && isNum(r.max) ? ` (${fmtFixed(r.min, 1)}–${fmtFixed(r.max, 1)})` : isNum(r.max) ? ` (up to ${fmtFixed(r.max, 1)})` : "";
    return `${fmtOxygen(r.nominal)}${extra}`;
  }
  if (isNum(r.max)) return `up to ${fmtOxygen(r.max)} (documented upper bound)`;
  return fmtOxygen(r.min);
}

function pressureText(r: Range): string {
  const base = fmtPressure(r.nominal ?? r.max ?? r.min);
  return isNum(r.min) && isNum(r.max) && r.max - r.min > 0.05 ? `${base}, range ${fmtFixed(r.min, 1)}–${fmtFixed(r.max, 1)} kPa` : base;
}

function ResolvedTargetSummary({ t }: { t: ResolvedTarget }) {
  const o2 = t.oxygen_percent.nominal ?? t.oxygen_percent.max;
  const p = t.total_pressure_kpa.nominal ?? t.total_pressure_kpa.max;
  const pp = isNum(o2) && isNum(p) ? (o2 / 100) * p : null;
  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-semibold text-fg">{t.label}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-muted">Oxygen</dt>
        <dd className="num text-fg">
          {o2Text(t.oxygen_percent)}
          {pp !== null ? <span className="text-muted"> · ppO₂ {fmtFixed(pp, 1)} kPa</span> : null}
        </dd>
        <dt className="text-muted">Pressure</dt>
        <dd className="num text-fg">{pressureText(t.total_pressure_kpa)}</dd>
        <dt className="text-muted">Airflow band</dt>
        <dd className="num text-fg">
          {isNum(t.airflow_cm_s.min) && isNum(t.airflow_cm_s.max) ? `${fmtFixed(t.airflow_cm_s.min, 1)}–${fmtFixed(t.airflow_cm_s.max, 1)} cm/s` : isNum(t.airflow_cm_s.nominal) ? `${fmtFixed(t.airflow_cm_s.nominal, 1)} cm/s` : "—"}
        </dd>
      </dl>
    </div>
  );
}

/** Knowledge uncertainty (epistemic) vs outcome variability (aleatoric), canonical terms (D5). */
export function UncertaintyBar({ knowledge, variability }: { knowledge: number; variability: number }) {
  const k = Math.round(knowledge * 100);
  return (
    <div>
      <div
        role="img"
        aria-label={`Uncertainty decomposition: ${k}% knowledge uncertainty, ${100 - k}% outcome variability`}
        className="flex h-2 w-full overflow-hidden rounded-sm border border-border"
      >
        <div style={{ width: `${knowledge * 100}%`, background: "var(--plum-6)" }} />
        <div style={{ width: `${variability * 100}%`, background: "var(--plum-2)" }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>Knowledge uncertainty <span className="num">{k}%</span></span>
        <span>Outcome variability <span className="num">{100 - k}%</span></span>
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
  if (query.isError && !a) return <PanelError error={query.error} onRetry={() => void query.refetch()} what="This target analysis" />;
  if (!a) return <PanelSkeleton label="Analysing target" />;

  const cov = a.coverage;
  const m = a.model;
  const modelled = m.model_status === "modeled";
  const dec = decomposition(m.epistemic_mean, m.aleatoric_mean);
  const bal = group ? groupBalance(group) : null;
  const showP = targetPAllowed(a);
  const sup = pointsSupported(a);
  const nothingComparable = cov.points_with_comparable === 0;
  const band = a.target.airflow_band_source === ("custom" as string) ? { label: "User-selected airflow band", explanation: "" } : airflowBandSourceLabel(a.target.airflow_band_source);
  const bandNote = (a.target as ResolvedTarget & { airflow_band_note?: string }).airflow_band_note;

  return (
    <Updating active={pending}>
      <div className="space-y-4" data-testid="target-analysis" data-verdict={a.verdict}>
        <ResolvedTargetSummary t={a.target} />
        {!pending ? (
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {`${a.target.label}${group ? `, ${group.label}` : ""}: ${verdictLabel(a.verdict)}.${sup !== null ? ` ${sup} of ${cov.n_target_points} target points supported.` : ""} ${cov.comparable_observations} comparable observations.`}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <VerdictBadge verdict={a.verdict} data-testid="verdict-badge" />
            {sup !== null ? (
              <span className="text-xs text-fg" data-testid="points-supported">
                <span className="num">{fmtCount(sup)}</span> of <span className="num">{fmtCount(cov.n_target_points)}</span> target points supported
              </span>
            ) : null}
          </div>
          {a.verdict === "insufficient_evidence" ? (
            <Callout variant="insufficient">
              {nothingComparable ? <p>These conditions are not represented in the integrated records.</p> : null}
              <p>{verdictSentence(a)}</p>
            </Callout>
          ) : (
            <p className="text-[13px] leading-snug text-fg">{verdictSentence(a)}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Metric label="Comparable observations" value={fmtCount(cov.comparable_observations)} />
          <Metric label="Target points with comparable observations" value={`${fmtCount(cov.points_with_comparable)} of ${fmtCount(cov.n_target_points)}`} />
          <Metric label="Nearest observation" value={isNum(cov.nn_distance_min) ? fmtFixed(cov.nn_distance_min, 1) : null} unit="ref. dist." />
          <Metric label="Inside the observed region" value={isNum(cov.fraction_inside_hull) ? fmtFractionPercent(cov.fraction_inside_hull) : null} />
        </div>

        {showP ? (
          <div>
            <Metric
              label={sup !== null ? "P(sustained) at supported target points" : "P(sustained) across the target"}
              value={m.p_sustained_min === m.p_sustained_max ? fmtProbability(m.p_sustained_min) : `${fmtProbability(m.p_sustained_min)}–${fmtProbability(m.p_sustained_max)}`}
            />
            <p className="mt-0.5 text-xs text-muted">
              {isNum(m.p_sustained_mean) ? <>Mean <span className="num">{fmtProbability(m.p_sustained_mean)}</span>. </> : null}
              {bal && bal.n > 0 ? <>Group base rate <span className="num">{fmtProbability(bal.sustained / bal.n)}</span> sustained. </> : null}A model estimate, not a measurement.
            </p>
          </div>
        ) : null}

        <Disclosure summary="Why is this region uncertain?" data-testid="why-uncertain">
          {a.reasons.length > 0 ? (
            <ul className="space-y-1.5">
              {a.reasons.map((r) => (
                <li key={r.code}>
                  <span className="font-medium text-fg">{reasonLabel(r.code)}.</span> <span className="text-muted">{r.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">{verdictSentence(a)}{isNum(m.latent_std_ratio_mean) ? ` Remaining uncertainty averages ${fmtFixed(m.latent_std_ratio_mean, 2)} of the prior (latent std ratio; supported needs below 0.6).` : ""}</p>
          )}
          {modelled && dec && a.verdict !== "insufficient_evidence" ? (
            <div>
              <p className="mb-1 font-medium text-fg">Uncertainty at the target (mean)</p>
              <UncertaintyBar knowledge={dec.knowledge} variability={dec.variability} />
            </div>
          ) : null}
          {bal && bal.n > 0 ? (
            <p className="text-muted" data-testid="class-balance">
              Training data in {group?.label ?? "this group"}: {fmtCount(group?.n_experiments)} experiments, {fmtCount(bal.sustained)} flame sustained and {fmtCount(bal.notSustained)} not sustained observations.
              {group && group.n_experiments < SMALL_SAMPLE_EXPERIMENTS ? " Small sample: treat estimates with caution." : ""}
            </p>
          ) : null}
          <p className="text-muted">
            <span className="font-medium text-fg">Airflow band: {band.label}.</span> {bandNote ?? band.explanation}
          </p>
          {(a.target.flags ?? []).map((f) => (
            <p key={f} className="text-muted">{targetFlagLabel(f)}</p>
          ))}
          <div>
            <p className="font-medium text-fg">Full summary</p>
            <p className="mt-0.5 text-muted">{a.summary}</p>
          </div>
        </Disclosure>

        <InvestigationRelevance a={a} />
      </div>
    </Updating>
  );
}
