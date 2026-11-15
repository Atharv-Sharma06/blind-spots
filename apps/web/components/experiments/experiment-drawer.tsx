"use client";

import * as React from "react";
import { ExternalLink, SearchX } from "lucide-react";
import { useExperiment } from "@/hooks/api";
import { fmtFixed, isNum, MISSING } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApiExperiment, ApiObservation, GroupSummary, Investigation } from "@/lib/types";
import {
  BASIS_TEXT,
  calibrationText,
  confidenceLabel,
  configurationLabel,
  exclusionText,
  experimentTitle,
  extinctionText,
  flagText,
  flameStateText,
  fmtAirflow,
  groupLabel,
  humanize,
  isContextReason,
  materialLabel,
  outcomeLabel,
  oxygenOf,
  plainDefinition,
  pressureOf,
  rawFlowText,
  tmPage,
} from "./model";

/** Optional step evidence (requested from the backend; rendered when present). */
type StepEvidence = { evidence_source?: string | null; evidence_page?: string | null; evidence_quote?: string | null };

const titleOf = (e: ApiExperiment) => experimentTitle(e);

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
        title={exp ? titleOf(exp) : notFound ? "No experiment with this id" : "Experiment"}
        description={exp ? (inv?.title ?? exp.investigation_name) : undefined}
        className="sm:max-w-[820px]"
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
                  <span className="num text-fg">{id}</span> is not one of the experiments in the integrated records. Check the link, or
                  pick a row in the table.
                </>
              }
              action={
                <SheetClose asChild>
                  <Button>Back to the table</Button>
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
    <section className="border-b border-border py-4 first:pt-0 last:border-b-0">
      <h3 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Fields({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-3 gap-y-0.5 text-[13px] sm:grid-cols-[10rem_1fr] sm:gap-y-1.5">
      {items.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="pt-1.5 text-muted first:pt-0 sm:pt-0">{k}</dt>
          <dd className="min-w-0 break-words">{v ?? MISSING}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

const num = (v: number | null, d = 1) => <span className="num">{fmtFixed(v, d)}</span>;

const TM_ID = "NASA/TM-20210011385";

function Details({ e, obs, groups, inv }: { e: ApiExperiment; obs: ApiObservation[]; groups: GroupSummary[] | undefined; inv: Investigation | undefined }) {
  const p = pressureOf(e);
  const doi = e.source_doi ?? inv?.doi ?? null;
  const isPsi = e.investigation_id.startsWith("PSI-");
  const ntrsId = /^NTRS-(\d+)$/.exec(e.investigation_id)?.[1] ?? null;
  const context = isContextReason(e.exclusion_reason);
  const nUsed = obs.filter((o) => o.included_in_training).length;
  const page = tmPage(e.measurement_method);
  const tmNotes = e.quality_flags.includes("notes_from_nasa_tm_20210011385");

  const training = context
    ? exclusionText(e.exclusion_reason)
    : obs.length === 0
      ? e.included_in_training
        ? "Included."
        : exclusionText(e.exclusion_reason) || "Not used for training."
      : nUsed === obs.length
        ? `All ${obs.length} flow ${obs.length === 1 ? "step is" : "steps are"} used to train the model.`
        : nUsed === 0
          ? `None of its ${obs.length} flow steps is used for training. ${exclusionText(e.exclusion_reason)}`.trim()
          : `${nUsed} of ${obs.length} flow steps are used for training; the others are held out (reason on each step below).`;

  return (
    <div>
      <Section title="Identifiers">
        <Fields
          items={[
            ["Investigation", inv?.title ?? e.investigation_name],
            ["Experiment id", <span key="i" className="num">{e.experiment_id}</span>],
            ["Test label", <span key="t" className="num">{e.test_label}</span>],
            ["Sample", e.sample_id ? <span className="num">{e.sample_id}</span> : MISSING],
            [isPsi ? "PSI accession" : ntrsId ? "NTRS document" : "Accession", <span key="a" className="num">{ntrsId ?? e.investigation_id}</span>],
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
            ["Test date", e.test_date ? <span className="num">{e.test_date}</span> : MISSING],
            ["Platform", e.experimental_platform],
            ["Material", [e.material_type, materialLabel(e.material_family)].filter(Boolean).join(" · ")],
            ["Flame configuration", configurationLabel(e.flame_configuration)],
            ["Analysis group", e.group_id ? groupLabel(groups, e.group_id) : "None"],
          ]}
        />
      </Section>

      <Section title="Conditions">
        <Fields
          items={[
            ["O₂ initial / final (%)", <span key="o">{num(oxygenOf(e))} / {num(e.oxygen_percent_final)}</span>],
            [
              "Total pressure (kPa)",
              p.assumed ? (
                <span key="p">
                  {num(p.kpa, 1)} <Badge>assumed</Badge>
                  <span className="mt-1 block text-xs text-muted">
                    Not recorded in the source; the documented ISS cabin nominal is used and kept in a separate field.
                  </span>
                </span>
              ) : (
                <span key="p">
                  {num(p.kpa, 1)} <span className="text-muted">recorded</span>
                </span>
              ),
            ],
            ["Airflow range (cm/s)", <span key="f" className="num">{fmtAirflow(e)}</span>],
            ["Flow restrictors", isNum(e.flow_restrictor) ? <span className="num">{e.flow_restrictor}</span> : MISSING],
            ["CO₂ initial / final (%)", <span key="c">{num(e.co2_percent_initial, 2)} / {num(e.co2_percent_final, 2)}</span>],
          ]}
        />
      </Section>

      <Section title="Recorded outcome">
        <Fields
          items={[
            ["Outcome", outcomeLabel(e.observed_outcome)],
            ["How it was assigned", plainDefinition(e.outcome_definition)],
            ["Measurement method", plainDefinition(e.measurement_method)],
          ]}
        />
      </Section>

      <Section title="Training">
        <p className="text-[13px]">
          <span className="font-medium">{e.included_in_training ? "Included" : "Excluded"}.</span> {training}
        </p>
      </Section>

      <Section title={`Flow steps (${obs.length})`}>
        {obs.length === 0 ? (
          <p className="text-[13px] text-muted">
            {context
              ? "Context records keep the printed test-level values only; they have no flow steps."
              : "No flow steps could be read from the source for this test, so it has no observations."}
          </p>
        ) : (
          <>
            <Table containerClassName="max-h-[28rem]" aria-label="Flow steps">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead numeric>Step</TableHead>
                  <TableHead>Airflow cm/s</TableHead>
                  <TableHead numeric>O₂ %</TableHead>
                  <TableHead>Flame</TableHead>
                  <TableHead numeric>Label</TableHead>
                  <TableHead>Source quote</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {obs.map((o) => (
                  <StepRow key={o.observation_id} o={o} testLabel={e.test_label} />
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted">
              Label 1 = flame sustained, 0 = flame not sustained, {MISSING} = no curated outcome; greyed = not used for training (hover for the reason). Steps are numbered
              from 1, as on the map.
            </p>
          </>
        )}
      </Section>

      {e.notes_raw ? (
        <Section title={tmNotes ? "Observation notes (NASA technical memorandum)" : "Notes as recorded (verbatim)"}>
          <blockquote className="max-h-48 overflow-auto rounded-md border border-border bg-subtle p-2.5 font-mono text-xs whitespace-pre-wrap">
            {e.notes_raw}
          </blockquote>
          {tmNotes ? (
            <p className="mt-1.5 text-xs text-muted">
              Quoted verbatim from {TM_ID} Appendix A{page ? `, printed page ${page}` : ""}. The PSI-25 workbook has no observation column.
            </p>
          ) : null}
        </Section>
      ) : null}

      <Section title="Provenance and quality">
        <Fields
          items={[
            ["Source file", e.source_file ? <span className="num break-all text-xs">{e.source_file}</span> : MISSING],
            ["Sheet · row", e.source_sheet ? <span className="num">{e.source_sheet} · row {e.source_row ?? MISSING}</span> : MISSING],
            ["Extraction", `${e.extraction_method === "derived_computation" ? "Computed from the sensor file" : e.extraction_method === "manually_transcribed" ? "Transcribed by hand" : humanize(e.extraction_method)} · confidence ${confidenceLabel(e.extraction_confidence).toLowerCase()}`],
          ]}
        />
        <h4 className="mt-3 mb-1 text-xs text-muted">Quality flags</h4>
        {e.quality_flags.length === 0 ? (
          <p className="text-[13px] text-muted">No quality flags.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-4 text-[13px] marker:text-muted">
            {e.quality_flags.map((f) => (
              <li key={f} title={`Flag code: ${f}`}>
                {flagText(f)}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Original record">
        <Button asChild>
          <a href={e.source_url} target="_blank" rel="noreferrer">
            View original NASA record <ExternalLink aria-hidden />
          </a>
        </Button>
        <p className="mt-1.5 text-xs text-muted">
          {isPsi
            ? `Opens the NASA Physical Sciences Informatics page for ${e.investigation_id}, which hosts the source files.`
            : ntrsId
              ? `Opens the NASA Technical Reports Server record (${ntrsId}) for the document the values were transcribed from.`
              : "Opens the NASA source record."}
        </p>
      </Section>
    </div>
  );
}

function StepRow({ o, testLabel }: { o: ApiObservation; testLabel: string }) {
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
    <TableRow className={used ? "align-top" : "align-top text-muted"} title={used ? undefined : `Not used for training: ${why}`} data-used={used ? "true" : "false"}>
      <TableCell numeric className="h-auto py-2">{o.step_index + 1}</TableCell>
      <TableCell className="h-auto min-w-36 py-2">
        <span className="num">{fmtFixed(o.airflow_cm_s, 2)}</span>
        {isNum(o.airflow_uncertainty_cm_s) ? <span className="num text-muted"> ±{fmtFixed(o.airflow_uncertainty_cm_s, 2)}</span> : null}
        <span className="block text-xs text-muted">
          {BASIS_TEXT[o.airflow_basis] ?? humanize(o.airflow_basis)}
          {raw ? `; ${raw}` : ""}
          {cal ? `; ${cal}` : ""}
        </span>
      </TableCell>
      <TableCell numeric className="h-auto py-2">{fmtFixed(o.oxygen_percent, 1)}</TableCell>
      <TableCell className="h-auto min-w-32 py-2">
        {flameStateText(o.flame_state)}
        {o.extinction_mode ? <span className="block text-xs text-muted">{extinctionText(o.extinction_mode)}</span> : null}
        <span className="block text-xs text-muted">confidence {confidenceLabel(o.confidence).toLowerCase()}</span>
      </TableCell>
      <TableCell numeric className="h-auto py-2">
        {used ? (
          <span className="num">{o.label}</span>
        ) : (
          <span className="text-muted" title={`Not used for training: ${why}`}>
            <span className="num">{o.label ?? MISSING}</span>
            <span className="sr-only">, not used for training</span>
          </span>
        )}
      </TableCell>
      <TableCell className="h-auto min-w-52 py-2">
        <q className="font-mono text-xs">{o.raw_token}</q>
        <span className="block text-xs text-muted">
          {tm ? `${TM_ID} Appendix A, test ${testLabel}` : <span className="num">row {o.source_row} · {o.raw_column}</span>}
        </span>
        {ev.evidence_quote ? (
          <span className="mt-1 block text-xs text-muted">
            {TM_ID}
            {ev.evidence_page ? `, p. ${ev.evidence_page}` : ""}: <q className="text-fg">{ev.evidence_quote}</q>
          </span>
        ) : o.quality_flags.includes("outcome_evidence_nasa_tm_20210011385") && !tm ? (
          <span className="mt-1 block text-xs text-muted">Flame state confirmed by {TM_ID} Appendix A.</span>
        ) : null}
        {!used ? <span className="mt-1 block text-xs text-muted">Not used for training: {why}</span> : null}
      </TableCell>
    </TableRow>
  );
}
