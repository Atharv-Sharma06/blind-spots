"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { useHeadline } from "@/hooks/api";
import type { HeadlineProfile } from "@/lib/types";
import { cn } from "@/lib/cn";
import { DotNumber } from "@/components/ui/dot-number";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { cabinOrderIndex, coverageStatus, shortCabinName } from "./cabins";

/** The ISS cabin and the three cabins for Moon and Mars trips (all ids come from the cabin list in cabins.ts). */
const ISS_CABIN = "iss_cabin_nominal";
const MOON_MARS_CABINS = ["artemis_surface_habitat_10p2_26p5", "exploration_atmosphere_8p2_34", "orion_cm_lunar_design_10p2"] as const;
const MOON_MARS_PICK = "exploration_atmosphere_8p2_34";

/** Diagonal-stripe fill for "no nearby results" bars (the `hatch` utility, inlined so the chart never depends on it). */
const HATCH: React.CSSProperties = {
  backgroundImage: "repeating-linear-gradient(135deg, #CFCCC4 0 2px, transparent 2px 6px)",
};

const CHART_H = 132; // px, plot height

const fmt = (n: number) => n.toLocaleString("en-US");

const subscribeNever = () => () => {};

/** False while the server HTML is being hydrated, true afterwards: data that is already cached on the client must not
 *  change the first client render (it has to match the server's skeleton). */
