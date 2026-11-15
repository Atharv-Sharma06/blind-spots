"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssessTarget, useGroups, useObservations, useRankCandidates, useTargets } from "@/hooks/api";
import { CANDIDATE_FRAMING } from "@/lib/copy";
import { briefHref } from "@/components/brief/link";
import { cn } from "@/lib/cn";
import type { Candidate, GroupSummary, RankResponse, ResolvedTarget } from "@/lib/types";
import { testRows } from "./answer-copy";
import { materialName, shortCabinName } from "./cabins";
import {
  airflowText,
  atTargetSentence,
  closestIssSentence,
  closestIssTest,
  differingFields,
  isAtTarget,
  lowerFirst,
  oxygenText,
  pressureText,
  reductionParts,
  targetOutsideOxygenDomain,
  trimNumber,
} from "./next-logic";
import { StepHeading } from "./step-heading";
import { WhatIf } from "./what-if";

export interface NextTestsProps {
  /** Cabin (atmosphere profile id). */
  cabin: string;
  /** Material (analysis group id); null means "the API default group". */
  material: string | null;
}

/** The chosen group, else the API default group, else the first modelled one. */
function resolveGroup(groups: readonly GroupSummary[], material: string | null): GroupSummary | null {
  return (
    (material ? groups.find((g) => g.group_id === material) : undefined) ??
    groups.find((g) => g.is_default) ??
    groups.find((g) => g.model_status === "modeled") ??
    null
  );
}

/** One calm sentence in the card's place (loading finished, but there is nothing to rank). */
function JumpLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="inline-flex min-h-10 items-center underline decoration-accent underline-offset-4 hover:text-accent">
      {children}
    </a>
  );
}

function Calm({ children }: { children: React.ReactNode }) {
  return (
    <div className="card p-5 md:p-7" role="status">
      <p className="text-prose text-fg">{children}</p>
    </div>
  );
}

/**
 * Reserved space while the ranking loads: three cards plus the what-if box, sized like the loaded content
 * (measured on a typical cabin) so the page below does not jump. No numbers, only empty shapes.
 */
const SKELETON_SIZES = [
  "h-[5.25rem] md:h-[2.875rem]",
  "h-[20.875rem] md:h-[12.125rem]",
  "h-[16.375rem] md:h-[10.125rem]",
  "h-[16.375rem] md:h-[10.125rem]",
  "h-[27.5rem] md:h-[19.375rem]",
] as const;

function ListSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Ranking the next tests">
      {SKELETON_SIZES.map((size, i) => (
        <Skeleton key={`${i}-${size}`} className={cn("bg-subtle", i === 0 ? "rounded-xl" : "rounded-2xl", size)} />
      ))}
    </div>
  );
}

type Differing = ReturnType<typeof differingFields>;

/**
 * One condition as an outlined chip (radius 8, 1 px border). A value that is the same in all three cards is quiet; the one
 * that changes is medium weight with a stronger border, so the cards scan at a glance. The sr-only comma keeps the heading
 * reading as one sentence ("Test cotton: 21 % oxygen, 101 kPa, 20 cm/s airflow").
 */
function Chip({ differs, ink, last, children }: { differs: boolean; ink: boolean; last?: boolean; children: React.ReactNode }) {
  // Plain template strings, not cn(): tailwind-merge reads the custom size "text-ui" as a text colour and would drop it.
  const tone = ink
    ? differs
      ? "border-white/60 font-medium text-white"
      : "border-white/25 text-white/75"
    : differs
      ? "border-border-strong font-medium text-fg"
      : "border-border text-muted";
  return (
    <>
      <span className={`inline-flex min-h-8 items-center whitespace-nowrap rounded-lg border px-3 text-ui ${tone}`}>
        {children}
      </span>
      {last ? null : <span className="sr-only">, </span>}
    </>
  );
}

