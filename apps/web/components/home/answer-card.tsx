"use client";

import * as React from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, EyeOff, type LucideIcon } from "lucide-react";
import { Disclosure } from "@/components/ui/disclosure";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useAssessTarget, useGroups, useHeadline, useObservations, useTargets } from "@/hooks/api";
import type { ApiObservation, AssessResponse, AtmosphereProfile, GroupSummary } from "@/lib/types";
import {
  airSentenceParts,
  answerSentences,
  cabinAir,
  chartCabin,
  kpaText,
  lcFirst,
  rangeText,
  relatedNasaSentence,
  relatedNasaTests,
  testRows,
  toDots,
  trimNum,
  verdictTitle,
  verdictTone,
  type TestRow,
  type VerdictTone,
} from "./answer-copy";
import { materialName, shortCabinName } from "./cabins";
import { StepHeading } from "./step-heading";
import { MaterialPicker } from "./material-picker";
import { CHART_HEIGHT_CLASS, SimpleChart } from "./simple-chart";

export interface AnswerCardProps {
  cabin: string;
  /** Selected material (analysis group id); null means the API's default group. */
  material: string | null;
  onMaterialChange: (id: string | null) => void;
}

const TONE: Record<VerdictTone, { Icon: LucideIcon; box: string; text: string; icon: string }> = {
  blind: { Icon: EyeOff, box: "border-plum-3 bg-plum-1", text: "text-plum-7", icon: "text-plum-6" },
  partly: { Icon: CircleAlert, box: "border-gap/40 bg-gap-tint", text: "text-gap-fg", icon: "text-gap" },
  covered: { Icon: CircleCheck, box: "border-accent/30 bg-accent-tint", text: "text-accent", icon: "text-accent" },
};

