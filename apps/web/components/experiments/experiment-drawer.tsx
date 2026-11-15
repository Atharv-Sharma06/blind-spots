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
  PER_STEP_LABEL,
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
        title={exp ? materialLabel(exp.material_family) : notFound ? "No experiment with this id" : "Experiment details"}
        description={exp ? sourceLabel(exp) : undefined}
        className="sm:max-w-[640px]"
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {notFound ? (
          <div data-error-code="not_found">
            <EmptyState
              icon={<SearchX aria-hidden />}
              title="No experiment with this id"
              description={
                <>
                  <span className="num text-fg">{id}</span> is not one of the experiments in our data. Check the link, or pick one from the list.
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
          <div className="space-y-2" role="status" aria-label="Loading experiment details">
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
    <section className="border-b border-border py-5 first:pt-0 last:border-b-0">
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
    <div className={cn("rounded-lg border border-border bg-subtle/50 px-3.5 py-3", className)}>
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
    ? `No. ${exclusionText(e.exclusion_reason)}`
    : obs.length === 0
      ? e.included_in_training
        ? "Yes."
        : exclusionText(e.exclusion_reason) || "No."
      : nUsed === obs.length
        ? `Yes. All ${obs.length} ${obs.length === 1 ? "step is" : "steps are"} used to teach the model.`
        : nUsed === 0
          ? `No. None of its ${obs.length} ${obs.length === 1 ? "step is" : "steps are"} used. ${exclusionText(e.exclusion_reason)}`.trim()
          : `Partly. ${nUsed} of ${obs.length} steps are used; the others are held out (the reason is on each step).`;

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
      <Section title="Result">
        <ResultChip
          kind={r.kind}
          label={r.label}
          detail={r.label === PER_STEP_LABEL ? "the result is given for each airflow step, below" : r.detail}
          large
        />
        {described ? (
          <blockquote className="mt-3 rounded-md border border-border bg-subtle p-3 text-ui">
            <span className="mb-1 block text-xs text-muted">NASA&apos;s description (verbatim)</span>
            {described}
          </blockquote>
        ) : null}
        {context ? (
          <p className="mt-3 rounded-md bg-gap-tint px-3 py-2 text-ui text-gap-fg">
            Context only: this test used different apparatus or a different test length, so the model does not use it.
          </p>
        ) : null}
      </Section>

      <Section title="Test conditions">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Fact label="Oxygen" value={fmtPlain(oxygenOf(e), 1)} unit="%" note={e.oxygen_percent_final !== null ? <>at the end: <span className="num">{fmtPlain(e.oxygen_percent_final, 1)}</span> %</> : undefined} />
          <Fact label="Pressure" value={fmtPlain(p.kpa, 1)} unit="kPa" note={p.assumed ? "assumed, not recorded" : p.kpa !== null ? "recorded" : undefined} />
          <Fact className="col-span-2 sm:col-span-1" label="Airflow" value={fmtAirflow(e)} unit="cm/s" note={fmtAirflow(e).includes("–") ? "range across the steps" : undefined} />
        </div>
        {p.assumed ? (
          <p className="mt-3 rounded-md bg-gap-tint px-3 py-2 text-ui text-gap-fg">
            The NASA source does not record the pressure of this test. We assume the documented ISS cabin pressure and keep it in a separate field, so it is never mistaken for a
            measurement.
          </p>
        ) : null}
        <div className="mt-4">
          <Fields items={sample} />
        </div>
      </Section>

      <Section title={`Flame at each airflow step (${obs.length})`}>
        {obs.length === 0 ? (
          <p className="text-ui text-muted">
            {context
              ? "Context tests keep only the printed test-level values; they have no airflow steps."
              : "No airflow steps could be read from the source for this test."}
          </p>
        ) : (
          <>
            <ol className="space-y-2">
              {obs.map((o) => (
                <StepItem key={o.observation_id} o={o} testLabel={e.test_label} />
              ))}
            </ol>
            <p className="mt-2 text-xs text-muted">
              Each step is one airflow setting within the experiment. Steps are numbered from 1. Greyed steps are not used by the model.
            </p>
          </>
        )}
      </Section>

      <Section title="Does the model use this experiment?">
        <p className="text-ui">{training}</p>
      </Section>

      {e.notes_raw ? (
        <Section title="What NASA's notes say">
          <blockquote className="max-h-48 overflow-auto rounded-md border border-border bg-subtle p-3 font-mono text-xs whitespace-pre-wrap">{e.notes_raw}</blockquote>
          <p className="mt-1.5 text-xs text-muted">
            Verbatim from the source{tmNotes ? `: ${TM_ID} Appendix A${page ? `, printed page ${page}` : ""}` : ""}.
          </p>
        </Section>
      ) : null}

      <Section title="Where this comes from">
        <Fields
          items={[
            ["Investigation", inv?.title ?? e.investigation_name],
            ["Test", <span key="t" className="num">{sourceLabel(e)}</span>],
            ["Spreadsheet row", e.source_sheet ? <span className="num">{e.source_sheet} · row {e.source_row ?? MISSING}</span> : MISSING],
            [
              "DOI",
              doi ? (
                <a key="d" className="num text-observed underline underline-offset-2" href={`https://doi.org/${doi}`} target="_blank" rel="noreferrer">
                  {doi}
                </a>
              ) : (
                MISSING
              ),
            ],
          ]}
        />
        <div className="mt-3">
          <Button asChild className="h-10 sm:h-8">
            <a href={e.source_url} target="_blank" rel="noreferrer">
              Open the NASA record <ExternalLink aria-hidden />
            </a>
          </Button>
          <p className="mt-1.5 text-xs text-muted">
            {isPsi
              ? `Opens the NASA Physical Sciences Informatics page for ${e.investigation_id}, which hosts the source files.`
              : ntrsId
                ? `Opens the NASA Technical Reports Server record (${ntrsId}) the values were transcribed from.`
                : "Opens the NASA source record."}
          </p>
        </div>
      </Section>

      {shownFlags.length > 0 ? (
        <Section title="Things to know about this record">
          <ul className="list-disc space-y-1.5 pl-4 text-ui marker:text-muted">
            {shownFlags.map((f) => (
              <li key={f} title={`Flag code: ${f}`}>
                {flagText(f)}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <div className="pt-4">
        <Disclosure summary="Technical details" tone="strong">
          <Fields
            items={[
              ["Experiment id", <span key="i" className="num">{e.experiment_id}</span>],
              ["Sample", e.sample_id ? <span className="num">{e.sample_id}</span> : MISSING],
              [isPsi ? "PSI accession" : ntrsId ? "NTRS document" : "Accession", <span key="a" className="num">{ntrsId ?? e.investigation_id}</span>],
              ["Apparatus", e.experimental_platform],
              ["Comparison group", e.group_id ? groupLabel(groups, e.group_id) : "None"],
              ["Recorded outcome", outcomeLabel(e.observed_outcome)],
              ["How it was assigned", plainDefinition(e.outcome_definition)],
              ["Measurement method", plainDefinition(e.measurement_method)],
              ["Source file", e.source_file ? <span className="num break-all text-xs">{e.source_file}</span> : MISSING],
              [
                "Extraction",
                `${e.extraction_method === "derived_computation" ? "Computed from the sensor file" : e.extraction_method === "manually_transcribed" ? "Transcribed by hand" : humanize(e.extraction_method)} · confidence ${confidenceLabel(e.extraction_confidence).toLowerCase()}`,
              ],
            ]}
          />
        </Disclosure>
      </div>
    </div>
  );
}

function StepItem({ o, testLabel }: { o: ApiObservation; testLabel: string }) {
  const ev = o as ApiObservation & StepEvidence;
  const tm = o.raw_column === "TM Appendix A observation";
  const raw = rawFlowText(o.flow_raw_value, o.flow_raw_unit);
  const cal = calibrationText(o.flow_calibration_ref);
  const used = o.included_in_training;
  const why = used
    ? ""
    : o.exclusion_reason === "low_confidence"
      ? o.quality_flags.includes("calibration_borrowed_from_bass2")
        ? "the fan or pot setting was converted with the BASS-II (2014) calibration, not one measured in this campaign, so the step is low confidence."
        : "the source supports this step only with low confidence."
      : exclusionText(o.exclusion_reason) || "no reason recorded.";
  return (
    <li
      data-used={used ? "true" : "false"}
      className={used ? "rounded-lg border border-border bg-surface p-3" : "rounded-lg border border-dashed border-border bg-subtle/40 p-3 text-muted"}
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
      <p className="mt-1 text-xs text-muted">
        Airflow from: {BASIS_TEXT[o.airflow_basis] ?? humanize(o.airflow_basis)}
        {raw ? `; ${raw}` : ""}
        {cal ? `; ${cal}` : ""}
      </p>
      <p className="mt-1 text-xs text-muted">
        Source cell: <q className="font-mono">{o.raw_token}</q>{" "}
        {tm ? `(${TM_ID} Appendix A, test ${testLabel})` : <span className="num">(row {o.source_row}, column “{o.raw_column}”)</span>}
      </p>
      {ev.evidence_quote ? (
        <p className="mt-1 text-xs text-muted">
          {TM_ID}
          {ev.evidence_page ? `, p. ${ev.evidence_page}` : ""}: <q className="text-fg">{ev.evidence_quote}</q>
        </p>
      ) : o.quality_flags.includes("outcome_evidence_nasa_tm_20210011385") && !tm ? (
        <p className="mt-1 text-xs text-muted">Flame state confirmed by {TM_ID} Appendix A.</p>
      ) : null}
      {!used ? <p className="mt-1 text-xs">Not used by the model: {why}</p> : null}
    </li>
  );
}
