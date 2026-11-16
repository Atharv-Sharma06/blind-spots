"use client";

import * as React from "react";
import Link from "next/link";
import { Disclosure } from "@/components/ui/disclosure";
import { DotNumber } from "@/components/ui/dot-number";
import { ProgressRing } from "@/components/ui/progress-ring";
import { ProvenanceTag } from "@/components/ui/provenance-tag";
import { Term } from "@/components/ui/term";
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
import { useHydrated } from "./stats-row";
import { MaterialPicker } from "./material-picker";
import { CHART_HEIGHT_CLASS, SimpleChart } from "./simple-chart";

export interface AnswerCardProps {
  cabin: string;
  /** Selected material (analysis group id); null means the API's default group. */
  material: string | null;
  onMaterialChange: (id: string | null) => void;
}

/** Status words and dots (words plus dots, never colour alone): black = not covered, amber = barely or partly, green = covered. */
const TONE: Record<VerdictTone, { word: string; dot: string }> = {
  blind: { word: "Not covered", dot: "bg-fg" },
  partly: { word: "Barely covered", dot: "bg-[#E8A33B]" },
  covered: { word: "Covered", dot: "bg-[#2FD067]" },
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

  // Server and first client render both show the skeleton; data cached on the client must not change the first paint.
  const hydrated = useHydrated();
  return (
    <section id="answer" data-tour="answer" aria-labelledby="answer-heading" className="scroll-mt-20">
      <StepHeading n={2} id="answer-heading" title="The answer" hint="Do the ISS flame tests cover this cabin's air?" />

      <div className="card mt-4 overflow-hidden" data-testid="answer-card">
        {fatal ? (
          <Notice>We could not load the cabin data. Please reload the page.</Notice>
        ) : unknownCabin ? (
          <Notice>We do not know that cabin. Pick one of the cabins above.</Notice>
        ) : !hydrated || !profile || !group || !headlineSettled ? (
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
                <div className="border-t border-border px-5 py-4 sm:px-8">
                  <MaterialPicker part="select" groups={groups} nearby={nearby} selectedId={group.group_id} onChange={(id) => onMaterialChange(id)} />
                </div>
              }
            />
            <div id="chart" data-tour="chart" className="scroll-mt-20 border-t border-border px-5 pt-6 pb-5 sm:px-8">
              {results ? (
                <ChartBlock profile={profile} cabinId={cabin} profiles={profiles} results={results} notUsedReason={notUsedReason} materialLabel={lcFirst(materialName(group.group_id, group.label))} />
              ) : (
                <div className={cn("w-full", CHART_HEIGHT_CLASS)} aria-busy="true">
                  <Skeleton className="h-full w-full" />
                </div>
              )}
            </div>
            <div className="border-t border-border px-5 py-2 sm:px-8">
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
      <div className="h-[330px] space-y-4 px-5 py-6 sm:h-[220px] sm:px-8 sm:py-8">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-8 w-full max-w-xl" />
      </div>
      <div className="h-[84px] border-t border-border px-5 py-4 sm:h-[81px] sm:px-8" />
      <div className="h-[150px] space-y-3 px-5 py-4 sm:h-[110px] sm:px-8">
        <Skeleton className="h-4 w-full max-w-3xl" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="border-t border-border px-5 pt-6 pb-5 sm:px-8">
        <Skeleton className={cn("w-full", CHART_HEIGHT_CLASS)} />
        <div className="h-[151px] sm:h-[109px]" />
      </div>
      <div className="h-[77px] border-t border-border px-5 py-2 sm:h-[65px] sm:px-8" />
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

  const line = (sub: string, strong: string, link: string) => (
    <p className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-ui", sub)}>
      <span className={cn("text-title font-medium", strong)} title={profile.name}>
        {name}
      </span>
      {air ? (
        <span>
          {air.o2UpTo ? "up to " : ""}
          <span className={cn("font-medium", strong)}>{trimNum(air.o2, 1)} % oxygen</span> · <span className={cn("font-medium", strong)}>{kpaText(air.kpa)} kPa</span>
        </span>
      ) : null}
      <a href="#cabins" className={cn("-my-2.5 inline-flex min-h-10 items-center text-ui font-medium underline underline-offset-2 hover:text-fg sm:order-last sm:ml-auto", link)} data-testid="change-cabin">
        Change cabin
      </a>
      {STATUS_NOTE[profile.status] ? (
        <span className={cn("text-xs", sub)} data-testid="cabin-status">
          ({STATUS_NOTE[profile.status]})
        </span>
      ) : null}
    </p>
  );
  const cabinLine = line("text-muted", "text-fg", "text-fg decoration-fg/40");

  if (assessError) {
    const unavailable = isApiError(assessError) && assessError.snapshotUnavailable;
    return (
      <div className="px-5 py-6 sm:px-8" data-testid="answer-verdict" data-verdict="error">
        {cabinLine}
        <p className="mt-3 text-prose text-fg">
          {unavailable ? "This cabin and material are not in the precomputed version. Try another material." : "We could not work out this answer."}
        </p>
        {unavailable ? null : (
          <button type="button" onClick={onRetry} className="mt-2 inline-flex h-10 items-center rounded-full border border-border-strong px-4 text-ui font-medium text-fg hover:bg-subtle">
            Try again
          </button>
        )}
        <div className="-mx-5 mt-5 sm:-mx-8">{picker}</div>
      </div>
    );
  }

  if (!assess || !tone) {
    return (
      <div aria-busy="true" aria-label="Loading the answer" data-testid="answer-verdict" data-verdict="loading">
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          {cabinLine}
          <Skeleton className="mt-4 h-[250px] w-full sm:h-[104px] sm:max-w-xl" />
        </div>
        {picker}
        <div className="space-y-2 px-5 py-5 sm:px-8">
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
  // "Blind spot" is shown as "Not covered" (the word the cabin cards use); "Barely/Partly covered" come from the title itself.
  const statusWord = assess.verdict === "extrapolation" ? (title.split(":")[0] ?? tone.word) : tone.word;
  const explorer = `/explore?target=${encodeURIComponent(cabinId)}&group=${encodeURIComponent(group.group_id)}`;
  // Two short sentences: what the ISS tests covered (first sentence only; the pressure caveat sits under the chart) and the gravity limit.
  const rangeSentence = sentences[0]?.startsWith("For ") ? sentences[0].replace(/\.\s+[A-Z].*$/, ".") : null;

  // Share of this cabin's sampled air points with a nearby ISS test (API coverage); no ring when the API gives no points.
  const pts = assess.coverage.points_with_comparable;
  const nPts = assess.coverage.n_target_points;
  const hasPts = Number.isFinite(pts) && Number.isFinite(nPts) && nPts > 0;

  return (
    <div data-testid="answer-verdict" data-verdict={assess.verdict}>
      <div className="flex flex-col gap-6 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10 sm:px-8 sm:py-8">
        <div className="min-w-0 flex-1">
          {cabinLine}
          <p className="mt-5 inline-flex items-center gap-2 text-ui font-medium text-fg" data-testid="verdict-status">
            <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full print:border print:border-fg", tone.dot)} />
            {statusWord}
          </p>
          <p className="mt-2 text-[28px] leading-[34px] font-medium tracking-[-0.025em] text-balance text-fg sm:text-[36px] sm:leading-[42px]" role="status">
            <span data-testid="verdict-title">{title}</span>
          </p>
        </div>
        {hasPts ? (
          <div className="flex shrink-0 flex-col items-center gap-1.5 self-start sm:self-center">
            <ProgressRing
              className="shrink-0 text-fg"
              value={pts / nPts}
              size={144}
              stroke={6}
              label={<DotNumber className="text-[40px] leading-none font-medium text-fg">{pts}</DotNumber>}
              sublabel={
                <span className="block text-xs leading-4 whitespace-nowrap text-muted">
                  of {nPts} points
                  <br />
                  with ISS tests
                </span>
              }
              ariaLabel={`${pts} of ${nPts} points in this cabin's air have nearby ISS tests.`}
            />
            <ProvenanceTag kind="derived" title="Counted by our code from the ISS test results near this cabin's air." className="-mt-3 text-muted" />
          </div>
        ) : null}
      </div>
      {picker}
      <div className="space-y-2 px-5 py-5 sm:px-8">
        {rangeSentence ? (
          <p className="max-w-3xl text-title leading-7 text-fg">
            {noBreakNumbers(rangeSentence)} <ProvenanceTag kind="measured" className="text-muted" />
          </p>
        ) : null}
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
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-ui text-muted">
        <span className="inline-flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <circle cx="6" cy="6" r="4.6" fill="var(--observed)" />
          </svg>
          Flame <Term id="kept_burning">kept burning</Term>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <circle cx="6" cy="6" r="4.1" fill="var(--surface)" stroke="var(--observed)" strokeWidth="1.5" />
          </svg>
          Flame <Term id="went_out">went out</Term>
        </span>
        {others.length > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <circle cx="6" cy="6" r="3.2" fill="var(--muted)" fillOpacity="0.55" />
            </svg>
            Other cabins
          </span>
        ) : null}
        {cabin.xHi - cabin.xLo > 0 || cabin.yHi - cabin.yLo > 0 ? (
          <span className="inline-flex items-center gap-1.5" data-testid="legend-range">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <rect x="1" y="1" width="10" height="10" rx="2" fill="none" stroke="var(--fg)" strokeWidth="1.25" strokeDasharray="2 2.5" />
            </svg>
            Dashed box: this cabin&apos;s air range
          </span>
        ) : null}
      </div>
      {assumed > 0 ? (
        <p className="mt-2 max-w-3xl text-xs text-muted">
          {assumedKpa !== null
            ? `${assumed === rows.length ? "These tests did not record pressure" : "Some tests did not record pressure"}; the chart uses an assumed ${kpaText(assumedKpa)} kPa.`
            : "Some tests did not record pressure; the chart uses assumed values."}{" "}
          <ProvenanceTag kind="assumed" />
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
    <div className="max-h-72 overflow-y-auto rounded-[var(--radius-md)] border border-border" tabIndex={0} role="region" aria-label={`Table of ISS test results for ${materialLabel}`}>
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
