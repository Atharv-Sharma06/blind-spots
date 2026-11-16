"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Database, ListOrdered, Map as MapIcon, Brain } from "lucide-react";
import type { ApiQuery } from "@/hooks/api";
import type { HeadlineResponse, MethodologyResponse } from "@/lib/types";
import { fmtCount, fmtFixed } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
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
    return { state: "ready", value: { big: fmtCount(h.n_steps), caption: `test results from ${fmtCount(h.n_experiments)} ISS experiments` } };
  }
  // Headline missing: fall back to the training-set size the methodology endpoint reports.
  const n = methodology.data?.data.config?.training_flow_provenance?.n_training;
  if (typeof n === "number") return { state: "ready", value: { big: fmtCount(n), caption: "ISS test results" } };
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
      caption: `${none === 1 ? "cabin has" : "cabins have"} no nearby ISS tests`,
      note: barely > 0 ? `${barely} more ${barely === 1 ? "is" : "are"} barely covered.` : undefined,
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
  const note = p ? `Measured ISS pressures: ${fmtFixed(p[0], 0)}–${fmtFixed(p[1], 0)} kPa. The rest are assumed.` : undefined;
  return { state: "ready", value: { big: `${c.better}`, of: `of ${c.nGroups}`, caption: "materials where it beats a simple guess on new experiments", note } };
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
    value: { big: `${r.better}`, of: `of ${s.n_scenarios}`, caption: "past replays where our pick beat a random pick", note: `Tied in ${r.indistinguishable}, worse in ${r.worse}.` },
  };
}

/** Reference C board: white cards, one near-black highlight card ("ink"). */
type Tone = "white" | "ink";

const TONE_CARD: Record<Tone, string> = { white: "card", ink: "card-ink" };
/** Secondary text per tone (AA on each background). */
const TONE_MUTED: Record<Tone, string> = { white: "text-muted", ink: "text-muted" };
const TONE_RULE: Record<Tone, string> = { white: "border-border", ink: "border-border" };
const TONE_CHIP: Record<Tone, string> = { white: "border-border text-muted", ink: "border-border-strong text-muted" };

function Figure({ slot, tone }: { slot: Slot; tone: Tone }) {
  const muted = TONE_MUTED[tone];
  if (slot.state === "loading") {
    return (
      <div role="status" aria-label="Loading" className="space-y-2">
        <Skeleton className={"h-11 w-24 bg-fg/10"} />
        <Skeleton className={"h-4 w-full bg-fg/10"} />
        <Skeleton className={"h-4 w-4/5 bg-fg/10"} />
      </div>
    );
  }
  if (slot.state === "unavailable") return <p className={cn("text-[14px]", muted)}>This number is unavailable right now.</p>;
  const { big, of, caption, note } = slot.value;
  return (
    <>
      <p className="flex items-baseline gap-2">
        <span className="text-[40px] font-medium leading-[44px] tracking-[-0.02em] tabular-nums">{big}</span>
        {of ? <span className={cn("text-[16px]", muted)}>{of}</span> : null}
      </p>
      <p className="mt-2 text-[16px] leading-6">{caption}</p>
      {note ? <p className={cn("mt-1 text-[14px] leading-5", muted)}>{note}</p> : null}
    </>
  );
}

function Step({ n, icon, title, children, slot, tone }: { n: number; icon: ReactNode; title: string; children: ReactNode; slot: Slot; tone: Tone }) {
  return (
    <li className={cn("relative flex min-w-0 flex-col p-6 sm:p-7", TONE_CARD[tone])}>
      <div className="flex items-center justify-between gap-2.5">
        <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[13px]", TONE_CHIP[tone])} aria-hidden>
          {icon}
          <span>Step {n}</span>
        </span>
      </div>
      <h3 className="mt-6 text-[20px] font-medium leading-7 tracking-[-0.01em]">
        <span className="sr-only">Step {n}: </span>
        {title}
      </h3>
      <p className={cn("mt-2 mb-7 text-[16px] leading-6", TONE_MUTED[tone])}>{children}</p>
      <div className={cn("mt-auto border-t pt-5 sm:min-h-[200px]", TONE_RULE[tone])}>
        <Figure slot={slot} tone={tone} />
      </div>
    </li>
  );
}

