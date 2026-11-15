"use client";

import * as React from "react";
import { ExternalLink, SearchX } from "lucide-react";
import { useExperiment } from "@/hooks/api";
import { MISSING } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiExperiment, ApiObservation, GroupSummary, Investigation } from "@/lib/types";
import { FlameDot, ResultChip } from "./result-chip";
import {
  BASIS_TEXT,
  calibrationText,
  confidenceLabel,
  configurationLabel,
  exclusionText,
  extinctionText,
  flagText,
  flameStateKind,
  flameStateText,
  fmtAirflow,
  fmtPlain,
  groupLabel,
  humanize,
  isContextReason,
  isOutcomeCode,
  materialLabel,
  outcomeLabel,
  oxygenOf,
  plainDefinition,
  pressureOf,
  rawFlowText,
  resultOfExperiment,
  sourceLabel,
  tmPage,
} from "./model";

/** Optional step evidence (requested from the backend; rendered when present). */
type StepEvidence = { evidence_source?: string | null; evidence_page?: string | null; evidence_quote?: string | null };

const TM_ID = "NASA/TM-20210011385";

export function ExperimentDrawer(props: {
  id: string | null;
  /** false when the experiment list is loaded and has no record with this id (any data mode). */
  known?: boolean;
  investigations: Investigation[] | undefined;
  groups: GroupSummary[] | undefined;
  onClose: () => void;
  onCloseAutoFocus?: (ev: Event) => void;
}) {
  const { id, known, investigations, groups, onClose, onCloseAutoFocus } = props;
  const q = useExperiment(known === false ? null : id);
  const exp = q.data?.data.experiment;
  const inv = investigations?.find((i) => i.investigation_id === exp?.investigation_id);
  const notFound = known === false || (q.isError && q.error.code === "not_found");

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        title={exp ? materialLabel(exp.material_family) : notFound ? "Experiment not found" : "Experiment"}
        description={exp ? sourceLabel(exp) : undefined}
        className="inset-y-2 right-2 left-2 w-auto overflow-hidden rounded-2xl border border-white/[0.07] bg-[linear-gradient(160deg,#242428_0%,#18181B_55%,#131315_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_24px_48px_-24px_rgb(0_0_0/0.8)] sm:inset-y-3 sm:right-3 sm:left-auto sm:w-full sm:max-w-[640px]"
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {notFound ? (
          <div data-error-code="not_found">
            <EmptyState
              icon={<SearchX aria-hidden />}
              title="Experiment not found"
              description={
                <>
                  <span className="num text-fg">{id}</span> is not in our data. Check the link, or pick one from the list.
                </>
              }
              action={
                <SheetClose asChild>
                  <Button>Back to the list</Button>
                </SheetClose>
              }
            />
          </div>
        ) : q.isError ? (
          <ErrorState code={q.error.code} error={q.error} message={q.error.message} onRetry={() => void q.refetch()} compact />
        ) : !q.data ? (
          <div className="space-y-2" role="status" aria-label="Loading experiment">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : (
          <Details e={q.data.data.experiment} obs={q.data.data.observations} groups={groups} inv={inv} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-white/[0.06] py-5 first:pt-0 last:border-b-0">
      <h3 className="mb-3 text-prose font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

function Fields({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-ui sm:grid-cols-[9rem_1fr] sm:gap-y-2">
      {items.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="pt-2 text-muted first:pt-0 sm:pt-0">{k}</dt>
          <dd className="min-w-0 break-words">{v ?? MISSING}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function Fact({ label, value, unit, note, className }: { label: string; value: string; unit: string; note?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-3", className)}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5">
        {value === MISSING ? (
          <span className="text-heading text-muted">{MISSING}</span>
        ) : (
          <>
            <span className="num text-heading font-semibold">{value}</span> <span className="text-ui text-muted">{unit}</span>
          </>
        )}
      </p>
      {note ? <p className="mt-0.5 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

function Details({ e, obs, groups, inv }: { e: ApiExperiment; obs: ApiObservation[]; groups: GroupSummary[] | undefined; inv: Investigation | undefined }) {
  const p = pressureOf(e);
  const r = resultOfExperiment(e);
  const doi = e.source_doi ?? inv?.doi ?? null;
  const isPsi = e.investigation_id.startsWith("PSI-");
  const ntrsId = /^NTRS-(\d+)$/.exec(e.investigation_id)?.[1] ?? null;
  const context = isContextReason(e.exclusion_reason);
  const nUsed = obs.filter((o) => o.included_in_training).length;
  const page = tmPage(e.measurement_method);
  const tmNotes = e.quality_flags.includes("notes_from_nasa_tm_20210011385");
  const described = e.observed_outcome && !isOutcomeCode(e.observed_outcome) ? e.observed_outcome : null;

  const training = context
    ? "No."
    : obs.length === 0
      ? e.included_in_training
        ? "Yes."
        : exclusionText(e.exclusion_reason) || "No."
      : nUsed === obs.length
        ? `Yes, all ${obs.length} ${obs.length === 1 ? "step" : "steps"}.`
        : nUsed === 0
          ? `No. ${exclusionText(e.exclusion_reason)}`.trim()
          : `Partly: ${nUsed} of ${obs.length} steps.`;

  // The assumed pressure and the context-only status are already explained in their own boxes above.
  const shownFlags = e.quality_flags.filter((f) => f !== "pressure_assumed" && f !== "context_only" && f !== "context_record");

  const sample: [string, React.ReactNode][] = [
    ["Material", [e.material_type, materialLabel(e.material_family)].filter(Boolean).join(" · ")],
    ["Airflow setup", configurationLabel(e.flame_configuration)],
  ];
  if (e.material_thickness_mm !== null) sample.push(["Thickness", <span key="t" className="num">{fmtPlain(e.material_thickness_mm, 2)} mm</span>]);
  if (e.specimen_diameter_mm !== null) sample.push(["Diameter", <span key="d" className="num">{fmtPlain(e.specimen_diameter_mm, 1)} mm</span>]);
  if (e.test_date) sample.push(["Test date", <span key="td" className="num">{e.test_date}</span>]);

  return (
    <div>
      <Section title="What happened">
        <ResultChip
          kind={r.kind}
          label={r.label}
          detail={r.detail}
          large
        />
        {described ? (
          <blockquote className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.04] p-3.5 text-ui">
            <span className="mb-1 block text-xs text-muted">NASA&apos;s words</span>
            {described}
          </blockquote>
        ) : null}
        {context ? (
          <p className="mt-3 rounded-xl bg-gap-tint px-3.5 py-2.5 text-ui text-gap-fg">Context only: different apparatus or test length, so the model skips it.</p>
        ) : null}
      </Section>

      <Section title="Conditions">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Fact label="Oxygen" value={fmtPlain(oxygenOf(e), 1)} unit="%" note={e.oxygen_percent_final !== null ? <>at the end: <span className="num">{fmtPlain(e.oxygen_percent_final, 1)}</span> %</> : undefined} />
          <Fact label="Pressure" value={fmtPlain(p.kpa, 1)} unit="kPa" note={p.assumed ? "assumed" : undefined} />
          <Fact className="col-span-2 sm:col-span-1" label="Airflow" value={fmtAirflow(e)} unit="cm/s" note={fmtAirflow(e).includes("–") ? "varies by step" : undefined} />
        </div>
        {p.assumed ? (
          <p className="mt-3 rounded-xl bg-gap-tint px-3.5 py-2.5 text-ui text-gap-fg">
            NASA did not record the pressure. We assume the ISS cabin pressure and keep it in its own field.
          </p>
        ) : null}
        {e.flame_configuration && e.flame_configuration !== "unknown" ? <p className="mt-3 text-ui text-muted">Setup: {configurationLabel(e.flame_configuration)}.</p> : null}
      </Section>

      {obs.length === 0 && context ? null : (
        <Section title={`Airflow steps (${obs.length})`}>
          {obs.length === 0 ? (
            <p className="text-ui text-muted">No steps could be read from the source.</p>
          ) : (
            <>
              <ol className="space-y-2">
                {obs.map((o) => (
                  <StepItem key={o.observation_id} o={o} />
                ))}
              </ol>
              <p className="mt-2 text-xs text-muted">Greyed steps are not used by the model.</p>
            </>
          )}
        </Section>
      )}

      <Section title="Used by the model?">
        <p className="text-ui">{training}</p>
      </Section>

      <Section title="Source">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="min-w-0 text-ui">
            <span className="num">{sourceLabel(e)}</span>
          </p>
          <Button asChild className="h-10 rounded-full px-4">
            <a href={e.source_url} target="_blank" rel="noreferrer">
              Open the NASA record <ExternalLink aria-hidden />
            </a>
          </Button>
        </div>
      </Section>

      <div className="pt-4">
        <Disclosure summary="Technical details (raw fields)" tone="strong">
          <Fields
            items={[
              ["Investigation", inv?.title ?? e.investigation_name],
              ["Experiment id", <span key="i" className="num">{e.experiment_id}</span>],
              ["Sample", e.sample_id ? <span className="num">{e.sample_id}</span> : MISSING],
              [isPsi ? "PSI accession" : ntrsId ? "NTRS document" : "Accession", <span key="a" className="num">{ntrsId ?? e.investigation_id}</span>],
              ["Spreadsheet row", e.source_sheet ? <span className="num">{e.source_sheet} · row {e.source_row ?? MISSING}</span> : MISSING],
              [
                "DOI",
                doi ? (
                  <a key="d" className="num inline-flex min-h-10 items-center text-observed underline underline-offset-2" href={`https://doi.org/${doi}`} target="_blank" rel="noreferrer">
                    {doi}
                  </a>
                ) : (
                  MISSING
                ),
              ],
              ...sample,
              ["Apparatus", e.experimental_platform],
              ["Comparison set", e.group_id ? groupLabel(groups, e.group_id) : "None"],
              ["Recorded outcome", outcomeLabel(e.observed_outcome)],
              ["How it was assigned", plainDefinition(e.outcome_definition)],
              ["Measurement method", plainDefinition(e.measurement_method)],
              ["Source file", e.source_file ? <span className="num break-all text-xs">{e.source_file}</span> : MISSING],
              [
                "Extraction",
                `${e.extraction_method === "derived_computation" ? "Computed from the sensor file" : e.extraction_method === "manually_transcribed" ? "Transcribed by hand" : humanize(e.extraction_method)} · confidence ${confidenceLabel(e.extraction_confidence).toLowerCase()}`,
              ],
              ...(e.notes_raw
                ? ([
                    [
                      "NASA's notes",
                      <span key="n" className="block">
                        <span className="block max-h-48 overflow-auto rounded-md border border-border bg-subtle p-2 font-mono text-xs whitespace-pre-wrap">{e.notes_raw}</span>
                        <span className="mt-1 block text-xs text-muted">
                          Verbatim{tmNotes ? `, ${TM_ID} Appendix A${page ? `, p. ${page}` : ""}` : ""}.
                        </span>
                      </span>,
                    ],
                  ] as [string, React.ReactNode][])
                : []),
              ...(shownFlags.length > 0
                ? ([
                    [
                      "Record notes",
                      <ul key="f" className="list-disc space-y-1 pl-4 marker:text-muted">
                        {shownFlags.map((f) => (
                          <li key={f} title={`Flag code: ${f}`}>
                            {flagText(f)}
                          </li>
                        ))}
                      </ul>,
                    ],
                  ] as [string, React.ReactNode][])
                : []),
              ...(obs.length > 0
                ? ([
                    [
                      "Step sources",
                      <ol key="s" className="space-y-2">
                        {obs.map((o) => (
                          <StepSource key={o.observation_id} o={o} testLabel={e.test_label} />
                        ))}
                      </ol>,
                    ],
                  ] as [string, React.ReactNode][])
                : []),
            ]}
          />
        </Disclosure>
      </div>
    </div>
  );
}

function stepWhy(o: ApiObservation): string {
  if (o.exclusion_reason === "low_confidence") return "low confidence in the source";
  return exclusionText(o.exclusion_reason) || "no reason recorded";
}

function StepItem({ o }: { o: ApiObservation }) {
  const used = o.included_in_training;
  return (
    <li
      data-used={used ? "true" : "false"}
      className={used ? "rounded-xl border border-white/[0.06] bg-white/[0.04] p-3.5" : "rounded-xl border border-dashed border-border bg-transparent p-3.5 text-muted"}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-ui font-medium text-fg">Step {o.step_index + 1}</span>
        <span className="inline-flex items-center gap-2 text-ui font-medium">
          <FlameDot kind={flameStateKind(o.flame_state)} />
          {flameStateText(o.flame_state)}
        </span>
      </div>
      <p className="mt-1 text-ui">
        Airflow <span className="num">{fmtPlain(o.airflow_cm_s, 2)}</span> cm/s
        {o.airflow_uncertainty_cm_s !== null ? <span className="text-muted"> (±<span className="num">{fmtPlain(o.airflow_uncertainty_cm_s, 2)}</span>)</span> : null}
        {" · "}Oxygen <span className="num">{fmtPlain(o.oxygen_percent, 1)}</span> %
        {o.extinction_mode ? <span className="text-muted"> · {extinctionText(o.extinction_mode)}</span> : null}
      </p>
      {!used ? <p className="mt-1 text-xs">Not used: {stepWhy(o)}.</p> : null}
    </li>
  );
}

/** Raw provenance of one step (shown inside Technical details): airflow basis, source cell and any evidence quote. */
function StepSource({ o, testLabel }: { o: ApiObservation; testLabel: string }) {
  const ev = o as ApiObservation & StepEvidence;
  const tm = o.raw_column === "TM Appendix A observation";
  const raw = rawFlowText(o.flow_raw_value, o.flow_raw_unit);
  const cal = calibrationText(o.flow_calibration_ref);
  return (
    <li className="text-xs">
      <span className="font-medium text-fg">Step {o.step_index + 1}</span>
      {": "}airflow from {BASIS_TEXT[o.airflow_basis] ?? humanize(o.airflow_basis)}
      {raw ? `; ${raw}` : ""}
      {cal ? `; ${cal}` : ""}. Source cell: <q className="font-mono">{o.raw_token}</q>{" "}
      {tm ? `(${TM_ID} Appendix A, test ${testLabel})` : <span className="num">(row {o.source_row}, column “{o.raw_column}”)</span>}.
      {ev.evidence_quote ? (
        <>
          {" "}
          {TM_ID}
          {ev.evidence_page ? `, p. ${ev.evidence_page}` : ""}: <q className="text-fg">{ev.evidence_quote}</q>
        </>
      ) : o.quality_flags.includes("outcome_evidence_nasa_tm_20210011385") && !tm ? (
        <> Flame state confirmed by {TM_ID} Appendix A.</>
      ) : null}
      {o.quality_flags.includes("calibration_borrowed_from_bass2") ? " Airflow converted with the BASS-II (2014) calibration." : ""}
    </li>
  );
}
