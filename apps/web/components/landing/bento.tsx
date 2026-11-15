"use client";

import Link from "next/link";
import { useGroups, useHeadline, useRankCandidates } from "@/hooks/api";
import { DotNumber } from "@/components/ui/dot-number";
import { ProgressRing } from "@/components/ui/progress-ring";
import { CANDIDATE_FRAMING } from "@/lib/copy";
import { DEFAULT_CABIN } from "@/components/home/cabins";
import { percentText, reductionFraction } from "@/components/home/next-logic";
import { cn } from "@/lib/cn";

const ISS_CABIN = "iss_cabin_nominal";

/** A soft placeholder block with reserved size: no numbers while loading. */
function Hold({ className, label }: { className?: string; label: string }) {
  return <span role="status" aria-label={label} className={cn("block animate-pulse rounded-lg bg-white/10", className)} />;
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-prose text-white">{children}</p>;
}

function useHeadlineCounts() {
  const q = useHeadline();
  const profiles = q.data?.data.profiles ?? null;
  const iss = profiles?.find((p) => p.profile_id === ISS_CABIN) ?? null;
  const moonMars = profiles?.find((p) => p.profile_id === DEFAULT_CABIN) ?? null;
  const none = profiles ? profiles.filter((p) => p.comparable_observations === 0).length : null;
  return { q, iss, moonMars, none, total: profiles?.length ?? null };
}

function useTopCut() {
  const groupsQ = useGroups();
  const groups = groupsQ.data?.data;
  const group = groups ? (groups.find((g) => g.is_default) ?? groups.find((g) => g.model_status === "modeled") ?? null) : null;
  const modelled = group?.model_status === "modeled";
  // Exactly the request the Cabins page sends for its default cabin (the judges' snapshot has it).
  const rankQ = useRankCandidates(group && modelled ? { group_id: group.group_id, target: { profile_id: DEFAULT_CABIN }, k: 3 } : null);
  const r = rankQ.isPlaceholderData ? null : (rankQ.data?.data ?? null);
  const top = r?.candidates.find((c) => c.rank === 1) ?? r?.candidates[0] ?? null;
  const f = top ? reductionFraction(top) : null;
  const failed = groupsQ.isError || rankQ.isError || (groups !== undefined && !modelled) || (r !== null && f === null);
  return { cut: f === null ? null : percentText(f), failed };
}

/** Charcoal card: how much ISS test data sits near the station's own air. */
function IssCard() {
  const { q, iss } = useHeadlineCounts();
  return (
    <article className="card flex min-h-[19rem] flex-col justify-between gap-6 p-7 md:row-span-2 md:min-h-[26rem] md:p-9">
      <div>
        <p className="text-label uppercase tracking-[0.14em] text-muted">Today</p>
        <h3 className="mt-2 text-heading font-medium text-fg">ISS air</h3>
      </div>
      <div className="flex flex-col items-start gap-3">
        <div className="flex h-24 items-end md:h-32">
          {iss ? (
            <DotNumber className="text-[5.5rem] leading-none text-fg md:text-[7.5rem]">{iss.comparable_observations}</DotNumber>
          ) : q.isError ? (
            <span className="text-prose text-muted">Could not load the count.</span>
          ) : (
            <Hold className="h-20 w-48 md:h-28 md:w-64" label="Loading the ISS count" />
          )}
        </div>
        <p className="text-title text-muted">nearby ISS test results</p>
      </div>
      <span className="h-px w-full border-t-2 border-dotted border-white/25" aria-hidden="true" />
    </article>
  );
}

/** Magenta card: the Moon & Mars cabin air has no nearby ISS tests. */
function MoonMarsCard() {
  const { q, iss, moonMars, none, total } = useHeadlineCounts();
  const ready = moonMars && iss && none !== null && total !== null;
  const value = ready && iss.comparable_observations > 0 ? Math.min(1, moonMars.comparable_observations / iss.comparable_observations) : null;
  return (
    <article className="card-magenta relative isolate flex min-h-[14rem] items-center justify-between gap-5 p-7 max-[399px]:flex-col max-[399px]:items-start max-[399px]:gap-4 md:px-10">
      {/* Darkens the light corner under the text so the words stay readable. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-[radial-gradient(75%_130%_at_0%_0%,rgb(94_35_129/0.5),transparent_80%)]"
      />
      <div className="min-w-0">
        <h3 className="text-heading font-medium text-white">Moon &amp; Mars air</h3>
        <div className="mt-2 min-h-12">
          {ready ? (
            <Muted>
              {none} of {total} cabins have none
            </Muted>
          ) : q.isError ? (
            <Muted>Could not load the counts.</Muted>
          ) : (
            <Hold className="h-5 w-40 bg-white/20" label="Loading the cabin counts" />
          )}
        </div>
      </div>
      <div className="shrink-0">
        {ready ? (
          <ProgressRing
            value={value}
            size={152}
            stroke={5}
            label={<DotNumber className="text-[4.25rem] text-white">{moonMars.comparable_observations}</DotNumber>}
            sublabel={<span className="text-ui text-white">nearby</span>}
            ariaLabel={`${moonMars.comparable_observations} nearby ISS test results for the Moon and Mars cabin air`}
          />
        ) : (
          <Hold className="size-[9.5rem] rounded-full bg-white/15" label="Loading" />
        )}
      </div>
    </article>
  );
}

/** Indigo card: the top research candidate's uncertainty cut for the default cabin. */
function NextCard() {
  const { cut, failed } = useTopCut();
  // Digits in the dot font, the % sign in the normal font (the dotted % reads as an X).
  const digits = cut?.match(/^(\d+(?:\.\d+)?)\s*%$/)?.[1] ?? null;
  return (
    <article className="card-indigo flex min-h-[12rem] flex-col justify-between gap-4 p-7 md:px-10">
      <div className="flex min-w-0 flex-col gap-3">
        <div>
          <h3 className="text-heading font-medium text-white">What to test next</h3>
          <p className="mt-2 text-prose text-white">The top test cuts uncertainty by</p>
        </div>
        <div className="flex min-h-14 items-end md:min-h-[4.5rem]">
          {digits ? (
            <span className="whitespace-nowrap">
              <DotNumber className="text-[3.5rem] text-white md:text-[4.5rem]">{digits}</DotNumber>
              <span className="ml-1 text-heading font-medium text-white">%</span>
            </span>
          ) : cut ? (
            <span className="text-heading font-medium text-white">{cut}</span>
          ) : failed ? (
            <span className="text-ui text-white">Not available</span>
          ) : (
            <Hold className="h-12 w-28 bg-white/15" label="Loading the top test" />
          )}
        </div>
      </div>
      <p className="text-label text-white/70">{CANDIDATE_FRAMING}</p>
    </article>
  );
}

/** Yellow tile: the main way in. */
function CheckTile() {
  return (
    <Link
      href="/cabins"
      className="pill-yellow flex min-h-24 items-center justify-center gap-3 px-8 text-title md:col-span-2 md:min-h-28 md:text-heading"
    >
      Check a cabin <span aria-hidden="true">→</span>
    </Link>
  );
}

export function Bento() {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-5">
      <IssCard />
      <MoonMarsCard />
      <NextCard />
      <CheckTile />
    </div>
  );
}