/** "One step: 2 points of oxygen, about 10 % in pressure, or 0.5 in log airflow." from the API's scales. */
function nearbyStep(methodology: ApiQuery<MethodologyResponse>): string {
  const sc = methodology.data?.data.config?.coverage_scales as { o2?: unknown; flow?: unknown; p?: unknown } | null | undefined;
  if (!sc || typeof sc.o2 !== "number" || typeof sc.flow !== "number" || typeof sc.p !== "number") return "";
  return ` One step: ${fmtFixed(sc.o2, 0)} points of oxygen, about ${fmtFixed(sc.p * 100, 0)}\u00a0% in pressure, or ${fmtFixed(sc.flow, 1)} in log airflow.`;
}

/**
 * "40 more experiments are left out: ..." from the dataset's own exclusion counts (experiments excluded for a reason other
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
  return ` ${fmtCount(n)} more ${n === 1 ? "experiment is" : "experiments are"} left out: no flame lit, or unclear airflow or outcome.`;
}

/** Four numbered steps: one short sentence and one number from the API each. */
export function FourSteps({ headline, validation, methodology }: { headline: ApiQuery<HeadlineResponse>; validation: ApiQuery<ExtValidation>; methodology: ApiQuery<MethodologyResponse> }) {
  return (
    <section aria-labelledby="steps-h" data-testid="four-steps">
      <h2 id="steps-h" className="sr-only">
        The four steps
      </h2>
      <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Step n={1} icon={<Database className="size-4" />} title="Collect ISS tests" slot={gatherSlot(headline, methodology)} tone="white">
          NASA burned materials aboard the ISS.
        </Step>
        <Step n={2} icon={<MapIcon className="size-4" />} title="Check each cabin" slot={mapSlot(headline)} tone="white">
          Did those tests match the cabin&apos;s air?
        </Step>
        <Step n={3} icon={<Brain className="size-4" />} title="Train the model" slot={modelSlot(validation, headline)} tone="white">
          It learns when flames burn, and says when it does not know.
        </Step>
        <Step n={4} icon={<ListOrdered className="size-4" />} title="Pick the next test" slot={rankSlot(validation)} tone="ink">
          We rank the test that would teach the model most.
        </Step>
      </ol>
      <p id="test-results" className="mt-5 max-w-[78ch] scroll-mt-[calc(var(--header-h)+16px)] text-[14px] leading-relaxed text-muted">
        <strong className="font-medium text-fg">A test result</strong> is one airflow step of an experiment.
        {methodology.isPending ? (
          <span aria-hidden className="rounded-sm bg-fg/10 text-transparent motion-safe:animate-pulse">
            {" "}00 more experiments are left out: no flame lit, or unclear airflow or outcome.
          </span>
        ) : (
          leftOutNote(methodology)
        )}
      </p>
      <p id="nearby" className="mt-2 max-w-[78ch] scroll-mt-[calc(var(--header-h)+16px)] text-[14px] leading-relaxed text-muted">
        <strong className="font-medium text-fg">Nearby</strong> means within one step in oxygen, pressure and airflow combined.
        {methodology.isPending ? (
          <span aria-hidden className="rounded-sm bg-fg/10 text-transparent motion-safe:animate-pulse">
            {" "}One step: 00 points of oxygen, about 00&nbsp;% in pressure, or 0.0 in log airflow.
          </span>
        ) : (
          nearbyStep(methodology)
        )}{" "}
        All numbers come from the analysis outputs.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href="/cabins#cabins" className="pill-ink inline-flex min-h-[52px] items-center gap-2 px-6 text-[16px] font-medium">
          See it for a cabin
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <a href="#technical" className="pill-outline inline-flex min-h-11 items-center px-5 text-[14px] font-medium hover:bg-surface">
          Technical details
        </a>
      </div>
    </section>
  );
}