/** Step 2: the verdict for the chosen cabin and material, in plain sentences, with the simple chart. */
export function AnswerCard({ cabin, material, onMaterialChange }: AnswerCardProps) {
  const groupsQ = useGroups();
  const targetsQ = useTargets();
  const headlineQ = useHeadline();

  const groups = React.useMemo(() => groupsQ.data?.data ?? [], [groupsQ.data]);
  const profiles = React.useMemo(() => targetsQ.data?.data.profiles ?? [], [targetsQ.data]);
  const profile = profiles.find((p) => p.profile_id === cabin && p.kind !== "envelope") ?? null;

  // The chosen material, only if it can be modelled; otherwise the API default (never a made-up fallback).
  const modelled = groups.filter((g) => g.model_status === "modeled");
  const group = modelled.find((g) => g.group_id === material) ?? modelled.find((g) => g.is_default) ?? modelled[0] ?? null;

  const assessQ = useAssessTarget(group && profile ? { group_id: group.group_id, target: { profile_id: cabin } } : null);
  const obsQ = useObservations(group?.group_id);

  const assess = assessQ.isPlaceholderData ? null : (assessQ.data?.data ?? null);
  const obs = obsQ.isPlaceholderData ? null : (obsQ.data?.data ?? null);

  const headlineProfile = headlineQ.data?.data.profiles.find((p) => p.profile_id === cabin) ?? null;
  const nearby = React.useMemo(() => (headlineProfile ? new Map(headlineProfile.by_group.map((g) => [g.group_id, g.comparable_observations])) : null), [headlineProfile]);
  const headlineSettled = !!headlineQ.data || headlineQ.isError;

  const results = React.useMemo(() => (obs ? testRows(obs) : null), [obs]);
  const notUsedReason = React.useMemo(() => (obs ? notUsedReasonText(obs) : ""), [obs]);

  const fatal = groupsQ.isError || targetsQ.isError;
  const unknownCabin = !!targetsQ.data && !profile;

  return (
    <section id="answer" data-tour="answer" aria-labelledby="answer-heading" className="scroll-mt-20">
      <StepHeading n={2} id="answer-heading" title="The answer" hint="Do the ISS flame tests cover this cabin's air?" />

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface" data-testid="answer-card">
        {fatal ? (
          <Notice>We could not load the cabin data. Please reload the page.</Notice>
        ) : unknownCabin ? (
          <Notice>We do not know that cabin. Pick one of the cabins above.</Notice>
        ) : !profile || !group || !headlineSettled ? (
          <AnswerSkeleton />
        ) : (
          <>
            <Verdict
              profile={profile}
              cabinId={cabin}
              group={group}
              assessError={assessQ.isError && !assess ? assessQ.error : null}
              onRetry={() => void assessQ.refetch()}
              assess={assess}
              comparableAnyMaterial={headlineProfile ? headlineProfile.comparable_observations : null}
              picker={
                <div className="border-b border-border bg-subtle/50 px-4 py-3 sm:px-6">
                  <MaterialPicker part="select" groups={groups} nearby={nearby} selectedId={group.group_id} onChange={(id) => onMaterialChange(id)} />
                </div>
              }
            />
            <div id="chart" data-tour="chart" className="scroll-mt-20 border-t border-border px-4 pt-5 pb-4 sm:px-6">
              {results ? (
                <ChartBlock profile={profile} cabinId={cabin} profiles={profiles} results={results} notUsedReason={notUsedReason} materialLabel={lcFirst(materialName(group.group_id, group.label))} />
              ) : (
                <div className={cn("w-full", CHART_HEIGHT_CLASS)} aria-busy="true">
                  <Skeleton className="h-full w-full" />
                </div>
              )}
            </div>
            <div className="border-t border-border bg-subtle/50 px-4 py-2 sm:px-6">
              <MaterialPicker part="list" groups={groups} nearby={nearby} selectedId={group.group_id} onChange={(id) => onMaterialChange(id)} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

const NOT_USED_WHY: Record<string, string> = {
  no_numeric_airflow: "no airflow was recorded",
  low_confidence: "the record is low confidence",
  not_ignited: "the sample never lit",
};

/** A short plain reason for the results the model does not use, from the reasons in the data (same results testRows counts). */
function notUsedReasonText(obs: readonly ApiObservation[]): string {
  const num = (v: number | null) => typeof v === "number" && Number.isFinite(v);
  const counts = new Map<string, number>();
  let total = 0;
  for (const o of obs) {
    if (o.label === null || !num(o.oxygen_percent) || !num(o.pressure_for_analysis_kpa ?? o.total_pressure_kpa) || o.included_in_training !== false) continue;
    const key = o.exclusion_reason ?? "";
    counts.set(key, (counts.get(key) ?? 0) + 1);
    total += 1;
  }
  if (total === 0) return "";
  const [topKey, topN] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
  const why = NOT_USED_WHY[topKey] ?? "the data marks them as not suitable";
  if (counts.size === 1) return ` because ${why}`;
  return topN * 2 > total ? ` mostly because ${why}` : " for several reasons given in the data";
}

/** Keeps "15–22.2 %" and "56.5 kPa" on one line: a number never splits from its unit or its range. */
function noBreakNumbers(s: string): React.ReactNode[] {
  return s.split(/(\d[\d.,]*(?:–\d[\d.,]*)?(?: %| kPa))/).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-prose text-muted">{children}</p>;
}

/** Same blocks and about the same heights as the loaded card, so the page below does not jump when data arrives. */
function AnswerSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the answer">
      <div className="h-[170px] space-y-3 px-4 py-5 sm:h-[111px] sm:px-6">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-8 w-full max-w-xl" />
      </div>
      <div className="h-[340px] space-y-3 px-4 py-4 sm:h-[220px] sm:px-6">
        <Skeleton className="h-4 w-full max-w-3xl" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="border-t border-border px-4 pt-5 pb-4 sm:px-6">
        <Skeleton className={cn("w-full", CHART_HEIGHT_CLASS)} />
        <div className="h-[151px] sm:h-[109px]" />
      </div>
      <div className="h-[77px] border-t border-border bg-subtle/50 px-4 py-2 sm:h-[65px] sm:px-6" />
    </div>
  );
}

// ---- Verdict + sentences -------------------------------------------------------------------------------

interface VerdictProps {
  profile: AtmosphereProfile;
  cabinId: string;
  group: GroupSummary;
  assess: AssessResponse | null;
  assessError: unknown;
  onRetry: () => void;
  comparableAnyMaterial: number | null;
  /** The material dropdown, shown right under the verdict so the cause and the effect are on screen together. */
  picker: React.ReactNode;
}

/** Where the air comes from, in a few words; a documented NASA atmosphere needs no note. */
const STATUS_NOTE: Record<string, string> = {
  nasa_design_recommendation: "NASA design recommendation",
  historical_nasa: "Historical NASA record",
  user_hypothetical: "Hypothetical air",
};

function Verdict({ profile, cabinId, group, assess, assessError, onRetry, comparableAnyMaterial, picker }: VerdictProps) {
  const air = cabinAir(profile);
  const name = shortCabinName(profile.profile_id, profile.name);
  const tone = assess ? TONE[verdictTone(assess.verdict)] : null;
  const material = lcFirst(materialName(group.group_id, group.label));
  const related = assess && assess.verdict !== "supported" ? relatedNasaTests(assess) : null;

  const cabinLine = (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-ui text-muted">
      <span className="text-prose font-semibold text-fg" title={profile.name}>
        {name}
      </span>
      {air ? (
        <span>
          {air.o2UpTo ? "up to " : ""}
          <span className="font-medium text-fg">{trimNum(air.o2, 1)} % oxygen</span> · <span className="font-medium text-fg">{kpaText(air.kpa)} kPa</span>
        </span>
      ) : null}
      <a href="#cabins" className="-my-2.5 inline-flex min-h-10 items-center text-ui font-medium text-accent underline underline-offset-2 hover:text-fg sm:order-last sm:ml-auto" data-testid="change-cabin">
        Change cabin
      </a>
      {STATUS_NOTE[profile.status] ? (
        <span className="text-xs text-muted" data-testid="cabin-status">
          ({STATUS_NOTE[profile.status]})
        </span>
      ) : null}
    </p>
  );

  if (assessError) {
    const unavailable = isApiError(assessError) && assessError.snapshotUnavailable;
    return (
      <div className="px-4 py-5 sm:px-6" data-testid="answer-verdict" data-verdict="error">
        {cabinLine}
        <p className="mt-3 text-prose text-fg">
          {unavailable ? "This cabin and material are not in the precomputed version. Try another material." : "We could not work out this answer."}
        </p>
        {unavailable ? null : (
          <button type="button" onClick={onRetry} className="mt-2 inline-flex h-10 items-center rounded-md border border-border-strong px-3 text-ui font-medium text-fg hover:bg-subtle">
            Try again
          </button>
        )}
        <div className="-mx-4 mt-4 border-t border-border sm:-mx-6">{picker}</div>
      </div>
    );
  }

  if (!assess || !tone) {
    return (
      <div aria-busy="true" aria-label="Loading the answer" data-testid="answer-verdict" data-verdict="loading">
        <div className="border-b border-border bg-subtle/40 px-4 py-5 sm:px-6">
          {cabinLine}
          <Skeleton className="mt-3 h-[96px] w-full max-w-xl sm:h-9" />
        </div>
        {picker}
        <div className="space-y-2 px-4 py-4 sm:px-6">
          <Skeleton className="h-5 w-full max-w-lg" />
          <Skeleton className="h-5 w-full max-w-md" />
          <div className="h-[132px] sm:h-[36px]" />
        </div>
      </div>
    );
  }

  const title = verdictTitle({
    verdict: assess.verdict,
    comparable: assess.coverage.comparable_observations,
    comparableAnyMaterial,
    pointsWithComparable: assess.coverage.points_with_comparable,
    nTargetPoints: assess.coverage.n_target_points,
  });
  const sentences = answerSentences({
    verdict: assess.verdict,
    comparable: assess.coverage.comparable_observations,
    comparableAnyMaterial,
    assess,
    group,
    materialLc: material,
    air,
  });
  const explorer = `/explore?target=${encodeURIComponent(cabinId)}&group=${encodeURIComponent(group.group_id)}`;
  // Two short sentences: what the ISS tests covered (first sentence only; the pressure caveat sits under the chart) and the gravity limit.
  const rangeSentence = sentences[0]?.startsWith("For ") ? sentences[0].replace(/\.\s+[A-Z].*$/, ".") : null;

  return (
    <div data-testid="answer-verdict" data-verdict={assess.verdict}>
      <div className={cn("border-b px-4 py-5 sm:px-6", tone.box)}>
        {cabinLine}
        <p className={cn("mt-3 flex items-start gap-3 text-2xl leading-8 font-semibold tracking-tight text-balance sm:text-[28px] sm:leading-9", tone.text)} role="status">
          <tone.Icon aria-hidden className={cn("mt-0.5 size-7 shrink-0 sm:mt-1", tone.icon)} />
          <span data-testid="verdict-title">{title}</span>
        </p>
      </div>
      {picker}
      <div className="space-y-2 px-4 py-4 sm:px-6">
        {rangeSentence ? <p className="max-w-3xl text-title leading-7 text-fg">{noBreakNumbers(rangeSentence)}</p> : null}
        <p className="max-w-3xl text-title leading-7 text-fg">These tests ran in microgravity, not Moon or Mars gravity.</p>
        {related && related.n > 0 ? (
          <p className="max-w-3xl text-ui text-fg" data-testid="related-nasa">
            {relatedNasaSentence(related)}{" "}
            <Link href={`${explorer}#related-work`} className="-my-2.5 inline-block py-2.5 font-medium text-accent underline underline-offset-2 hover:text-fg">
              See them in the Explorer
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ---- Chart + table -------------------------------------------------------------------------------------

function ChartBlock({
  profile,
  cabinId,
  profiles,
  results,
  notUsedReason,
  materialLabel,
}: {
  profile: AtmosphereProfile;
  cabinId: string;
  profiles: readonly AtmosphereProfile[];
  results: { rows: TestRow[]; withoutOutcome: number; notUsed: number; notUsedNoAirflow: boolean };
  notUsedReason: string;
  materialLabel: string;
}) {
  const { rows, withoutOutcome, notUsed, notUsedNoAirflow } = results;
  const notUsedWhy = notUsedReason || (notUsedNoAirflow ? " because no airflow was recorded" : " for reasons given in the data");
  const dots = React.useMemo(() => toDots(rows), [rows]);
  const cabin = React.useMemo(() => chartCabin(cabinId, "This cabin", profile), [cabinId, profile]);
  const others = React.useMemo(
    () =>
      profiles
        .filter((p) => p.profile_id !== cabinId && p.kind !== "envelope")
        .flatMap((p) => {
          const c = chartCabin(p.profile_id, shortCabinName(p.profile_id, p.name), p);
          return c ? [c] : [];
        }),
    [profiles, cabinId],
  );
  const burned = rows.filter((r) => r.burned).length;
  const assumedRows = rows.filter((r) => r.pressureAssumed);
  const assumed = assumedRows.length;
  const assumedSet = new Set(assumedRows.map((r) => trimNum(r.kpa, 1)));
  const assumedKpa = assumedSet.size === 1 ? (assumedRows[0]?.kpa ?? null) : null;
  const air = cabinAir(profile);
  const o2s = rows.map((r) => r.oxygen);
  const ps = rows.map((r) => r.kpa);

  const aria = [
    `Chart of oxygen (%) against pressure (kPa).`,
    rows.length > 0
      ? `${rows.length} ISS test results for ${materialLabel}, ${burned} where the flame kept burning and ${rows.length - burned} where it went out, at ${rangeText(Math.min(...o2s), Math.max(...o2s), 1)} % oxygen and ${rangeText(Math.min(...ps), Math.max(...ps), 0)} kPa${assumed > 0 ? (assumed === rows.length ? " (pressure assumed by the dataset)" : " (pressure partly assumed by the dataset)") : ""}.`
      : `No ISS test results with an outcome for ${materialLabel}.`,
    air ? `This cabin: ${airSentenceParts(air).o2}, ${airSentenceParts(air).kpa}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!cabin) return <p className="text-prose text-muted">The air for this cabin is not fully documented, so it cannot be drawn.</p>;

  return (
    <div>
      <SimpleChart dots={dots} cabin={cabin} others={others} regionLabel="Where ISS tests ran" ariaLabel={aria} />
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-ui text-muted">
        <span className="inline-flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <circle cx="6" cy="6" r="4.6" fill="var(--observed)" fillOpacity="0.8" />
          </svg>
          Flame kept burning
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <circle cx="6" cy="6" r="4.2" fill="var(--surface)" stroke="var(--observed)" strokeWidth="1.5" />
          </svg>
          Flame went out
        </span>
        {others.length > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <circle cx="6" cy="6" r="3.5" fill="var(--muted)" fillOpacity="0.6" />
            </svg>
            Other cabins
          </span>
        ) : null}
        {cabin.xHi - cabin.xLo > 0 || cabin.yHi - cabin.yLo > 0 ? (
          <span className="inline-flex items-center gap-1.5" data-testid="legend-range">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <rect x="1" y="1" width="10" height="10" fill="var(--fg)" fillOpacity="0.06" stroke="var(--fg)" strokeWidth="1.25" strokeDasharray="3 2" />
            </svg>
            Dashed box: this cabin&apos;s air range
          </span>
        ) : null}
      </div>
      {assumed > 0 ? (
        <p className="mt-2 max-w-3xl text-xs text-muted">
          {assumedKpa !== null
            ? `${assumed === rows.length ? "These tests did not record pressure" : "Some tests did not record pressure"}; the chart uses an assumed ${kpaText(assumedKpa)} kPa.`
            : "Some tests did not record pressure; the chart uses assumed values."}
        </p>
      ) : null}
      <Disclosure className="mt-3" summary="Show as table" summaryClassName="min-h-10">
        {notUsed > 0 || withoutOutcome > 0 ? (
          <p className="mb-2 max-w-3xl text-xs text-muted" data-testid="not-used-note">
            {notUsed > 0 ? `${notUsed === 1 ? "1 result is" : `${notUsed.toLocaleString("en-US")} results are`} not used by the model${notUsedWhy}.` : ""}
            {notUsed > 0 && withoutOutcome > 0 ? " " : ""}
            {withoutOutcome > 0 ? `${withoutOutcome === 1 ? "1 more result has" : `${withoutOutcome.toLocaleString("en-US")} more results have`} no clear outcome and ${withoutOutcome === 1 ? "is" : "are"} not drawn.` : ""}
          </p>
        ) : null}
        <ResultsTable rows={rows} others={others} cabinName={shortCabinName(profile.profile_id, profile.name)} air={air} materialLabel={materialLabel} />
      </Disclosure>
    </div>
  );
}

function ResultsTable({ rows, others, cabinName, air, materialLabel }: { rows: readonly TestRow[]; others: readonly { id: string; label: string; x: number; y: number }[]; cabinName: string; air: ReturnType<typeof cabinAir>; materialLabel: string }) {
  const sorted = React.useMemo(() => [...rows].sort((a, b) => a.oxygen - b.oxygen || a.kpa - b.kpa), [rows]);
  return (
    <div className="max-h-72 overflow-y-auto rounded-md border border-border" tabIndex={0} role="region" aria-label={`Table of ISS test results for ${materialLabel}`}>
      <table className="w-full table-fixed border-collapse text-left text-xs sm:table-auto sm:text-ui">
        <caption className="sr-only">ISS test results for {materialLabel}, and the cabin for comparison</caption>
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[18%]" />
          <col className="w-[20%]" />
          <col className="w-[28%]" />
        </colgroup>
        <thead className="sticky top-0 bg-subtle text-xs text-muted">
          <tr>
            <th scope="col" className="px-2 py-2 font-medium sm:px-3">
              What
            </th>
            <th scope="col" className="px-2 py-2 font-medium sm:px-3">
              Oxygen (%)
            </th>
            <th scope="col" className="px-2 py-2 font-medium sm:px-3">
              Pressure (kPa)
            </th>
            <th scope="col" className="px-2 py-2 font-medium sm:px-3">
              Result
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {air ? (
            <tr className="bg-surface font-medium text-fg">
              <th scope="row" className="px-2 py-1.5 font-semibold break-words sm:px-3">
                {cabinName} (this cabin)
              </th>
              <td className="num px-2 py-1.5 sm:px-3">{trimNum(air.o2, 1)}</td>
              <td className="num px-2 py-1.5 sm:px-3">{kpaText(air.kpa)}</td>
              <td className="px-2 py-1.5 text-muted sm:px-3">—</td>
            </tr>
          ) : null}
          {others.map((o) => (
            <tr key={o.id} className="text-muted">
              <th scope="row" className="px-2 py-1.5 font-normal break-words sm:px-3">
                {o.label} (other cabin)
              </th>
              <td className="num px-2 py-1.5 sm:px-3">{trimNum(o.x, 1)}</td>
              <td className="num px-2 py-1.5 sm:px-3">{kpaText(o.y)}</td>
              <td className="px-2 py-1.5 sm:px-3">—</td>
            </tr>
          ))}
          {sorted.map((r) => (
            <tr key={r.id} className="text-fg">
              <th scope="row" className="px-2 py-1.5 font-normal text-muted sm:px-3">
                ISS test
              </th>
              <td className="num px-2 py-1.5 sm:px-3">{trimNum(r.oxygen, 1)}</td>
              <td className="num px-2 py-1.5 sm:px-3">
                {kpaText(r.kpa)}
                {r.pressureAssumed ? <span className="font-sans text-muted"> (assumed)</span> : null}
              </td>
              <td className="px-2 py-1.5 sm:px-3">{r.burned ? "Flame kept burning" : "Flame went out"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