function CandidateCard({
  c,
  material,
  target,
  atTarget,
  first,
  diff,
}: {
  c: Candidate;
  material: string;
  target: ResolvedTarget;
  atTarget: boolean;
  first: boolean;
  diff: Differing;
}) {
  const reduction = reductionParts(c);
  const note = `text-ui ${first ? "text-white/70" : "text-muted"}`; // template, not cn(): see Chip
  return (
    <li
      className={cn("relative p-5 md:p-7", first ? "card-ink text-white" : "card")}
      data-testid={`next-test-${c.rank}`}
    >
      <div className="flex items-start gap-4 md:gap-5">
        <span
          aria-hidden
          className={`num mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full border text-prose font-medium ${
            first ? "border-white bg-white text-[#161616]" : "border-border-strong bg-surface text-fg"
          }`}
        >
          {c.rank}
        </span>
        <div className="min-w-0 flex-1 md:flex md:items-end md:justify-between md:gap-8">
          <div className="min-w-0 flex-1">
            <h3 className="text-title font-medium leading-snug tracking-[-0.01em] md:text-[1.25rem] md:leading-7">
              Test {lowerFirst(material)}
              <span className="sr-only">: </span>
              <span className="mt-3 flex flex-wrap gap-2 font-normal">
                <Chip differs={diff.oxygen} ink={first}>
                  {oxygenText(c)} oxygen
                </Chip>
                <Chip differs={diff.pressure} ink={first}>
                  {pressureText(c)}
                </Chip>
                <Chip differs={diff.airflow} ink={first} last>
                  {airflowText(c)} airflow
                </Chip>
              </span>
            </h3>
            {atTarget && first ? <p className={`mt-3 ${note}`}>{atTargetSentence(c, target)}</p> : null}
            {c.feasibility_status === "outside_demonstrated_envelope" ? (
              <p className={`mt-3 ${note}`} data-testid="beyond-iss-note">
                Beyond what ISS tests have shown.
              </p>
            ) : null}
          </div>
          {reduction ? (
            <p className={cn("mt-5 flex items-end justify-between gap-3 border-t pt-4 md:mt-0 md:block md:shrink-0 md:border-0 md:pt-0 md:text-right", first ? "border-white/15" : "border-border")}>
              <span className={`${note} md:block`}>{reduction.lead}</span>{" "}
              <span className="block whitespace-nowrap text-display font-medium leading-none tracking-[-0.02em] tabular-nums md:mt-2">{reduction.value}</span>
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function Ranked({ r, material, cabin, groupId }: { r: RankResponse; material: string; cabin: string; groupId: string }) {
  const first = r.candidates[0] as Candidate;
  const top3 = r.candidates.slice(0, 3);
  const diff = differingFields(top3);
  // The same observations request the answer card makes (already cached); the line simply is absent if it is unavailable.
  const obsQ = useObservations(groupId);
  const rows = obsQ.isPlaceholderData ? null : obsQ.data?.data ? testRows(obsQ.data.data).rows : null;
  // Same assess request as the answer card (cached; also in the snapshot): its nearest ISS test is the one to name.
  const assessQ = useAssessTarget({ group_id: groupId, target: { profile_id: cabin } });
  const nearestObs = assessQ.isPlaceholderData ? null : (assessQ.data?.data.coverage.nearest_observations[0] ?? null);
  const closest = rows ? closestIssTest(rows, r.target, r.candidate_domain, nearestObs) : null;
  const closestText = closest ? closestIssSentence(closest) : null;
  return (
    <>
      {closestText ? (
        <p className="rounded-xl border border-border bg-subtle px-4 py-3 text-ui text-muted" data-testid="closest-iss-test">
          {closestText}
        </p>
      ) : null}
      <ol role="list" className="space-y-4" aria-label="The three tests that would teach the model the most">
        {top3.map((c) => (
          <CandidateCard key={c.candidate_id} c={c} material={material} target={r.target} atTarget={isAtTarget(c, r.target)} first={c.rank === first.rank} diff={diff} />
        ))}
      </ol>
      <p className="text-ui text-muted" data-testid="feasibility-note">
        Feasibility is not verified.
      </p>
      <WhatIf cabin={cabin} groupId={groupId} candidate={first} />
    </>
  );
}

/** Step 3: the three research candidates for this cabin and material, and what the first one would teach the model. */
export function NextTests({ cabin, material }: NextTestsProps) {
  const groupsQ = useGroups();
  const targetsQ = useTargets();
  const groups = groupsQ.data?.data;
  const group = groups ? resolveGroup(groups, material) : null;
  const modelled = group?.model_status === "modeled";

  // The same request the Explorer's candidate panel sends for a profile target (snapshot entries exist for all of them).
  const rankQ = useRankCandidates(group && modelled ? { group_id: group.group_id, target: { profile_id: cabin }, k: 3 } : null);
  const fresh = rankQ.isPlaceholderData ? null : (rankQ.data?.data ?? null);
  const r = fresh && group && fresh.group_id === group.group_id && fresh.target.profile_id === cabin ? fresh : null;

  const profile = targetsQ.data?.data.profiles.find((p) => p.profile_id === cabin);
  const cabinName = shortCabinName(cabin, profile?.name ?? cabin);
  const matName = group ? materialName(group.group_id, group.label) : null;
  const suggestion = groups?.find((g) => g.is_default && g.model_status === "modeled") ?? groups?.find((g) => g.model_status === "modeled");

  let body: React.ReactNode;
  if (groupsQ.isError && !groups) {
    body = (
      <Calm>
        Could not load the materials.{" "}
        <Button variant="secondary" className="ml-1 h-10 px-4 md:h-9" onClick={() => void groupsQ.refetch()}>
          Try again
        </Button>
      </Calm>
    );
  } else if (!group) {
    body = <ListSkeleton />;
  } else if (!modelled) {
    body = (
      <Calm>
        Too few ISS test results on {matName} to rank tests. <JumpLink href="#answer">Try another material</JumpLink>
        {suggestion ? `, such as ${lowerFirst(materialName(suggestion.group_id, suggestion.label))}` : ""}.
      </Calm>
    );
  } else if (rankQ.isError && !r) {
    body = (
      <Calm>
        Could not load the ranking.{" "}
        <Button variant="secondary" className="ml-1 h-10 px-4 md:h-9" onClick={() => void rankQ.refetch()}>
          Try again
        </Button>
      </Calm>
    );
  } else if (!r) {
    body = <ListSkeleton />;
  } else if (r.status !== "ok" || r.candidates.length === 0) {
    const [lo, hi] = r.candidate_domain.oxygen_percent;
    const outside = r.status !== "model_unavailable" && targetOutsideOxygenDomain(r.target, r.candidate_domain);
    const cabinO2 = r.target.oxygen_percent.nominal ?? r.target.oxygen_percent.max ?? r.target.oxygen_percent.min;
    body = (
      <Calm>
        {r.status === "model_unavailable"
          ? `No model for ${matName} yet, so no tests can be ranked. `
          : outside
            ? `${cabinName}${typeof cabinO2 === "number" ? ` has ${trimNumber(cabinO2, 1)} % oxygen` : " is outside the range"}. We only rank tests between ${trimNumber(lo, 0)} and ${trimNumber(hi, 0)} % oxygen. `
            : `No test would teach the model more about this cabin for ${matName}. `}
        {outside ? (
          <>
            <JumpLink href="#cabins">Pick another cabin</JumpLink> to see ranked tests.
          </>
        ) : (
          <>
            <JumpLink href="#answer">Try another material</JumpLink>.
          </>
        )}
      </Calm>
    );
  } else {
    body = <Ranked r={r} material={matName ?? ""} cabin={cabin} groupId={(group as GroupSummary).group_id} />;
  }

  const outsideRange = !!r && r.status !== "model_unavailable" && (r.status !== "ok" || r.candidates.length === 0) && targetOutsideOxygenDomain(r.target, r.candidate_domain);
  const briefLink = group && modelled ? briefHref(group.group_id, { profile_id: cabin }) : null;
  const explorerHref = `/explore?target=${encodeURIComponent(cabin)}${group ? `&group=${encodeURIComponent(group.group_id)}` : ""}`;

  return (
    <section id="next" data-tour="next" aria-labelledby="next-h" className="scroll-mt-20">
      <StepHeading
        n={3}
        id="next-h"
        title="What to test next"
        hint={
          outsideRange && r
            ? `We only rank tests between ${trimNumber(r.candidate_domain.oxygen_percent[0], 0)} and ${trimNumber(r.candidate_domain.oxygen_percent[1], 0)} % oxygen.`
            : `Three tests that would teach the model the most about ${cabinName}.`
        }
      />
      <p className="mt-3 text-prose text-muted" data-testid="candidate-framing">
        {CANDIDATE_FRAMING}
      </p>
      <div className="mt-5 space-y-4 md:mt-6">{body}</div>
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 md:mt-8">
        <Link href={explorerHref} className="pill-ink inline-flex h-[52px] items-center justify-center gap-2 whitespace-nowrap px-6 text-prose" data-testid="open-explorer">
          Open this cabin in the Explorer <span aria-hidden>→</span>
        </Link>
        {briefLink ? (
          <Link href={briefLink} className="inline-flex min-h-10 items-center text-prose underline decoration-accent underline-offset-4 hover:text-accent" data-testid="open-brief">
            One-page brief
          </Link>
        ) : null}
      </div>
    </section>
  );
}
