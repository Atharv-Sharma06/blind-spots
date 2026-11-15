"use client";

import { CircleCheck, CircleSlash, TriangleAlert } from "lucide-react";
import { PanelSkeleton } from "@/components/explore/query-state";
import { decomposition, groupBalance, SMALL_SAMPLE_EXPERIMENTS } from "@/components/explore/model";
import { PLAIN_VERDICT, pct, pctRange } from "@/components/explore/plain";
import { materialFullName } from "@/components/home/cabins";
import { cn } from "@/lib/cn";
import {
  airflowBandSourceLabel,
  fmtCount,
  fmtFixed,
  fmtKpa,
  fmtOxygen,
  fmtPsia,
  fmtProbability,
  isNum,
  kpaToPsia,
  reasonLabel,
  targetFlagLabel,
  verdictLabel,
} from "@/lib/format";
import type { AssessResponse, GroupSummary, Range, ResolvedTarget } from "@/lib/types";
import type { ApiQuery } from "@/hooks/api";
import { useHeadline } from "@/hooks/api/queries";
import { verdictTitle } from "@/components/home/answer-copy";
import { pointsSupported, targetPAllowed, verdictSentence } from "./evidence";
import { Disclosure, PanelError, Updating } from "./panel-bits";
import { InvestigationRelevance } from "./investigation-relevance";

/** Oxygen as the cabin states it: "34 % O₂", or "up to 34 % O₂" when only an upper bound is documented. */
function o2Text(r: Range): string {
  if (isNum(r.nominal)) return fmtOxygen(r.nominal);
  if (isNum(r.max)) return `up to ${fmtOxygen(r.max)}`;
  return fmtOxygen(r.min);
}

function airflowText(r: Range): string {
  if (isNum(r.min) && isNum(r.max)) return `${fmtFixed(r.min, 1)}–${fmtFixed(r.max, 1)} cm/s`;
  return isNum(r.nominal) ? `${fmtFixed(r.nominal, 1)} cm/s` : "not stated";
}

/** The cabin and its air on two quiet lines. */
function CabinLine({ t }: { t: ResolvedTarget }) {
  const kpa = t.total_pressure_kpa.nominal ?? t.total_pressure_kpa.max ?? t.total_pressure_kpa.min;
  return (
    <div>
      <p className="text-[13px] font-semibold text-fg">{t.label}</p>
      <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
        <span className="whitespace-nowrap">{o2Text(t.oxygen_percent)}</span>
        <span aria-hidden>·</span>
        <span className="whitespace-nowrap">{isNum(kpa) ? `${fmtKpa(kpa)} (${fmtPsia(kpaToPsia(kpa))})` : "pressure not stated"}</span>
        <span aria-hidden>·</span>
        <span className="whitespace-nowrap">airflow {airflowText(t.airflow_cm_s)}</span>
      </p>
    </div>
  );
}

const TONE = {
  blind: { box: "border-plum-3 bg-plum-1 text-plum-7", Icon: CircleSlash },
  partly: { box: "border-gap/40 bg-gap-tint text-gap-fg", Icon: TriangleAlert },
  covered: { box: "border-accent/30 bg-accent-tint text-accent", Icon: CircleCheck },
} as const;

/** The verdict in plain words, same wording as the Cabins answer card. Icon and words, never colour alone. */
function PlainVerdict({ verdict, headline }: { verdict: AssessResponse["verdict"]; headline: string }) {
  const v = PLAIN_VERDICT[verdict];
  const tone = TONE[v.tone];
  return (
    <div role="status" className={cn("flex items-start gap-2.5 rounded-md border px-3 py-2.5", tone.box)} data-testid="plain-verdict">
      <tone.Icon className="mt-[3px] size-5 shrink-0" aria-hidden />
      <p className="text-xl leading-snug font-semibold tracking-[-0.01em] sm:text-[22px]">{headline}</p>
    </div>
  );
}

