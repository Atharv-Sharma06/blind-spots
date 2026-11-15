"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Database, ListOrdered, Map as MapIcon, Brain } from "lucide-react";
import type { ApiQuery } from "@/hooks/api";
import type { HeadlineResponse, MethodologyResponse } from "@/lib/types";
import { fmtCount, fmtFixed } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { coverageStatus } from "@/components/home/cabins";
import type { ExtValidation } from "./types";
import { validationCounts } from "./summary";

/** What one step shows in its number slot: a big figure, a caption and an optional muted line. */
interface StepNumber {
  big: string;
  /** Muted suffix after the big figure, e.g. "of 9". */
  of?: string;
  caption: string;
  note?: string;
}

type Slot = { state: "loading" } | { state: "unavailable" } | { state: "ready"; value: StepNumber };

const loading = (q: ApiQuery<unknown>): Slot | null => (q.isPending ? { state: "loading" } : q.isError || !q.data ? { state: "unavailable" } : null);

function gatherSlot(headline: ApiQuery<HeadlineResponse>, methodology: ApiQuery<MethodologyResponse>): Slot {
  const h = headline.data?.data.envelope;
  if (h) {
    const inv = h.investigations.length ? `${h.investigations.join(" and ")} records` : undefined;
    return { state: "ready", value: { big: fmtCount(h.n_steps), caption: `test results (one per airflow step) from ${fmtCount(h.n_experiments)} ISS experiments`, note: inv } };
  }
  // Headline missing: fall back to the training-set size the methodology endpoint reports.
  const n = methodology.data?.data.config?.training_flow_provenance?.n_training;
  if (typeof n === "number") return { state: "ready", value: { big: fmtCount(n), caption: "ISS test results used to train the model" } };
  return loading(headline) ?? { state: "unavailable" };
}

function mapSlot(headline: ApiQuery<HeadlineResponse>): Slot {
  const l = loading(headline);
  if (l) return l;
  const profiles = headline.data?.data.profiles ?? [];
  if (profiles.length === 0) return { state: "unavailable" };
  const status = profiles.map((p) => coverageStatus(p));
  const none = status.filter((s) => s === "none").length;
  const barely = status.filter((s) => s === "barely").length;
  return {
    state: "ready",
    value: {
      big: `${none}`,
      of: `of ${profiles.length}`,
      caption: `${none === 1 ? "cabin has" : "cabins have"} no nearby ISS test results`,
      note: barely > 0 ? `${barely} more ${barely === 1 ? "is" : "are"} barely covered.` : "Nearby is defined just below.",
    },
  };
}

function modelSlot(validation: ApiQuery<ExtValidation>, headline: ApiQuery<HeadlineResponse>): Slot {
  const l = loading(validation);
  if (l) return l;
  const v = validation.data?.data;
  if (!v || v.groups.length === 0) return { state: "unavailable" };
  const c = validationCounts(v);
  const p = headline.data?.data.envelope.pressure_measured_kpa;
  const note = p ? `Recorded ISS pressures lie at ${fmtFixed(p[0], 0)}–${fmtFixed(p[1], 0)} kPa; the rest are assumed. Away from that the model says it does not know.` : undefined;
  return { state: "ready", value: { big: `${c.better}`, of: `of ${c.nGroups}`, caption: "materials with enough tests where the model beats a simple guess on experiments it had not seen", note } };
}

function rankSlot(validation: ApiQuery<ExtValidation>): Slot {
  const l = loading(validation);
  if (l) return l;
  const v = validation.data?.data;
  const s = v ? validationCounts(v).summary : undefined;
  if (!s?.evr_vs_random) return { state: "unavailable" };
  const r = s.evr_vs_random;
  return {
    state: "ready",
    value: { big: `${r.better}`, of: `of ${s.n_scenarios}`, caption: "replays on past experiments where the ranking beat random picking", note: `Tied in ${r.indistinguishable}, worse in ${r.worse}.` },
  };
}

