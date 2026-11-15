"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { DisclosureChevron } from "@/components/ui/disclosure";
import { api } from "@/lib/api";
import { queryKeys } from "@/hooks/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApiQuery } from "@/hooks/api";
import type { GroupSummary, MethodologyResponse, SourcesResponse } from "@/lib/types";
import { fmtCount, fmtPair } from "@/lib/format";
import { Bullets, ExtLink, Formula, Mono, P, QueryBoundary, Section, Sub } from "./primitives";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function countMap(v: unknown): [string, number][] {
  if (!isRecord(v)) return [];
  return Object.entries(v)
    .filter((e): e is [string, number] => typeof e[1] === "number")
    .sort((a, b) => b[1] - a[1]);
}

const REASON_TEXT: Record<string, string> = {
  low_confidence: "Unsure transcription (kept in the records, used only in a what-if check)",
  not_ignited: "Never ignited",
  n2_suppression: "Flame put out by nitrogen, not by airflow",
  no_numeric_airflow: "No airflow number for the step",
  no_curated_flow_steps: "No flow steps typed up for the test",
  "context only: different apparatus or test duration": "Context only: different rig or test length",
  "different apparatus and scale: context only": "Context only: different rig and scale",
};

type FlowCounts = { n: number; recorded: number; converted: number; borrowed: number; below: number };

/**
 * D5 flow-provenance sentence, computed from data: from /api/methodology config.training_flow_provenance when the
 * service provides it, otherwise counted from GET /api/observations (fetched only when this paragraph scrolls into view).
 */
function FlowProvenance({ methodology }: { methodology: ApiQuery<MethodologyResponse> }) {
  const fromConfig = (methodology.data?.data.config as unknown as Record<string, unknown> | undefined)?.training_flow_provenance as
    | { n_training?: number; n_recorded?: number; n_converted_bass2_calibration?: number; n_borrowed_calibration?: number; n_below_calibration_range?: number }
    | undefined;
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  const obs = useQuery({
    queryKey: queryKeys.observations(null),
    queryFn: ({ signal }) => api.observations(null, signal),
    enabled: near && !fromConfig && !methodology.isPending,
    staleTime: Infinity,
  });
  let c: FlowCounts | null = null;
  if (fromConfig && typeof fromConfig.n_training === "number") {
    c = { n: fromConfig.n_training, recorded: fromConfig.n_recorded ?? 0, converted: fromConfig.n_converted_bass2_calibration ?? 0, borrowed: fromConfig.n_borrowed_calibration ?? 0, below: fromConfig.n_below_calibration_range ?? 0 };
  } else if (obs.data) {
    const rows = obs.data.data.filter((o) => o.included_in_training && o.label !== null);
    c = {
      n: rows.length,
      recorded: rows.filter((o) => o.airflow_basis === "air_display" || o.airflow_basis === "stated_cm_s").length,
      converted: rows.filter((o) => (o.airflow_basis === "fan_calibration" || o.airflow_basis === "pot_calibration") && !o.quality_flags.includes("calibration_borrowed_from_bass2")).length,
      borrowed: rows.filter((o) => o.quality_flags.includes("calibration_borrowed_from_bass2")).length,
      below: rows.filter((o) => o.quality_flags.includes("below_calibration_range")).length,
    };
  }
  return (
    <p ref={ref} className="max-w-[72ch] text-[14px] leading-relaxed text-fg" data-testid="flow-provenance">
      {c ? (
        <>
          <strong>Where the airflow numbers come from.</strong> <span className="num">{fmtCount(c.recorded)}</span> of <span className="num">{fmtCount(c.n)}</span> steps used a recorded airflow.{" "}
          <span className="num">{fmtCount(c.converted)}</span> were converted from fan or pot settings; {c.borrowed === 0 ? "none use" : <><span className="num">{fmtCount(c.borrowed)}</span> use</>} a borrowed calibration.
          {c.below ? <> <span className="num">{fmtCount(c.below)}</span> fall below the calibrated range and are estimated (flagged).</> : null}
        </>
      ) : obs.isError ? (
        <span className="text-muted">Airflow source counts are unavailable.</span>
      ) : (
        <span className="text-muted">Counting…</span>
      )}
    </p>
  );
}

