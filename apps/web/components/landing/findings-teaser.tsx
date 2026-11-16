"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/lib/api";
import { cn } from "@/lib/cn";
import { FOCUS, Hold } from "./ui";
import { countOrNull, pillarWord, topFindingRows, type TeaserFindingsResponse } from "./findings-teaser-data";

/** Same GET the Findings page sends; it resolves from the snapshot in snapshot mode. */
function useFindingsTeaser() {
  return useQuery({
    queryKey: ["api", "findings", "landing-teaser"],
    queryFn: ({ signal }) => request<TeaserFindingsResponse>("GET", "/api/findings", { signal }),
    retry: false,
    staleTime: Infinity,
  });
}

const STEPS = [
  { href: "/cabins", label: "Pick a cabin" },
  { href: "/explore", label: "See the gaps" },
  { href: "/findings", label: "Read the findings" },
  { href: "/cabins#next", label: "What to test next" },
] as const;

const PILL = cn("inline-flex min-h-11 items-center gap-2 px-4 text-[14px] leading-5", FOCUS);

function DemoPath() {
  return (
    <nav aria-label="Demo path" className="mt-10 md:mt-12">
      <p className="eyebrow text-muted">Demo path</p>
      <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-3">
        {STEPS.map((s, i) => (
          <li key={s.href} className="flex items-center gap-2">
            <Link href={s.href} className={cn("pill-outline hover:bg-fg/5", PILL)}>
              <span className="tabular-nums text-muted">{i + 1}</span>
              {s.label}
            </Link>
            {i < STEPS.length - 1 ? <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * "What the data says": the top 3 ranked materials' headline sentences from GET /api/findings, word for word,
 * plus a link to /findings and the four-step demo path. Hidden entirely when the findings entry is missing.
 */
export function FindingsTeaser() {
  const q = useFindingsTeaser();
  const data = q.data?.data;
  const rows = topFindingRows(data, 3);
  if (q.isError || (data !== undefined && rows.length === 0)) return null;

  const nObs = countOrNull(data?.summary?.n_observations);
  const nGroups = countOrNull(data?.summary?.n_groups);

  return (
    <section aria-labelledby="landing-findings" className="px-4 pb-16 md:px-10 md:pb-24" data-testid="landing-findings">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <h2 id="landing-findings" className="text-[28px] leading-[34px] font-medium tracking-[-0.02em] text-fg md:text-[40px] md:leading-[44px]">
              What the data says
            </h2>
            <p className="mt-3 max-w-[60ch] text-[16px] leading-6 text-muted">
              Materials ranked by the lowest oxygen at which an ISS flame kept burning
              {nObs !== null && nGroups !== null ? `, from ${nObs} ISS test results across ${nGroups} materials` : ""}. Sentences
              are filled in by code, not written by AI.
            </p>
          </div>
          <Link href="/findings" className={cn("pill-ink", PILL, "px-5 text-[16px]")}>
            See all findings
            <ArrowRight className="size-[18px]" aria-hidden="true" />
          </Link>
        </div>

        <ol className="mt-8 grid gap-4 md:mt-10 md:grid-cols-3">
          {rows.length > 0
            ? rows.map((r, i) => {
                const pillar = pillarWord(r.pillar);
                return (
                  <li
                    key={r.groupId}
                    className={cn("flex min-h-[13rem] flex-col gap-4 rounded-[16px] p-6 md:p-7", i === 0 ? "card-ink" : "card")}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-[40px] leading-[44px] font-medium tracking-[-0.02em] tabular-nums text-fg">
                        <span className="sr-only">Rank </span>
                        {r.rank}
                      </p>
                      {pillar ? <span className="eyebrow mt-1 rounded-full border border-border px-2.5 py-1 text-muted">{pillar}</span> : null}
                    </div>
                    <h3 className="text-[20px] leading-7 font-medium text-fg">{r.label}</h3>
                    <p className="text-[16px] leading-6 text-muted">{r.headline}</p>
                  </li>
                );
              })
            : [0, 1, 2].map((k) => (
                <li key={k} className="card min-h-[13rem] rounded-[16px] p-6 md:p-7">
                  {k === 0 ? (
                    <Hold className="h-[10rem] w-full" label="Loading the findings" />
                  ) : (
                    <span aria-hidden="true" className="block h-[10rem] w-full animate-pulse rounded-md bg-fg/10 motion-reduce:animate-none" />
                  )}
                </li>
              ))}
        </ol>
        <p className="mt-5 text-[12px] leading-4 text-muted">ISS tests only. Not endorsed by NASA. Not a certified fire-safety assessment.</p>

        <DemoPath />
      </div>
    </section>
  );
}
