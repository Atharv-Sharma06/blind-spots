"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpDown, Check } from "lucide-react";
import { useHeadline, useTargets } from "@/hooks/api";
import type { AtmosphereProfile, HeadlineProfile } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CABIN_ROW_LABEL,
  COVERAGE_STATUS_LABEL,
  DEFAULT_CABIN,
  STATUS_COLUMNS,
  STATUS_DOT,
  cabinOrderIndex,
  cabinRow,
  coverageStatus,
  shortCabinName,
  type CoverageStatus,
} from "./cabins";
import { cabinAir } from "./cabin-air";
import { StepHeading } from "./step-heading";
import { useHydrated } from "./stats-row";

export interface CabinPickerProps {
  cabin: string;
  onSelect: (id: string) => void;
}

/** One board column: a status (or "all cabins" while the status is unknown) and its cabins. */
interface Column {
  key: string;
  title: string;
  status: CoverageStatus | null;
  items: AtmosphereProfile[];
}

/** Cards of one column: stacked on phones, two across on tablets, one per row in the three-column board. */
const CARD_LIST = "grid gap-4 sm:grid-cols-2 xl:grid-cols-1";
/** Skeleton card height, measured from the loaded cards so the board does not jump. */
const CARD_H = "h-[12.5rem]";

/** Step 1: the cabin board. Three columns by coverage status, one card per crew cabin. Radio-group semantics, arrow keys, selection lives in the URL. */
export function CabinPicker({ cabin, onSelect }: CabinPickerProps) {
  const targets = useTargets();
  const headline = useHeadline();
  const hydrated = useHydrated();

  const profiles = React.useMemo(() => {
    const all = targets.data?.data.profiles ?? [];
    return all
      .filter((p) => p.kind !== "envelope")
      .map((p, i) => ({ p, i }))
      .sort((a, b) => cabinOrderIndex(a.p.profile_id) - cabinOrderIndex(b.p.profile_id) || a.i - b.i)
      .map(({ p }) => p);
  }, [targets.data]);

  const headlineById = React.useMemo(() => {
    const m = new Map<string, HeadlineProfile>();
    for (const h of headline.data?.data.profiles ?? []) m.set(h.profile_id, h);
    return m;
  }, [headline.data]);

  // By status once the numbers are in; one plain column (no guessed status) while they load or if they fail.
  const columns = React.useMemo<Column[]>(() => {
    if (profiles.length === 0) return [];
    if (!headline.data) return [{ key: "all", title: "All cabins", status: null, items: profiles }];
    return STATUS_COLUMNS.map((status) => ({
      key: status,
      title: COVERAGE_STATUS_LABEL[status],
      status,
      items: profiles.filter((p) => {
        const h = headlineById.get(p.profile_id);
        return h ? coverageStatus(h) === status : status === "none";
      }),
    }));
  }, [profiles, headline.data, headlineById]);

  // An unknown ?cabin= (typo, envelope) falls back to the default instead of leaving nothing selected.
  const known = profiles.some((p) => p.profile_id === cabin);
  React.useEffect(() => {
    if (profiles.length > 0 && !known) {
      const fallback = profiles.some((p) => p.profile_id === DEFAULT_CABIN) ? DEFAULT_CABIN : profiles[0]!.profile_id;
      onSelect(fallback);
    }
  }, [profiles, known, onSelect]);

  // Arrow keys walk the board in reading order: column by column, top to bottom.
  const order = columns.flatMap((c) => c.items.map((p) => p.profile_id));
  const tabbable = known ? cabin : order[0];

  function choose(id: string, via: "pointer" | "keyboard") {
    onSelect(id);
    if (via === "pointer") scrollToAnswer();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, id: string) {
    const i = order.indexOf(id);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % order.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + order.length) % order.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = order.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const nextId = order[next]!;
    choose(nextId, "keyboard");
    document.querySelector<HTMLElement>(`[data-cabin="${CSS.escape(nextId)}"]`)?.focus();
  }

  return (
    <section id="cabins" data-tour="cabins" aria-labelledby="cabins-h" className="scroll-mt-16">
      <StepHeading n={1} id="cabins-h" title="Pick a cabin" hint="Each card shows its air and whether ISS tests cover it." hintOnPhone={false} hintInline />

      <div className="mt-6 md:mt-7">
        {!hydrated || targets.isPending ? (
          <PickerSkeleton />
        ) : targets.isError ? (
          <p role="alert" className="card px-5 py-4 text-prose text-muted">
            The list of cabins could not be loaded. Reload the page to try again.
          </p>
        ) : (
          <div className={cn("grid items-start gap-x-6 gap-y-9", columns.length > 1 && "xl:grid-cols-3")}>
            {columns.map((col) => (
              <div key={col.key} data-board-column={col.key} className="min-w-0">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 id={`cabins-${col.key}-h`} className="text-[1.5rem] font-medium leading-8 tracking-[-0.02em] text-fg md:text-[1.75rem] md:leading-9">
                    {col.title}
                  </h3>
                  <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-fg/20 px-3 text-ui text-fg">
                    <span className="num">{col.items.length}</span>
                    <span className="sr-only">{col.items.length === 1 ? "cabin" : "cabins"}</span>
                    <ArrowUpDown className="size-3.5 text-muted" aria-hidden />
                  </span>
                </div>
                {col.items.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border-strong px-5 py-6 text-prose text-muted">No cabins in this column.</p>
                ) : (
                  <div role="radiogroup" aria-labelledby={`cabins-${col.key}-h`} className={CARD_LIST}>
                    {col.items.map((p) => (
                      <CabinCard
                        key={p.profile_id}
                        profile={p}
                        selected={p.profile_id === cabin && known}
                        tabbable={p.profile_id === tabbable}
                        onLightGrey={col.status === "covered"}
                        stats={headlineById.get(p.profile_id)}
                        headlinePending={headline.isPending}
                        headlineFailed={headline.isError}
                        onChoose={(id) => choose(id, "pointer")}
                        onKeyDown={onKeyDown}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-6 text-label leading-5 text-muted">
        Covered: nearby ISS tests for nearly all materials. Barely: some. Not covered: none.{" "}
        <Link href="/methodology" className="-my-2.5 inline-block py-2.5 underline underline-offset-2 hover:text-fg">
          How it works
        </Link>
      </p>
    </section>
  );
}

/** Moves the answer into view after a deliberate pick, so tapping a card visibly does something. */
function scrollToAnswer() {
  const el = document.getElementById("answer");
  if (!el) return;
  const top = el.getBoundingClientRect().top;
  // Already comfortably in view: leave the page where it is.
  if (top >= 0 && top < window.innerHeight * 0.45) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

// ---- Card -------------------------------------------------------------------------------------------------

interface CabinCardProps {
  profile: AtmosphereProfile;
  selected: boolean;
  tabbable: boolean;
  /** Cards in the last ("Covered") column sit on light grey, like the reference's last column. */
  onLightGrey: boolean;
  stats: HeadlineProfile | undefined;
  headlinePending: boolean;
  headlineFailed: boolean;
  onChoose: (id: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>, id: string) => void;
}

function CabinCard({ profile, selected, tabbable, onLightGrey, stats, headlinePending, headlineFailed, onChoose, onKeyDown }: CabinCardProps) {
  const id = profile.profile_id;
  const name = shortCabinName(id, profile.name);
  const air = cabinAir(profile);
  const status: CoverageStatus | null = stats ? coverageStatus(stats) : null;
  const chip = cn(
    "inline-flex min-h-8 items-center whitespace-nowrap rounded-lg border px-2.5 text-ui tabular",
    selected ? "border-on-ink/30 text-on-ink" : "border-border-strong text-fg",
  );
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-labelledby={`cabin-${id}-name`}
      aria-describedby={`cabin-${id}-desc cabin-${id}-air cabin-${id}-cover`}
      tabIndex={tabbable ? 0 : -1}
      data-cabin={id}
      data-selected={selected ? "true" : undefined}
      title={profile.name}
      onClick={() => onChoose(id)}
      onKeyDown={(e) => onKeyDown(e, id)}
      className={cn(
        "group relative flex h-full w-full flex-col gap-3 rounded-2xl p-6 text-left transition-[border-color,transform] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        selected ? "card-ink bg-ink-card text-on-ink" : cn("card hover:border-border-strong motion-safe:hover:-translate-y-0.5", onLightGrey && "bg-subtle"),
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className={cn("block text-[11px] font-medium uppercase leading-4 tracking-[0.08em]", selected ? "text-on-ink/60" : "text-muted")}>
            {CABIN_ROW_LABEL[cabinRow(id)]}
          </span>
          <span
            id={`cabin-${id}-name`}
            className={cn("mt-1 block text-[20px] font-medium leading-7 tracking-[-0.01em] [text-wrap:pretty]", selected ? "text-on-ink" : "text-fg")}
          >
            {name}
          </span>
        </span>
        {/* Radio mark: hollow ring = pick me, filled check = selected. */}
        <span
          aria-hidden
          className={cn(
            "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
            selected ? "border-on-ink bg-on-ink text-ink-card" : "border-border-strong group-hover:border-fg/50",
          )}
        >
          {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
      </span>

      <span id={`cabin-${id}-desc`} className={cn("line-clamp-2 text-prose leading-6", selected ? "text-on-ink/70" : "text-muted")}>
        {profile.name}
      </span>

      <span className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <span id={`cabin-${id}-air`} className="contents">
          <span className={chip}>{air.oxygen ?? "Oxygen not stated"}</span>
          <span className={chip}>{air.pressure ?? "Pressure not stated"}</span>
          {selected && air.psia ? <span className={chip}>{air.psia}</span> : null}
        </span>
        <span id={`cabin-${id}-cover`} className={cn("ml-auto inline-flex items-center gap-2 text-ui", selected ? "text-on-ink/80" : "text-muted")}>
          <CoverageMark status={status} pending={headlinePending} failed={headlineFailed} onInk={selected} />
          {stats ? <NearbyTests n={stats.comparable_observations} onInk={selected} /> : null}
        </span>
      </span>
    </button>
  );
}

/** "241 nearby tests" / "1 nearby test" / "No nearby tests"; the count sits in the small mono numeral style. */
function NearbyTests({ n, onInk }: { n: number; onInk: boolean }) {
  if (n === 0) return <span>No nearby tests</span>;
  return (
    <span>
      <span className={cn("num font-medium", onInk ? "text-on-ink" : "text-fg")}>{n.toLocaleString("en-US")}</span> nearby {n === 1 ? "test" : "tests"}
    </span>
  );
}

/** Status dot with its word read aloud (the column title and the data-coverage attribute carry it visually): black, amber, green. */
function CoverageMark({ status, pending, failed, onInk }: { status: CoverageStatus | null; pending: boolean; failed: boolean; onInk: boolean }) {
  if (status) {
    return (
      <span data-coverage={status} className="inline-flex items-center">
        <span aria-hidden className={cn("size-2.5 rounded-full", status === "none" && onInk ? "bg-on-ink" : STATUS_DOT[status])} />
        <span className="sr-only">{COVERAGE_STATUS_LABEL[status]}</span>
      </span>
    );
  }
  // No status yet: a hollow dot and plain words, never a guessed status.
  return (
    <span data-coverage="unknown" className="inline-flex items-center gap-2">
      <span aria-hidden className={cn("size-2.5 rounded-full border", onInk ? "border-on-ink/60" : "border-muted")} />
      {pending ? "Loading…" : failed ? "Not available" : "Not computed"}
    </span>
  );
}

// ---- Skeleton (no text, no numbers) ------------------------------------------------------------------------

export function PickerSkeleton() {
  return (
    <div aria-hidden className="grid items-start gap-x-6 gap-y-9 xl:grid-cols-3">
      {[3, 2, 2].map((n, col) => (
        <div key={col} className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Skeleton className="h-8 w-40 rounded-full" />
            <Skeleton className="h-8 w-14 rounded-full" />
          </div>
          <div className={CARD_LIST}>
            {Array.from({ length: n }, (_, i) => (
              <Skeleton key={i} className={cn("card !rounded-2xl", CARD_H)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