function Figure({ slot }: { slot: Slot }) {
  if (slot.state === "loading") {
    return (
      <div role="status" aria-label="Loading" className="space-y-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    );
  }
  if (slot.state === "unavailable") return <p className="text-[13px] text-muted">This number is unavailable right now.</p>;
  const { big, of, caption, note } = slot.value;
  return (
    <>
      <p className="flex items-baseline gap-1.5 leading-9 text-fg">
        <span className="num text-[30px] font-medium tracking-[-0.02em]">{big}</span>
        {of ? <span className="num text-[16px] text-muted">{of}</span> : null}
      </p>
      <p className="mt-1 text-[13px] leading-5 text-fg">{caption}</p>
      {note ? <p className="mt-1 text-xs leading-[18px] text-muted">{note}</p> : null}
    </>
  );
}

function Step({ n, icon, title, children, slot, last }: { n: number; icon: ReactNode; title: string; children: ReactNode; slot: Slot; last?: boolean }) {
  return (
    <li className="relative flex min-w-0 flex-col rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2.5">
        <span className="num inline-flex size-7 items-center justify-center rounded-full bg-accent text-[13px] font-medium text-white" aria-hidden>
          {n}
        </span>
        <span className="text-muted" aria-hidden>
          {icon}
        </span>
      </div>
      <h3 className="mt-3 text-[16px] font-semibold leading-6 tracking-[-0.01em]">
        <span className="sr-only">Step {n}: </span>
        {title}
      </h3>
      <p className="mt-1.5 mb-4 text-[14px] leading-[22px] text-muted">{children}</p>
      <div className="mt-auto min-h-[7.5rem] border-t border-border pt-3 lg:min-h-[9rem]">
        <Figure slot={slot} />
      </div>
      {last ? null : (
        <span className="absolute -right-[13px] top-[17px] z-10 hidden size-[22px] items-center justify-center rounded-full border border-border bg-bg text-muted lg:flex" aria-hidden>
          <ChevronRight className="size-3.5" />
        </span>
      )}
    </li>
  );
}

/** "One step is 2 percentage points of oxygen, about 10 % in pressure, or 0.5 in the logarithm of airflow." from the API's scales. */
function nearbyStep(methodology: ApiQuery<MethodologyResponse>): string {
  const sc = methodology.data?.data.config?.coverage_scales as { o2?: unknown; flow?: unknown; p?: unknown } | null | undefined;
  if (!sc || typeof sc.o2 !== "number" || typeof sc.flow !== "number" || typeof sc.p !== "number") return "";
  return ` One step is ${fmtFixed(sc.o2, 0)} percentage points of oxygen, about ${fmtFixed(sc.p * 100, 0)} % in pressure, or ${fmtFixed(sc.flow, 1)} in the logarithm of airflow.`;
}

/**
 * "40 more ISS experiments are left out: ..." from the dataset's own exclusion counts (experiments excluded for a reason other
 * than "context only", which marks non-ISS or different-apparatus tests). Empty when the service does not report them.
 */
function leftOutNote(methodology: ApiQuery<MethodologyResponse>): string {
  const tf = methodology.data?.data.config?.training_filter as { exclusions_in_dataset?: { experiments_by_reason?: Record<string, unknown> } } | null | undefined;
  const by = tf?.exclusions_in_dataset?.experiments_by_reason;
  if (!by || typeof by !== "object") return "";
  const n = Object.entries(by)
    .filter(([reason]) => !/context only/i.test(reason))
    .reduce((acc, [, v]) => acc + (typeof v === "number" ? v : 0), 0);
  if (n <= 0) return "";
  return ` ${fmtCount(n)} more ISS ${n === 1 ? "experiment is" : "experiments are"} left out: no flame lit, or the airflow or outcome could not be read reliably.`;
}

/** The 20-second version: four numbered steps, one sentence each, one number from the API each. */
export function FourSteps({ headline, validation, methodology }: { headline: ApiQuery<HeadlineResponse>; validation: ApiQuery<ExtValidation>; methodology: ApiQuery<MethodologyResponse> }) {
  return (
    <section aria-labelledby="steps-h" data-testid="four-steps">
      <h2 id="steps-h" className="sr-only">
        The four steps
      </h2>
      <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Step n={1} icon={<Database className="size-5" />} title="Gather the ISS flame records" slot={gatherSlot(headline, methodology)}>
          NASA burned many materials aboard the ISS. We start from its integrated records of whether each flame kept burning.
        </Step>
        <Step n={2} icon={<MapIcon className="size-5" />} title="Map where they cover each cabin's air" slot={mapSlot(headline)}>
          For each crew cabin we check how close those tests came to its oxygen, pressure and airflow.
        </Step>
        <Step n={3} icon={<Brain className="size-5" />} title="Model flame behaviour" slot={modelSlot(validation, headline)}>
          Machine learning estimates when a flame keeps burning, and says when it does not know.
        </Step>
        <Step n={4} icon={<ListOrdered className="size-5" />} title="Rank the experiment that would teach the most" slot={rankSlot(validation)} last>
          We rank the experiment that would cut the model&apos;s uncertainty about a cabin the most.
        </Step>
      </ol>
      <p id="test-results" className="mt-3 max-w-[78ch] scroll-mt-[calc(var(--header-h)+16px)] text-xs leading-relaxed text-muted">
        <strong className="font-medium text-fg">A test result</strong> is one airflow step of an experiment; an experiment has one or more steps, so results outnumber experiments.
        {methodology.isPending ? (
          <span aria-hidden className="rounded-sm bg-subtle text-transparent motion-safe:animate-pulse">
            {" "}00 more ISS experiments are left out: no flame lit, or the airflow or outcome could not be read reliably.
          </span>
        ) : (
          leftOutNote(methodology)
        )}
      </p>
      <p id="nearby" className="mt-2 max-w-[78ch] scroll-mt-[calc(var(--header-h)+16px)] text-xs leading-relaxed text-muted">
        <strong className="font-medium text-fg">Nearby</strong> means a test result is within one step of the cabin in oxygen, pressure and airflow combined.
        {methodology.isPending ? (
          <span aria-hidden className="rounded-sm bg-subtle text-transparent motion-safe:animate-pulse">
            {" "}One step is 00 percentage points of oxygen, about 00 % in pressure, or 0.0 in the logarithm of airflow.
          </span>
        ) : (
          nearbyStep(methodology)
        )}{" "}
        Every number on this page comes from the analysis outputs (the live service or its precomputed snapshot).
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">
        <Link href="/#cabins" className="inline-flex min-h-10 items-center gap-1.5 rounded-md font-medium text-accent hover:underline">
          See it for a cabin
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <a href="#trust" className="inline-flex min-h-10 items-center rounded-md text-muted hover:text-fg hover:underline">
          Can you trust it?
        </a>
        <a href="#technical" className="inline-flex min-h-10 items-center rounded-md text-muted hover:text-fg hover:underline">
          Technical details
        </a>
      </div>
    </section>
  );
}
