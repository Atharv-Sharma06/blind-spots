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
const GRID = "grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:gap-3";
const GRID_COLS: Record<CabinRow, string> = { now: "lg:grid-cols-5", past: "lg:grid-cols-6" };

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

      <div className="mt-5 space-y-6 md:mt-5 md:space-y-5">
        {targets.isPending ? (
          <PickerSkeleton />
        ) : targets.isError ? (
          <p role="alert" className="rounded-md border border-border bg-surface px-4 py-3 text-prose text-muted">
            The list of cabins could not be loaded. Reload the page to try again.
          </p>
        ) : (
          rows.map(({ row, items }) => (
            <div key={row}>
              <h3 id={`cabins-${row}-h`} className="mb-2.5 text-label font-semibold uppercase tracking-[0.08em] text-muted">
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
        <Link href="/methodology" className="underline underline-offset-2 hover:text-fg">
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

function CabinCard({ profile, selected, tabbable, compact, stats, headlinePending, headlineFailed, onChoose, onKeyDown }: CabinCardProps) {
  const id = profile.profile_id;
  const name = shortCabinName(id, profile.name);
  const air = cabinAir(profile);
  const status: CoverageStatus | null = stats ? coverageStatus(stats) : null;
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
        "group relative flex h-full w-full flex-col gap-2.5 rounded-lg border bg-surface p-3.5 text-left transition-[border-color,box-shadow,background-color] duration-150",
        compact ? "md:p-3" : "md:p-4",
        selected
          ? "border-fg bg-surface shadow-[0_0_0_1px_var(--fg)]"
          : "border-border hover:border-border-strong hover:shadow-[0_1px_0_rgb(23_23_26/0.04),0_6px_16px_-8px_rgb(23_23_26/0.18)]",
      )}
    >
      <span
        id={`cabin-${id}-name`}
        className={cn("block font-semibold tracking-[-0.01em] text-fg [text-wrap:pretty]", compact ? "text-prose leading-5" : "text-[15px] leading-5 md:text-title md:leading-6")}
      >
        {/* Radio mark floats right so the name wraps around it: hollow = pick me, filled check = selected. */}
        <span
          aria-hidden
          className={cn(
            "float-right ml-2 inline-flex size-5 items-center justify-center rounded-full border transition-colors",
            selected ? "border-fg bg-fg text-surface" : "border-border-strong bg-surface group-hover:border-fg/40",
          )}
        >
          {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
        {name}
      </span>

      <span className="mt-auto flex flex-col gap-2">
        <span id={`cabin-${id}-air`} className="text-ui leading-5 text-fg/85 tabular">
          <span className="whitespace-nowrap">{air.oxygen ?? "Oxygen not stated"},</span>{" "}
          <span className="whitespace-nowrap">{air.pressure ?? "Pressure not stated"}</span>
        </span>

        <span id={`cabin-${id}-cover`} className="flex flex-col items-start gap-1">
          <CoverageChip status={status} pending={headlinePending} failed={headlineFailed} />
          <span className="text-label leading-4 text-muted">{stats ? nearbyTests(stats.comparable_observations) : headlinePending ? "\u00a0" : ""}</span>
        </span>
      </span>
    </button>
  );
}

/** "241 nearby tests" / "1 nearby test" / "No nearby tests". */
function nearbyTests(n: number): string {
  if (n === 0) return "No nearby tests";
  return `${n.toLocaleString("en-US")} nearby ${n === 1 ? "test" : "tests"}`;
}

const CHIP_STYLE: Record<CoverageStatus, { cls: string; Icon: typeof CircleCheck }> = {
  // Same plum + eye-off as the "Blind spot" verdict in Step 2, so a card and its answer agree.
  none: { cls: "border-plum-3 bg-plum-1 text-plum-7", Icon: EyeOff },
  barely: { cls: "border-gap/40 bg-gap-tint text-gap-fg", Icon: CircleAlert },
  covered: { cls: "border-accent/30 bg-accent-tint text-accent", Icon: CircleCheck },
};

function CoverageChip({ status, pending, failed }: { status: CoverageStatus | null; pending: boolean; failed: boolean }) {
  const base = "inline-flex min-h-6 max-w-full items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-1 text-label font-semibold leading-4";
  if (status) {
    const { cls, Icon } = CHIP_STYLE[status];
    return (
      <span data-coverage={status} className={cn(base, cls)}>
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {COVERAGE_STATUS_LABEL[status]}
      </span>
    );
  }
  // No status yet: neutral, never a guessed one.
  return (
    <span data-coverage="unknown" className={cn(base, "border-border bg-subtle font-medium text-muted")}>
      <CircleDashed className="size-3.5 shrink-0" aria-hidden />
      {pending ? "Loading…" : failed ? "Not available" : "Not computed"}
    </span>
  );
}

// ---- Skeleton (no text, no numbers) ------------------------------------------------------------------------

export function PickerSkeleton() {
  return (
    <div aria-hidden className="space-y-6 md:space-y-5">
      {ROWS.map((row) => (
        <div key={row}>
          <Skeleton className="mb-2.5 h-3 w-28" />
          <div className={cn(GRID, GRID_COLS[row])}>
            {Array.from({ length: row === "now" ? 5 : 6 }, (_, i) => (
              <Skeleton key={i} className={cn("rounded-lg border border-border bg-surface", row === "now" ? "h-[9.75rem] md:h-[11.875rem]" : "h-[9.75rem] md:h-[10.625rem]")} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
