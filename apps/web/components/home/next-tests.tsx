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
    <a href={href} className="inline-flex min-h-10 items-center underline underline-offset-2">
      {children}
    </a>
  );
}

function Calm({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 md:p-6" role="status">
      <p className="text-prose">{children}</p>
    </div>
  );
}

/**
 * Reserved space while the ranking loads: three cards plus the what-if box, sized like the loaded content
 * (measured on a typical cabin) so the page below does not jump. No numbers, only empty shapes.
 */
const SKELETON_SIZES = [
  "h-[4.1rem] md:h-[1.4rem]",
  "h-[11rem] md:h-[7.5rem]",
  "h-[6.75rem] md:h-[5.75rem]",
  "h-[6.75rem] md:h-[5.75rem]",
  "h-[17.25rem] md:h-[13.5rem]",
] as const;

function ListSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Ranking the next tests">
      {SKELETON_SIZES.map((size, i) => (
        <Skeleton key={`${i}-${size}`} className={cn("rounded-xl", size)} />
      ))}
    </div>
  );
}

type Differing = ReturnType<typeof differingFields>;

/** A value that is the same in all three cards is quiet; the one that changes is bold, so the cards scan at a glance. */
function Val({ differs, children }: { differs: boolean; children: React.ReactNode }) {
  return <span className={differs ? "font-bold text-fg" : "font-medium text-fg/75"}>{children}</span>;
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
  return (
    <li
      className={cn("rounded-xl border bg-surface p-4 md:p-5", first ? "border-accent shadow-[0_0_0_1px_var(--accent)]" : "border-border")}
      data-testid={`next-test-${c.rank}`}
    >
      <div className="flex items-start gap-3 md:gap-4">
        <span
          aria-hidden
          className={cn(
            "num mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ui font-semibold text-surface md:size-8 md:text-prose",
            first ? "bg-accent" : "bg-fg",
          )}
        >
          {c.rank}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-title font-semibold tracking-[-0.01em]">
            Test {lowerFirst(material)}: <Val differs={diff.oxygen}>{oxygenText(c)} oxygen</Val>, <Val differs={diff.pressure}>{pressureText(c)}</Val>,{" "}
            <Val differs={diff.airflow}>{airflowText(c)} airflow</Val>
          </h3>
          {reduction ? (
            <p className="mt-1 text-prose">
              {reduction.lead} <span className="num font-semibold">{reduction.value}</span>
            </p>
          ) : null}
          {atTarget && first ? <p className="mt-2 text-ui text-muted">{atTargetSentence(c, target)}</p> : null}
          {c.feasibility_status === "outside_demonstrated_envelope" ? (
            <p className="mt-2 text-ui text-muted" data-testid="beyond-iss-note">
              Beyond what ISS tests have shown.
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
        <p className="text-prose" data-testid="closest-iss-test">
          {closestText}
        </p>
      ) : null}
      <ol role="list" className="space-y-3" aria-label="The three tests that would teach the model the most">
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
      <p className="mt-2 pl-10 text-ui text-muted md:pl-11" data-testid="candidate-framing">
        {CANDIDATE_FRAMING}
      </p>
      <div className="mt-5 space-y-3 md:mt-6">{body}</div>
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 md:mt-8">
        <Link href={explorerHref} className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-fg bg-fg px-5 text-prose font-medium text-surface transition-colors hover:bg-[#2c2c31] md:h-10" data-testid="open-explorer">
          Open this cabin in the Explorer <span aria-hidden>→</span>
        </Link>
        {briefLink ? (
          <Link href={briefLink} className="inline-flex min-h-10 items-center text-prose underline underline-offset-2" data-testid="open-brief">
            One-page brief
          </Link>
        ) : null}
      </div>
    </section>
  );
}
