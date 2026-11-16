"use client";

import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { AskCabinAir } from "@/components/ask/ask-cabin-air";
import { FindingsExplain } from "@/components/explain/findings-explain";
import { ProvenanceTag } from "@/components/ui/provenance-tag";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ErrorState } from "@/components/ui/error-state";
import { PageContainer } from "@/components/layout/page-container";
import { TableSkeleton } from "@/components/data-page-state";
import { isApiError, unavailableCopy } from "@/lib/api";
import { cn } from "@/lib/cn";
import { CabinRanking } from "./cabin-ranking";
import { FindingCard, sig3 } from "./finding-card";
import {
  filterByPillar,
  sortMaterials,
  type PillarFilter,
  type SortKey,
} from "./types";
import { useFindings, useTargets } from "./use-findings";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const PILLARS: { value: Exclude<PillarFilter, "all">; label: string }[] = [
  { value: "prevention", label: "Prevention" },
  { value: "suppression", label: "Suppression" },
  { value: "detection", label: "Detection" },
];

const SORTS = [
  {
    value: "rank",
    label: (
      <>
        <span className="sm:hidden">Lowest oxygen</span>
        <span className="max-sm:hidden">Lowest oxygen that burned</span>
      </>
    ),
  },
  { value: "tests", label: "Most tests" },
  { value: "abstains", label: "Model abstains" },
];

/** NASA pages checked with curl on 2026-11-15 (HTTP 200, page about that event). */
const APOLLO_1_URL = "https://www.nasa.gov/mission/apollo-1/";
const MIR_FIRE_URL =
  "https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/";

function Big({ value, caption }: { value: number; caption: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[30px] font-medium leading-none tabular-nums text-fg sm:text-[40px]">
        {value}
      </span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ui text-muted">
        {caption} <ProvenanceTag kind="measured" />
      </span>
    </div>
  );
}

function ExtLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-sm font-medium text-fg underline underline-offset-4",
        FOCUS,
      )}
    >
      {children}
      <ArrowUpRight aria-hidden className="size-3.5" />
      <span className="sr-only"> (opens nasa.gov in a new tab)</span>
    </a>
  );
}

