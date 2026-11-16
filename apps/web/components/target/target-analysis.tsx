"use client";

import { CircleCheck, CircleSlash, TriangleAlert } from "lucide-react";
import { PanelSkeleton } from "@/components/explore/query-state";
import { decomposition, groupBalance, SMALL_SAMPLE_EXPERIMENTS } from "@/components/explore/model";
import { PLAIN_VERDICT, pct, pctRange } from "@/components/explore/plain";
import { materialFullName } from "@/components/home/cabins";
import { cn } from "@/lib/cn";
import { DotNumber } from "@/components/ui/dot-number";
import { ProvenanceTag, type Provenance } from "@/components/ui/provenance-tag";
import { Term } from "@/components/ui/term";
import {
  airflowBandSourceLabel,
  fmtCount,
  fmtFixed,
  fmtKpa,
  fmtOxygen,
  fmtPsia,
  isNum,
  kpaToPsia,
  reasonLabel,
  targetFlagLabel,
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

/** The cabin and its air: a title and three outlined chips. */
function CabinLine({ t }: { t: ResolvedTarget }) {
  const kpa = t.total_pressure_kpa.nominal ?? t.total_pressure_kpa.max ?? t.total_pressure_kpa.min;
  const chip = "inline-flex min-h-8 items-center whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 text-xs text-fg";
  return (
    <div className="px-1">
      <p className="text-xl leading-7 font-medium text-fg">{t.label}</p>
      <p className="mt-2 flex flex-wrap gap-2">
        <span className={chip}>{o2Text(t.oxygen_percent)}</span>
        <span className={chip}>{isNum(kpa) ? `${fmtKpa(kpa)} (${fmtPsia(kpaToPsia(kpa))})` : "pressure not stated"}</span>
        <span className={chip}>airflow {airflowText(t.airflow_cm_s)}</span>
      </p>
    </div>
  );
}

/** Plain one-line reasons; unknown codes fall back to the shared label. */
const PLAIN_REASON: Record<string, string> = {
  point_verdicts: "No part of this cabin is covered",
  sparse_observations: "Few ISS tests nearby",
  outside_hull: "Outside the range the ISS tests covered",
  unobserved_pressure: "Pressure never tested nearby",
  outcome_variability: "Nearby tests had mixed results",
  model_instability: "Model answers shift between runs",
  other_family_evidence_only: "Only other materials have tests here",
  no_model: "No model for this material",
  high_knowledge_uncertainty: "The model is still unsure",
  target_points_not_supported: "Too few cabin conditions have an estimate",
};

const TONE = {
  blind: { dot: "bg-on-ink", Icon: CircleSlash },
  partly: { dot: "bg-[#E8A33B]", Icon: TriangleAlert },
  covered: { dot: "bg-cta", Icon: CircleCheck },
} as const;

/**
 * The verdict in plain words as the near-black highlight card, same wording as the Cabins answer card.
 * A status dot, an icon and the words, never colour alone.
 */
function PlainVerdict({ verdict, headline, children }: { verdict: AssessResponse["verdict"]; headline: string; children?: React.ReactNode }) {
  const v = PLAIN_VERDICT[verdict];
  const tone = TONE[v.tone];
  return (
    <div className="card-ink relative overflow-hidden p-6 text-on-ink sm:p-7">
      <div role="status" className="flex items-start gap-3" data-testid="plain-verdict">
        <span aria-hidden className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-on-ink/25 text-on-ink">
          <tone.Icon className="size-5" />
        </span>
        <p className="min-w-0 text-xl leading-snug font-medium tracking-[-0.01em] sm:text-[22px]">
          <span aria-hidden className={cn("mr-2 inline-block size-2.5 rounded-full align-middle", tone.dot)} />
          {headline}
        </p>
      </div>
      {children ? <div className="mt-3 space-y-1.5 pl-12 text-on-ink/75">{children}</div> : null}
    </div>
  );
}

/** One or two short sentences, built only from the API's numbers. */
function plainSentence(a: AssessResponse): string {
  const { n_target_points: n, points_with_comparable: k } = a.coverage;
  const s = pointsSupported(a);
  if (a.model.model_status !== "modeled") return "Too few test results for a model. The chart shows coverage only.";
  if (k === 0) return "No ISS test for this material is nearby.";
  if (a.verdict === "supported") return `Tests are nearby for ${k} of ${n} cabin conditions${s !== null ? `. The model is confident at ${s}` : ""}.`;
  return `Tests are nearby for ${k} of ${n} cabin conditions. Elsewhere, estimates rest on model assumptions.`;
}

/**
 * One key number as a white bordered card: plain label (and optional short help) above a big medium number.
 * Decimals and units use the mono face so periods stay readable.
 */
function Fact({
  label,
  help,
  value,
  suffix,
  mono,
  note,
  source,
  ...rest
}: { label: React.ReactNode; help?: string; value: string; suffix?: string; mono?: boolean; note?: string; source?: Provenance } & React.HTMLAttributes<HTMLDivElement>) {
  const tag = source ? <ProvenanceTag kind={source} className="ml-auto self-center text-muted" /> : null;
  return (
    <div className="card flex min-h-[132px] min-w-0 flex-col gap-0 p-5" {...rest}>
      <dt className="text-[14px] leading-snug text-fg">{label}</dt>
      {help ? <dd className="mt-0.5 text-xs text-muted">{help}</dd> : null}
      <dd className="mt-auto min-w-0 pt-3">
        {mono ? (
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="num block text-[32px] leading-none font-medium break-words text-fg">{value}</span>
            {tag}
          </span>
        ) : (
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <DotNumber className="text-[36px] leading-none font-medium break-words text-fg sm:text-[40px]">{value}</DotNumber>
            {suffix ? <span className="text-ui text-muted">{suffix}</span> : null}
            {tag}
          </span>
        )}
        {note ? <span className="mt-1 block text-xs text-muted">{note}</span> : null}
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
        className="flex h-2 w-full overflow-hidden rounded-full bg-subtle"
      >
        <div style={{ width: `${knowledge * 100}%`, background: "var(--plum-6)" }} />
        <div style={{ width: `${variability * 100}%`, background: "var(--plum-4)" }} />
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

  const nearest = isNum(cov.nn_distance_min) ? fmtFixed(cov.nn_distance_min, 1) : "—";

  return (
    <Updating active={pending}>
      <div className="space-y-4" data-testid="target-analysis" data-verdict={a.verdict}>
        {!pending ? (
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {`${a.target.label}${group ? `, ${materialFullName(group.group_id, group.label)}` : ""}: ${headline}${sup !== null ? ` The model is confident at ${sup} of ${cov.n_target_points} cabin conditions.` : ""} ${cov.comparable_observations} nearby test result${cov.comparable_observations === 1 ? "" : "s"}.`}
          </p>
        ) : null}

        <PlainVerdict verdict={a.verdict} headline={headline}>
          <p className="text-sm leading-snug" data-testid="plain-sentence">{plainSentence(a)}</p>
          {a.verdict === "insufficient_evidence" ? (
            <p className="text-xs leading-snug">Insufficient experimental evidence for a reliable estimate.</p>
          ) : null}
        </PlainVerdict>

        <CabinLine t={a.target} />

        <dl className="grid grid-cols-2 gap-3">
          <Fact label={<Term id="comparable_results">Nearby ISS test results</Term>} value={fmtCount(cov.comparable_observations)} source="measured" />
          <Fact label="Cabin conditions with a nearby test" value={fmtCount(cov.points_with_comparable)} suffix={`of ${fmtCount(cov.n_target_points)}`} source="derived" />
          {sup !== null ? (
            <Fact
              data-testid="points-supported"
              label="Conditions with an estimate"
              help="Where the model is confident."
              value={fmtCount(sup)}
              suffix={`of ${fmtCount(cov.n_target_points)}`}
              source="model"
            />
          ) : null}
          {showP ? (
            <Fact label={<>Chance the flame <Term id="kept_burning">keeps burning</Term></>} help="Model estimate, not a measurement." value={pctRange(m.p_sustained_min, m.p_sustained_max)} source="model" />
          ) : (
            <Fact label="Nearest ISS test" help="1 step or less counts as nearby." value={nearest} mono note={isNum(cov.nn_distance_min) ? "steps" : undefined} source={isNum(cov.nn_distance_min) ? "derived" : "missing"} />
          )}
        </dl>

        <Disclosure summary="More details" data-testid="why-uncertain">
          {a.reasons.length > 0 ? (
            <div>
              <p className="mb-1 font-medium text-fg">Why is this uncertain?</p>
              <ul className="list-disc space-y-1 pl-4 text-muted">
                {a.reasons.map((r) => (
                  <li key={r.code}>{PLAIN_REASON[r.code] ?? reasonLabel(r.code)}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted">{verdictSentence(a)}{isNum(m.latent_std_ratio_mean) ? ` Uncertainty left: ${fmtFixed(m.latent_std_ratio_mean, 2)} (confident needs below 0.6).` : ""}</p>
          )}
          <dl className="space-y-1 text-muted">
            {showP ? (
              <div className="flex justify-between gap-4"><dt>Nearest ISS test</dt><dd className="num text-fg">{nearest}{isNum(cov.nn_distance_min) ? " steps" : ""} <ProvenanceTag kind={isNum(cov.nn_distance_min) ? "derived" : "missing"} className="text-muted" /></dd></div>
            ) : null}
            <div className="flex justify-between gap-4"><dt>Cabin range inside the ISS test range</dt><dd className="num text-fg">{isNum(cov.fraction_inside_hull) ? pct(cov.fraction_inside_hull) : "—"} <ProvenanceTag kind={isNum(cov.fraction_inside_hull) ? "derived" : "missing"} className="text-muted" /></dd></div>
            {ppo2 !== null ? <div className="flex justify-between gap-4"><dt>Oxygen pressure</dt><dd className="num text-fg">{fmtFixed(ppo2, 1)} kPa <ProvenanceTag kind="derived" title="Oxygen share times cabin pressure." className="text-muted" /></dd></div> : null}
            {showP && isNum(m.p_sustained_mean) ? <div className="flex justify-between gap-4"><dt>Model average chance of burning</dt><dd className="num text-fg">{pct(m.p_sustained_mean)} <ProvenanceTag kind="model" className="text-muted" /></dd></div> : null}
            {showP && bal && bal.n > 0 ? <div className="flex justify-between gap-4"><dt>ISS tests in this material that kept burning</dt><dd className="num text-fg">{pct(bal.sustained / bal.n)} <ProvenanceTag kind="measured" className="text-muted" /></dd></div> : null}
          </dl>
          {modelled && dec && a.verdict !== "insufficient_evidence" ? (
            <div>
              <p className="mb-1 flex items-center gap-2 font-medium text-fg">
                <span>
                  Where the <Term id="uncertainty">uncertainty</Term> comes from
                </span>
                <ProvenanceTag kind="model" className="text-muted" />
              </p>
              <UncertaintyBar knowledge={dec.knowledge} variability={dec.variability} />
            </div>
          ) : null}
          {bal && bal.n > 0 ? (
            <p className="text-muted" data-testid="class-balance">
              {group ? materialFullName(group.group_id, group.label) : "This material"} has {fmtCount(group?.n_experiments)} experiments: {fmtCount(bal.sustained)} flame kept burning, {fmtCount(bal.notSustained)} went out.
              {group && group.n_experiments < SMALL_SAMPLE_EXPERIMENTS ? " Few tests, so treat estimates with care." : ""}
            </p>
          ) : null}
          <p className="text-muted">
            <span className="font-medium text-fg"><Term id="airflow">Airflow</Term>: {band.label}.</span> {bandNote ?? band.explanation}
          </p>
          {(a.target.flags ?? []).map((f) => (
            <p key={f} className="text-muted">{targetFlagLabel(f)}</p>
          ))}
          <Disclosure summary="Full summary">
            <p>{a.summary}</p>
          </Disclosure>
        </Disclosure>

        <InvestigationRelevance a={a} />
      </div>
    </Updating>
  );
}