/** One or two plain sentences, built only from the API's numbers. */
function plainSentence(a: AssessResponse): string {
  const { n_target_points: n, points_with_comparable: k, nn_distance_min: nn } = a.coverage;
  const s = pointsSupported(a);
  if (a.model.model_status !== "modeled") return "This material has too few test results for a model. The chart shows coverage only.";
  if (k === 0) return `No ISS test result for this material is nearby.${isNum(nn) ? ` The closest is ${fmtFixed(nn, 1)} steps away (1 step or less counts as nearby).` : ""}`;
  if (a.verdict === "supported") return `Test results are nearby for ${k} of ${n} conditions sampled in this cabin${s !== null ? `, and the model is confident at ${s}` : ""}.`;
  return `Test results are nearby for ${k} of ${n} conditions sampled in this cabin. Elsewhere, estimates depend on model assumptions.`;
}

/** A number with its plain explanation: label and help on the left, value on the right. */
function Fact({ label, help, value, note, ...rest }: { label: string; help: string; value: string; note?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 py-2" {...rest}>
      <dt className="col-start-1 text-[13px] text-fg">{label}</dt>
      <dd className="col-start-1 row-start-2 mt-0.5 text-xs text-muted">{help}</dd>
      <dd className="col-start-2 row-span-2 row-start-1 text-right">
        <span className="num text-[15px] font-medium text-fg">{value}</span>
        {note ? <span className="block text-xs text-muted">{note}</span> : null}
      </dd>
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
  const headlineQ = useHeadline();
  if (query.isError && !a) return <PanelError error={query.error} onRetry={() => void query.refetch()} what="This cabin analysis" />;
  if (!a) return <PanelSkeleton label="Analysing cabin" />;

  const cov = a.coverage;
  const m = a.model;
  // Same sentence as the Cabins answer card: "none of the ISS flame tests" only when no material has a nearby test.
  const anyMaterial = headlineQ.data?.data.profiles.find((p) => p.profile_id === a.target.profile_id)?.comparable_observations ?? null;
  const headline = verdictTitle({ verdict: a.verdict, comparable: cov.comparable_observations, comparableAnyMaterial: anyMaterial });
  const modelled = m.model_status === "modeled";
  const dec = decomposition(m.epistemic_mean, m.aleatoric_mean);
  const bal = group ? groupBalance(group) : null;
  const showP = targetPAllowed(a);
  const sup = pointsSupported(a);
  const band = a.target.airflow_band_source === ("custom" as string) ? { label: "User-selected airflow band", explanation: "" } : airflowBandSourceLabel(a.target.airflow_band_source);
  const bandNote = (a.target as ResolvedTarget & { airflow_band_note?: string }).airflow_band_note;
  const o2 = a.target.oxygen_percent.nominal ?? a.target.oxygen_percent.max;
  const p = a.target.total_pressure_kpa.nominal ?? a.target.total_pressure_kpa.max;
  const ppo2 = isNum(o2) && isNum(p) ? (o2 / 100) * p : null;

  return (
    <Updating active={pending}>
      <div className="space-y-4" data-testid="target-analysis" data-verdict={a.verdict}>
        {!pending ? (
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {`${a.target.label}${group ? `, ${materialFullName(group.group_id, group.label)}` : ""}: ${headline}${sup !== null ? ` The model is confident at ${sup} of ${cov.n_target_points} cabin conditions.` : ""} ${cov.comparable_observations} nearby test result${cov.comparable_observations === 1 ? "" : "s"}.`}
          </p>
        ) : null}

        <div className="space-y-2">
          <PlainVerdict verdict={a.verdict} headline={headline} />
          <p className="text-sm leading-snug text-fg" data-testid="plain-sentence">{plainSentence(a)}</p>
          {a.verdict === "insufficient_evidence" ? (
            <p className="text-xs leading-snug text-muted">Insufficient experimental evidence for a reliable estimate.</p>
          ) : null}
        </div>

        <CabinLine t={a.target} />

        <dl className="divide-y divide-border border-y border-border">
          <Fact
            label="Nearby test results"
            help="ISS test results for this material close to this air."
            value={fmtCount(cov.comparable_observations)}
          />
          <Fact
            label="Nearest test result"
            help="How far the closest ISS test is. 1 step or less counts as nearby (see How it works)."
            value={isNum(cov.nn_distance_min) ? fmtFixed(cov.nn_distance_min, 1) : "—"}
            note={isNum(cov.nn_distance_min) ? "steps" : undefined}
          />
          <Fact
            label="Cabin conditions with a nearby test"
            help={`Of ${fmtCount(cov.n_target_points)} conditions sampled across this cabin's range.`}
            value={`${fmtCount(cov.points_with_comparable)} of ${fmtCount(cov.n_target_points)}`}
          />
          {sup !== null ? (
            <Fact
              data-testid="points-supported"
              label="Conditions with an estimate"
              help="Only conditions the model is confident about get an estimate."
              value={`${fmtCount(sup)} of ${fmtCount(cov.n_target_points)}`}
            />
          ) : null}
          <Fact
            label="Share inside the ISS test range"
            help="How much of this cabin's range lies within the range the ISS tests span."
            value={isNum(cov.fraction_inside_hull) ? pct(cov.fraction_inside_hull) : "—"}
          />
          {showP ? (
            <Fact
              label="Chance the flame keeps burning"
              help={`The model's estimate over the confident conditions. Not a measurement.`}
              value={pctRange(m.p_sustained_min, m.p_sustained_max)}
            />
          ) : null}
        </dl>

        <Disclosure summary="Technical details" data-testid="why-uncertain">
          {a.reasons.length > 0 ? (
            <div>
              <p className="mb-1 font-medium text-fg">Why is this region uncertain?</p>
              <ul className="space-y-1.5">
                {a.reasons.map((r) => (
                  <li key={r.code}>
                    <span className="font-medium text-fg">{reasonLabel(r.code)}.</span> <span className="text-muted">{r.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted">{verdictSentence(a)}{isNum(m.latent_std_ratio_mean) ? ` Remaining uncertainty averages ${fmtFixed(m.latent_std_ratio_mean, 2)} of the prior (latent std ratio; supported needs below 0.6).` : ""}</p>
          )}
          <p className="text-muted">
            Verdict term: <span className="text-fg">{verdictLabel(a.verdict)}</span>
            {sup !== null ? <>; <span className="num text-fg">{fmtCount(sup)}</span> of <span className="num text-fg">{fmtCount(cov.n_target_points)}</span> cabin conditions supported</> : null}
            {ppo2 !== null ? <>; ppO₂ <span className="num text-fg">{fmtFixed(ppo2, 1)}</span> kPa</> : null}.
          </p>
          {showP ? (
            <p className="text-muted">
              Model P(sustained){" "}
              <span className="num text-fg">{m.p_sustained_min === m.p_sustained_max ? fmtProbability(m.p_sustained_min) : `${fmtProbability(m.p_sustained_min)}–${fmtProbability(m.p_sustained_max)}`}</span>
              {isNum(m.p_sustained_mean) ? <>, mean <span className="num text-fg">{fmtProbability(m.p_sustained_mean)}</span></> : null}
              {bal && bal.n > 0 ? <>; group base rate <span className="num text-fg">{fmtProbability(bal.sustained / bal.n)}</span> sustained</> : null}. A model estimate, not a measurement.
            </p>
          ) : null}
          {modelled && dec && a.verdict !== "insufficient_evidence" ? (
            <div>
              <p className="mb-1 font-medium text-fg">Uncertainty at the cabin (mean)</p>
              <UncertaintyBar knowledge={dec.knowledge} variability={dec.variability} />
            </div>
          ) : null}
          {bal && bal.n > 0 ? (
            <p className="text-muted" data-testid="class-balance">
              Training data in {group ? materialFullName(group.group_id, group.label) : "this material"}: {fmtCount(group?.n_experiments)} experiments, {fmtCount(bal.sustained)} flame sustained and {fmtCount(bal.notSustained)} not sustained observations.
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
