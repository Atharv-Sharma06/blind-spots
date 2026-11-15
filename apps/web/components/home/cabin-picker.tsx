"use client";

import * as React from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, CircleDashed, EyeOff, Check } from "lucide-react";
import { useHeadline, useTargets } from "@/hooks/api";
import type { AtmosphereProfile, HeadlineProfile } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CABIN_ROW_LABEL,
  COVERAGE_STATUS_LABEL,
  DEFAULT_CABIN,
  cabinOrderIndex,
  cabinRow,
  coverageStatus,
  shortCabinName,
  type CabinRow,
  type CoverageStatus,
} from "./cabins";
import { cabinAir } from "./cabin-air";
import { StepHeading } from "./step-heading";

export interface CabinPickerProps {
  cabin: string;
  onSelect: (id: string) => void;
}

const ROWS: CabinRow[] = ["now", "past"];
const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4";
const GRID_COLS: Record<CabinRow, string> = { now: "lg:grid-cols-5", past: "lg:grid-cols-6 lg:gap-3" };
/** Skeleton card heights, measured from the loaded cards so the grid does not jump. */
const NOW_H = "h-[11rem] md:h-[11.25rem] lg:h-[12.5rem]";
const PAST_H = "h-[11rem] md:h-[9.25rem] lg:h-[12.75rem]";