export function FindingsView() {
  const findings = useFindings();
  const targets = useTargets();
  const [pillar, setPillar] = React.useState<PillarFilter>("all");
  const [sort, setSort] = React.useState<SortKey>("rank");

  const apollo = targets.data?.profiles.find(
    (p) => p.profile_id === "apollo_cm",
  );
  const apolloO2 = apollo?.oxygen_percent.nominal ?? null;
  const apolloKpa = apollo?.total_pressure_kpa.nominal ?? null;

  if (findings.isPending)
    return (
      <PageContainer>
        <TableSkeleton />
      </PageContainer>
    );
  if (findings.isError) {
    const e = findings.error;
    const snapshotCopy =
      isApiError(e) && e.reason !== "service_unreachable"
        ? unavailableCopy(e)
        : null;
    const liveMissing =
      isApiError(e) &&
      (e.code === "not_found" || e.code === "backend_unavailable");
    return (
      <PageContainer>
        <ErrorState
          code={isApiError(e) ? e.code : "internal"}
          error={e}
          title={
            snapshotCopy?.title ??
            (liveMissing
              ? "Findings require the live analysis service"
              : undefined)
          }
          description={
            snapshotCopy?.description ??
            (liveMissing
              ? "The analysis service did not return findings, so none are shown here. The precomputed version of this site includes them."
              : undefined)
          }
          onRetry={() => void findings.refetch()}
        />
      </PageContainer>
    );
  }

  const d = findings.data;
  const s = d.summary;
  const list = sortMaterials(filterByPillar(d.materials, pillar), sort);

  return (
    <PageContainer className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8">
        <header className="band rounded-[24px] p-5 sm:p-8">
          <p className="eyebrow text-muted">Findings</p>
          <h1 className="mt-2 text-[32px] font-medium leading-[1.1] tracking-[-0.02em] text-fg sm:text-[44px]">
            What the ISS fire tests show
          </h1>
          <p className="mt-3 max-w-[62ch] text-prose text-muted">
            Ranked by code from {s.n_observations} ISS test results across{" "}
            {s.n_groups} materials. The findings are written by code; the optional SI explanation is labelled as SI-generated.
          </p>
          <div
            className="mt-6 grid grid-cols-3 gap-4 sm:gap-6"
            data-testid="findings-numbers"
          >
            <Big value={s.n_observations} caption="ISS test results" />
            <Big value={s.n_sustained} caption="kept burning" />
            <Big value={s.n_not_sustained} caption="went out" />
          </div>
        </header>

        <FindingsExplain data={d} className="-mt-4" />

        <AskCabinAir id="ask" />

        <section aria-labelledby="ranked" className="flex flex-col gap-4">
          <div>
            <h2 id="ranked" className="text-heading font-medium text-fg">
              Materials, ranked
            </h2>
            <p className="mt-1 max-w-[70ch] text-ui text-muted">
              {d.ranking_rule}
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div
              role="group"
              aria-label="Filter by fire-safety pillar"
              className="flex flex-wrap gap-2"
            >
              {PILLARS.map((p) => {
                const on = pillar === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    aria-pressed={on}
                    data-testid={`pillar-${p.value}`}
                    onClick={() => setPillar(on ? "all" : p.value)}
                    className={cn(
                      "inline-flex min-h-10 items-center rounded-full border px-4 text-ui font-medium transition-colors",
                      on
                        ? "border-fg bg-fg text-bg"
                        : "border-border bg-surface text-fg hover:border-border-strong",
                      FOCUS,
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="max-w-full overflow-x-auto">
              <SegmentedControl
                aria-label="Sort materials"
                size="sm"
                options={SORTS}
                value={sort}
                onValueChange={(v) => setSort(v as SortKey)}
              />
            </div>
          </div>
          <p className="text-ui text-muted">{d.pillar_rule}</p>

          {pillar === "detection" ? (
            <div
              className="card flex flex-col items-start gap-3 p-5 sm:p-7"
              data-testid="detection-note"
            >
              <p className="text-title text-fg">
                Detection: not represented in the integrated records
              </p>
              <p className="text-prose text-muted">
                The integrated ISS test records hold no fire-detection
                measurements, so no finding is tagged detection.
              </p>
              <button
                type="button"
                onClick={() => setPillar("all")}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full border border-border px-4 text-ui font-medium text-fg",
                  FOCUS,
                )}
              >
                Show all materials
              </button>
            </div>
          ) : list.length === 0 ? (
            <p className="card p-5 text-prose text-muted">
              No material has a finding in this group.
            </p>
          ) : (
            <ol
              className="grid grid-cols-1 gap-4 xl:grid-cols-2"
              data-testid="findings-list"
            >
              {list.map((m) => (
                <FindingCard key={m.group_id} m={m} pillar={pillar} />
              ))}
            </ol>
          )}
        </section>

        <CabinRanking cabins={d.cabins} profiles={targets.data?.profiles} />

        <section
          aria-label="Fire-safety history"
          className="hairline rounded-[16px] p-5 text-prose text-fg sm:p-6"
        >
          <p>
            Fire has shaped spacecraft cabin air before: the{" "}
            <ExtLink href={APOLLO_1_URL}>Apollo 1 cabin fire (1967)</ExtLink>{" "}
            and the{" "}
            <ExtLink href={MIR_FIRE_URL}>
              fire aboard space station Mir (1997)
            </ExtLink>
            .
            {apolloO2 !== null && apolloKpa !== null ? (
              <>
                {" "}
                Apollo used {sig3(apolloO2)}% oxygen at {sig3(apolloKpa)} kPa in
                flight (documented profile).
              </>
            ) : null}
          </p>
        </section>

        <footer className="flex flex-col gap-1 border-t border-border pt-4 text-ui text-muted">
          <p>
            ISS tests. Not endorsed by NASA. Not a certified fire-safety
            assessment.
          </p>
          {d.notes
            .filter((n) => !/not endorsed by nasa|not a certified/i.test(n))
            .map((n) => (
              <p key={n}>{n}</p>
            ))}
          <p>
            Dataset {d.dataset_version} · model {d.model_version}
          </p>
        </footer>
      </div>
    </PageContainer>
  );
}