function ReasonTable({ caption, rows }: { caption: string; rows: [string, number][] }) {
  if (rows.length === 0) return <P className="text-muted">No counts reported.</P>;
  return (
    <Table containerClassName="rounded-[var(--radius-lg)] border-border/70">
      <caption className="sr-only">{caption}</caption>
      <TableHeader>
        <TableRow>
          <TableHead>{caption}</TableHead>
          <TableHead numeric>Count</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(([reason, n]) => (
          <TableRow key={reason}>
            <TableCell className="h-auto py-1.5">{REASON_TEXT[reason] ?? <span className="num text-xs">{reason}</span>}</TableCell>
            <TableCell numeric>{fmtCount(n)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Collapsed block with a plain summary line (>= 40 px tap target). */
function More({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="card group/disclosure max-w-[78ch] rounded-[var(--radius-xl)] bg-surface px-4 sm:px-5">
      <summary data-disclosure="" className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--radius-sm)] text-[14px] font-medium text-fg hover:text-accent focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-subtle">
          <DisclosureChevron />
        </span>
      </summary>
      <div className="space-y-3 pb-4 pt-1">{children}</div>
    </details>
  );
}

function pressureText(r: readonly [number, number] | null | undefined): string {
  if (!r) return "—";
  const a = r[0].toFixed(1);
  const b = r[1].toFixed(1);
  return a === b ? a : fmtPair(r, "", 1);
}

/** measured / assumed (not recorded) / partly assumed, from pressure_measured and the observed range. */
function pressureBasis(g: GroupSummary) {
  if (g.pressure_measured) return <Badge tone="neutral">measured</Badge>;
  const r = g.pressure_kpa_range;
  const same = r ? r[0].toFixed(1) === r[1].toFixed(1) : false;
  return <span className="text-[13px] text-muted">{same ? "assumed" : "partly assumed"}</span>;
}

export function DataSection({ methodology, sources, groups }: { methodology: ApiQuery<MethodologyResponse>; sources: ApiQuery<SourcesResponse>; groups: ApiQuery<GroupSummary[]> }) {
  return (
    <Section id="data" number={1} title="Data" intro="Where the data comes from, what we kept, and what is missing.">
      <Sub title="Where it comes from">
        <P>The model learns only from two NASA flame-test studies (public data, CC0). Other records are context only (section 6).</P>
        <QueryBoundary query={sources} rows={3}>
          {(s) => {
            const model = s.investigations.filter((i) => i.role === "integrated_model");
            if (model.length === 0) return <P className="text-muted">No studies are used for the model.</P>;
            return (
              <Table containerClassName="rounded-[var(--radius-lg)] border-border/70">
                <caption className="sr-only">NASA studies used by the model</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Study</TableHead>
                    <TableHead numeric>Experiments</TableHead>
                    <TableHead numeric>Test results</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.map((i) => (
                    <TableRow key={i.investigation_id}>
                      <TableCell className="h-auto py-2">
                        <ExtLink href={i.landing_url}>{i.acronym}</ExtLink>
                        <div className="max-w-[40ch] text-xs text-muted">{i.title}</div>
                      </TableCell>
                      <TableCell numeric>{fmtCount(i.n_experiments)}</TableCell>
                      <TableCell numeric>{fmtCount(i.n_observations)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            );
          }}
        </QueryBoundary>
      </Sub>

      <Sub title="What counts as a test result">
        <P>One result is one airflow step of one test: the flame kept burning or went out at that airflow and oxygen level.</P>
        <Bullets>
          <li>Flame sustained: kept burning.</li>
          <li>Flame died at low flow, by blow-off or at steady flow: went out.</li>
          <li>A brief flame that did not spread: went out. Flame that died only because the flow was switched off is flagged (not a true limit).</li>
          <li>Never ignited, or put out by nitrogen: left out.</li>
        </Bullets>
        <P>
          Each material and flame setup is analysed on its own, because material, shape and airflow change flammability. A setup is modelled only with at least 6 experiments, 3 that kept burning and 3 that went out (in at least 2 experiments).
          Otherwise we show coverage but no prediction.
        </P>
        <More summary="Exact rule and checking method">
          <P>Steps of one test are related, so every check holds out whole experiments.</P>
          <QueryBoundary query={methodology} rows={2}>
            {(m) => {
              const tf = isRecord(m.config.training_filter) ? m.config.training_filter : {};
              const conf = Array.isArray(tf.confidence_included) ? (tf.confidence_included as unknown[]).map(String) : [];
              return (
                <P>
                  Training filter: {typeof tf.rule === "string" ? <Mono>{tf.rule}</Mono> : "not reported"}
                  {conf.length ? (
                    <>
                      , transcription confidence <Mono>{conf.join(", ")}</Mono>
                    </>
                  ) : null}
                  . {typeof tf.excluded_by_default === "string" ? <>Left out by default: {tf.excluded_by_default}.</> : null}
                </P>
              );
            }}
          </QueryBoundary>
        </More>
      </Sub>

      <Sub title="What we left out">
        <P className="text-muted">Left-out rows stay in the records with their reason. Nothing is deleted.</P>
        <More summary="Counts and reasons">
          <QueryBoundary query={methodology} rows={3}>
            {(m) => {
              const tf = isRecord(m.config.training_filter) ? m.config.training_filter : {};
              const ex = isRecord(tf.exclusions_in_dataset) ? tf.exclusions_in_dataset : null;
              if (!ex) return <P className="text-muted">The service did not report these counts, so none are shown.</P>;
              return (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <ReasonTable caption="Test results left out" rows={countMap(ex.observations_by_reason)} />
                  <ReasonTable caption="Experiments left out" rows={countMap(ex.experiments_by_reason)} />
                </div>
              );
            }}
          </QueryBoundary>
        </More>
      </Sub>

      <Sub title="How text and units become numbers">
        <P>
          Most fields are read straight from NASA files. Flow schedules and outcomes written as free text were typed up by hand, twice, and settled. A check then confirms every quoted text is an exact copy of the NASA cell; rows that fail are left
          out of the model.
        </P>
        <FlowProvenance methodology={methodology} />
        <More summary="Technical details">
          <Formula label="Unit conversions">{`pressure_kpa = pressure_atm x 101.325
oxygen_percent = oxygen_fraction x 100
airflow_cm_s = 1.0066 x AIR        (duct "Air display" reading, per the BASS-II calibration note)`}</Formula>
          <Bullets>
            <li>Fan and pot settings are converted to cm/s from the BASS-II fan-calibration table (same restrictor count, same day if possible). A direct air-display reading is used instead when the test has one.</li>
            <li>
              Below the lowest calibrated point, flow is interpolated toward the fan-off point. This is an assumption (the NASA sheet notes the fan stops at a finite voltage). These steps are flagged, carry extra uncertainty, and are the least
              certain airflow numbers we have. A what-if check drops them (section 4).
            </li>
            <li>BASS has no fan calibration in these files. Stated cm/s values are used; BASS fan or pot settings are flagged low confidence and kept out of the model.</li>
            <li>Oxygen is interpolated between its start and end values across a test (flagged). A what-if check uses the start value only.</li>
            <li>Every typed-up value is marked as hand-transcribed and keeps its confidence level and source cell.</li>
          </Bullets>
        </More>
      </Sub>

      <Sub title="What is missing">
        <P>
          Missing values stay missing. BASS-II tests did not record pressure. We store a documented ISS cabin value separately as an assumption, flagged, and use it only to place points on the map and in coverage. BASS tests record their own
          pressure.
        </P>
        <P>
          <strong>Pressure never varies in our data.</strong> Every test result is at about 1 atm (sea-level pressure), so no pressure effect can be learned. Anything said about other pressures is an assumption (section 2).
        </P>
        <More summary="Pressure source by material setup">
          <QueryBoundary query={groups} rows={3}>
            {(gs) =>
              gs.length === 0 ? (
                <P className="text-muted">None available.</P>
              ) : (
                <Table containerClassName="max-h-[340px] rounded-[var(--radius-lg)] border-border/70">
                  <caption className="sr-only">Pressure source per material and flame setup</caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material and flame setup</TableHead>
                      <TableHead numeric>Pressure (kPa)</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gs.map((g) => (
                      <TableRow key={g.group_id}>
                        <TableCell className="h-auto py-1.5">{g.label}</TableCell>
                        <TableCell numeric>{pressureText(g.pressure_kpa_range)}</TableCell>
                        <TableCell>{pressureBasis(g)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            }
          </QueryBoundary>
        </More>
      </Sub>
    </Section>
  );
}