/** Step 1: one card per crew cabin. Radio-group semantics, arrow keys, selection lives in the URL. */
export function CabinPicker({ cabin, onSelect }: CabinPickerProps) {
  const targets = useTargets();
  const headline = useHeadline();

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

  const rows = React.useMemo(
    () => ROWS.map((row) => ({ row, items: profiles.filter((p) => cabinRow(p.profile_id) === row) })).filter((r) => r.items.length > 0),
    [profiles],
  );

  // An unknown ?cabin= (typo, envelope) falls back to the default instead of leaving nothing selected.
  const known = profiles.some((p) => p.profile_id === cabin);
  React.useEffect(() => {
    if (profiles.length > 0 && !known) {
      const fallback = profiles.some((p) => p.profile_id === DEFAULT_CABIN) ? DEFAULT_CABIN : profiles[0]!.profile_id;
      onSelect(fallback);
    }
  }, [profiles, known, onSelect]);

  const order = profiles.map((p) => p.profile_id);
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

      <div className="mt-6 space-y-7 md:mt-7 md:space-y-7">
        {targets.isPending ? (
          <PickerSkeleton />
        ) : targets.isError ? (
          <p role="alert" className="card px-5 py-4 text-prose text-muted">
            The list of cabins could not be loaded. Reload the page to try again.
          </p>
        ) : (
          rows.map(({ row, items }) => (
            <div key={row}>
              <h3 id={`cabins-${row}-h`} className="mb-3 pl-1 text-label font-medium uppercase tracking-[0.14em] text-muted">
                {CABIN_ROW_LABEL[row]}
              </h3>
              <div role="radiogroup" aria-labelledby={`cabins-${row}-h`} className={cn(GRID, GRID_COLS[row])}>
                {items.map((p) => (
                  <CabinCard
                    key={p.profile_id}
                    profile={p}
                    selected={p.profile_id === cabin && known}
                    tabbable={p.profile_id === tabbable}
                    compact={row === "past"}
                    stats={headlineById.get(p.profile_id)}
                    headlinePending={headline.isPending}
                    headlineFailed={headline.isError}
                    onChoose={(id) => choose(id, "pointer")}
                    onKeyDown={onKeyDown}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <p className="mt-4 text-label leading-5 text-muted">
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
  compact: boolean;
  stats: HeadlineProfile | undefined;
  headlinePending: boolean;
  headlineFailed: boolean;
  onChoose: (id: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>, id: string) => void;
}

/**
 * The selected card is unmistakable and carries its status hue: a magenta gradient when not covered, a deep indigo
 * card with a periwinkle glow when covered, a yellow glow ring when barely covered (white ring while status loads).
 */
const SELECTED_SKIN: Record<CoverageStatus | "unknown", string> = {
  // The black scrim (behind the text, above the gradient) keeps white text at AA contrast on the light corner.
  none: "card-magenta text-white shadow-[0_0_0_1.5px_rgb(235_178_245/0.7),0_18px_44px_-14px_rgb(165_75_196/0.75)] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-black/30 before:content-['']",
  covered: "card-indigo text-white shadow-[0_0_0_1.5px_rgb(154_164_255/0.75),inset_0_0_48px_rgb(140_135_255/0.35),0_18px_44px_-14px_rgb(92_89_196/0.8)]",
  barely: "card shadow-[0_0_0_2px_var(--accent),0_0_28px_rgb(242_210_27/0.35)]",
  unknown: "card shadow-[0_0_0_2px_var(--fg)]",
};

function CabinCard({ profile, selected, tabbable, compact, stats, headlinePending, headlineFailed, onChoose, onKeyDown }: CabinCardProps) {
  const id = profile.profile_id;
  const name = shortCabinName(id, profile.name);
  const air = cabinAir(profile);
  const status: CoverageStatus | null = stats ? coverageStatus(stats) : null;
  // White-on-gradient text for the magenta and indigo selected skins; charcoal cards keep the muted grey.
  const onGradient = selected && (status === "none" || status === "covered");
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-labelledby={`cabin-${id}-name`}
      aria-describedby={`cabin-${id}-air cabin-${id}-cover`}
      tabIndex={tabbable ? 0 : -1}
      data-cabin={id}
      data-selected={selected ? "true" : undefined}
      title={profile.name}
      onClick={() => onChoose(id)}
      onKeyDown={(e) => onKeyDown(e, id)}
      className={cn(
        "group relative isolate flex h-full w-full flex-col gap-3 overflow-hidden !rounded-[26px] p-3.5 text-left min-[360px]:p-4 transition-[box-shadow,filter,transform] duration-200 md:!rounded-[30px]",
        compact ? "md:p-4" : "md:p-5",
        selected
          ? SELECTED_SKIN[status ?? "unknown"]
          : "card hover:brightness-125 motion-safe:hover:-translate-y-0.5",
      )}
    >
      <span
        id={`cabin-${id}-name`}
        className={cn(
          "block font-medium tracking-[-0.01em] [text-wrap:pretty]",
          onGradient ? "text-white" : "text-fg",
          compact ? "text-prose leading-5" : "text-[15px] leading-5 md:text-title md:leading-6",
        )}
      >
        {/* Radio mark floats right so the name wraps around it: hollow ring = pick me, filled check = selected. */}
        <span
          aria-hidden
          className={cn(
            "float-right ml-2 inline-flex size-6 items-center justify-center rounded-full border transition-colors",
            selected
              ? "border-white bg-white text-[#0B0B0C]"
              : "border-border-strong bg-black/30 group-hover:border-fg/50",
          )}
        >
          {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
        {name}
      </span>

      <span className="mt-auto flex flex-col gap-2.5">
        <span id={`cabin-${id}-air`} className={cn("text-ui leading-5 tabular", onGradient ? "text-white" : "text-fg/80")}>
          <span className="whitespace-nowrap">{air.oxygen ?? "Oxygen not stated"},</span>{" "}
          <span className="whitespace-nowrap">{air.pressure ?? "Pressure not stated"}</span>
        </span>

        <span id={`cabin-${id}-cover`} className="flex flex-col items-start gap-1.5">
          <CoverageChip status={status} pending={headlinePending} failed={headlineFailed} />
          <span className={cn("text-label leading-4", onGradient ? "text-white/90" : "text-muted")}>
            {stats ? <NearbyTests n={stats.comparable_observations} strong={onGradient} /> : headlinePending ? "\u00a0" : ""}
          </span>
        </span>
      </span>
    </button>
  );
}

/** "241 nearby tests" / "1 nearby test" / "No nearby tests"; the count sits in the small mono numeral style. */
function NearbyTests({ n, strong }: { n: number; strong: boolean }) {
  if (n === 0) return <>No nearby tests</>;
  return (
    <>
      <span className={cn("num font-medium", strong ? "text-white" : "text-fg")}>{n.toLocaleString("en-US")}</span> nearby {n === 1 ? "test" : "tests"}
    </>
  );
}

const CHIP_STYLE: Record<CoverageStatus, { cls: string; Icon: typeof CircleCheck }> = {
  // Same plum + eye-off as the "Blind spot" verdict in Step 2, so a card and its answer agree.
  // One hue per meaning (STYLE.md): not covered = magenta, barely = yellow, covered = periwinkle.
  none: { cls: "border-plum-4/70 bg-plum-2 text-plum-7", Icon: EyeOff },
  barely: { cls: "border-accent/35 bg-accent-tint text-accent", Icon: CircleAlert },
  covered: { cls: "border-[#9AA4FF]/35 bg-observed-tint text-[#9AA4FF]", Icon: CircleCheck },
};

function CoverageChip({ status, pending, failed }: { status: CoverageStatus | null; pending: boolean; failed: boolean }) {
  const base = "inline-flex min-h-7 max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold leading-4 min-[360px]:text-label";
  if (status) {
    const { cls, Icon } = CHIP_STYLE[status];
    return (
      <span data-coverage={status} className={cn(base, cls)}>
        <Icon className="hidden size-3.5 shrink-0 min-[360px]:block" aria-hidden />
        {COVERAGE_STATUS_LABEL[status]}
      </span>
    );
  }
  // No status yet: neutral, never a guessed one.
  return (
    <span data-coverage="unknown" className={cn(base, "border-border-strong bg-subtle font-medium text-muted")}>
      <CircleDashed className="hidden size-3.5 shrink-0 min-[360px]:block" aria-hidden />
      {pending ? "Loading…" : failed ? "Not available" : "Not computed"}
    </span>
  );
}

// ---- Skeleton (no text, no numbers) ------------------------------------------------------------------------

export function PickerSkeleton() {
  return (
    <div aria-hidden className="space-y-7 md:space-y-7">
      {ROWS.map((row) => (
        <div key={row}>
          <Skeleton className="mb-3 ml-1 h-4 w-28 rounded-full" />
          <div className={cn(GRID, GRID_COLS[row])}>
            {Array.from({ length: row === "now" ? 5 : 6 }, (_, i) => (
              <Skeleton key={i} className={cn("card !rounded-[26px] md:!rounded-[30px]", row === "now" ? NOW_H : PAST_H)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