export function useHydrated(): boolean {
  return React.useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

export interface StatsRowProps {
  /** Selects a cabin (same handler as the board). */
  onSelect: (id: string) => void;
}

/** Stats row on the beige band: bars per cabin, the radial gauge, two big numbers. All numbers come from /api/headline. */
export function StatsRow({ onSelect }: StatsRowProps) {
  const headline = useHeadline();
  const hydrated = useHydrated();
  const profiles = React.useMemo(
    () =>
      (headline.data?.data.profiles ?? [])
        .map((p, i) => ({ p, i }))
        .sort((a, b) => cabinOrderIndex(a.p.profile_id) - cabinOrderIndex(b.p.profile_id) || a.i - b.i)
        .map(({ p }) => p),
    [headline.data],
  );

  if (!hydrated || headline.isPending) return <StatsSkeleton />;
  if (headline.isError || profiles.length === 0) {
    return (
      <p role="status" className="mt-8 text-prose text-muted">
        The numbers for the cabins could not be loaded. Reload the page to try again.
      </p>
    );
  }

  const byId = new Map<string, HeadlineProfile>(profiles.map((p) => [p.profile_id, p]));
  const covered = profiles.filter((p) => coverageStatus(p) === "covered").length;
  const share = covered / profiles.length;
  const iss = byId.get(ISS_CABIN);
  const moonMars = MOON_MARS_CABINS.map((id) => byId.get(id)).filter((p): p is HeadlineProfile => p != null);
  const moonMarsMax = moonMars.length > 0 ? Math.max(...moonMars.map((p) => p.comparable_observations)) : null;

  function pick(id: string) {
    onSelect(id);
    const el = document.getElementById("cabins");
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  return (
    <div className="mt-8 grid items-start gap-x-12 gap-y-9 md:mt-10 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_auto_minmax(0,1fr)]">
      <BarChart profiles={profiles} />

      <div className="flex flex-col items-start gap-4 xl:items-center">
        <p className="text-[16px] font-medium leading-6 text-fg xl:self-start">Cabins covered</p>
        <ProgressRing
          value={share}
          size={176}
          ariaLabel={`${covered} of ${profiles.length} cabins are covered by nearby ISS tests`}
          label={<DotNumber className="text-[40px] font-medium leading-[44px] tracking-[-0.02em]">{`${Math.round(share * 100)}%`}</DotNumber>}
          sublabel={<span className="text-ui text-muted">covered</span>}
        />
        <p className="max-w-[16rem] text-ui leading-5 text-muted xl:text-center">
          {covered} of {profiles.length} cabins have nearby ISS tests for nearly all materials.
        </p>
      </div>

      <dl className="flex flex-col md:col-span-2 xl:col-span-1">
        {iss ? (
          <BigNumber
            value={fmt(iss.comparable_observations)}
            caption="nearby ISS results for the ISS cabin's own air"
            action="Show the ISS cabin"
            onAction={() => pick(ISS_CABIN)}
          />
        ) : null}
        {moonMarsMax != null ? (
          <BigNumber
            value={fmt(moonMarsMax)}
            caption={
              moonMarsMax === 0 ? "nearby ISS results for Moon and Mars cabin air" : "nearby ISS results at most, for Moon and Mars cabin air"
            }
            action="Show a Moon and Mars cabin"
            onAction={() => pick(byId.has(MOON_MARS_PICK) ? MOON_MARS_PICK : moonMars[0]!.profile_id)}
          />
        ) : null}
      </dl>
    </div>
  );
}

// ---- Bar chart -----------------------------------------------------------------------------------------------

/** Nearby ISS results per cabin: black bars where there are results, hatched stubs where there are none. */
function BarChart({ profiles }: { profiles: HeadlineProfile[] }) {
  const max = Math.max(1, ...profiles.map((p) => p.comparable_observations));
  return (
    <figure className="min-w-0">
      <figcaption className="text-[16px] font-medium leading-6 text-fg">Nearby ISS results per cabin</figcaption>
      <ul aria-label="Nearby ISS results per cabin" className="mt-5 flex items-end gap-1.5 sm:gap-2">
        {profiles.map((p) => {
          const n = p.comparable_observations;
          const name = shortCabinName(p.profile_id, p.label);
          const h = n === 0 ? 10 : Math.max(6, Math.round((n / max) * CHART_H));
          return (
            <li key={p.profile_id} title={`${name}: ${nearby(n)}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="num text-[11px] leading-4 text-fg">
                {fmt(n)}
                <span className="sr-only"> nearby ISS results for {name}</span>
              </span>
              <span
                aria-hidden
                className={cn("block w-full rounded-t-[6px]", n > 0 ? "bg-[#161616]" : "border border-b-0 border-[#CFCCC4]")}
                style={n > 0 ? { height: h } : { ...HATCH, height: h }}
              />
              <span
                aria-hidden
                className="block h-[5.25rem] max-h-[5.25rem] overflow-hidden text-ellipsis whitespace-nowrap border-t border-[#161616]/10 pt-1.5 text-[11px] leading-4 text-muted [text-orientation:mixed] [writing-mode:vertical-rl] rotate-180"
              >
                {name}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-label text-muted">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-[3px] bg-[#161616]" />
          Some nearby results
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-[3px] border border-[#CFCCC4]" style={HATCH} />
          None
        </span>
      </div>
    </figure>
  );
}

const nearby = (n: number) => (n === 0 ? "no nearby ISS results" : `${fmt(n)} nearby ISS ${n === 1 ? "result" : "results"}`);

// ---- Big numbers ---------------------------------------------------------------------------------------------

function BigNumber({ value, caption, action, onAction }: { value: string; caption: string; action: string; onAction: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-[#161616]/10 py-5 first:border-t-0 first:pt-0 md:first:pt-0">
      {/* dt before dd in the markup (the caption names the number); flex-col-reverse shows the number first. */}
      <div className="flex min-w-0 flex-col-reverse">
        <dt className="mt-1.5 max-w-[22ch] text-prose leading-6 text-muted">{caption}</dt>
        <dd>
          <DotNumber className="text-[40px] font-medium leading-[44px] tracking-[-0.02em]">{value}</DotNumber>
        </dd>
      </div>
      <button
        type="button"
        onClick={onAction}
        aria-label={action}
        className="btn-round inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[#161616]/15 bg-transparent text-fg transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ArrowRight className="size-5" aria-hidden />
      </button>
    </div>
  );
}

// ---- Skeleton (no text, no numbers) --------------------------------------------------------------------------

export function StatsSkeleton() {
  return (
    <div aria-hidden className="mt-8 grid items-start gap-x-12 gap-y-9 md:mt-10 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_auto_minmax(0,1fr)]">
      <div className="min-w-0">
        <Skeleton className="h-5 w-44 rounded-full" />
        <Skeleton className="mt-5 h-[13.5rem] w-full rounded-xl" />
      </div>
      <div className="flex flex-col items-start gap-4 xl:items-center">
        <Skeleton className="h-5 w-32 rounded-full xl:self-start" />
        <Skeleton className="size-[176px] rounded-full" />
      </div>
      <div className="flex flex-col gap-6 md:col-span-2 xl:col-span-1">
        <Skeleton className="h-[5.5rem] w-full rounded-xl" />
        <Skeleton className="h-[5.5rem] w-full rounded-xl" />
      </div>
    </div>
  );
}
