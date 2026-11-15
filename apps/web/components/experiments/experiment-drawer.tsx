"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import { useExperiment } from "@/hooks/api";
import { fmtFixed, isNum, MISSING } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApiExperiment, ApiObservation, GroupSummary, Investigation } from "@/lib/types";
import { BASIS_TEXT, exclusionText, fmtAirflow, flagText, groupLabel, humanize, oxygenOf, pressureOf } from "./model";

export function ExperimentDrawer(props: {
  id: string | null;
  investigations: Investigation[] | undefined;
  groups: GroupSummary[] | undefined;
  onClose: () => void;
  onCloseAutoFocus?: (ev: Event) => void;
}) {
  const { id, investigations, groups, onClose, onCloseAutoFocus } = props;
  const q = useExperiment(id);
  const exp = q.data?.data.experiment;
  const inv = investigations?.find((i) => i.investigation_id === exp?.investigation_id);

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        title={exp ? `${exp.investigation_acronym} test ${exp.test_label}` : id ? `Experiment ${id}` : "Experiment"}
        description={exp ? (inv?.title ?? exp.investigation_name) : undefined}
        className="sm:max-w-[820px]"
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {q.isError ? (
          <ErrorState code={q.error.code} message={q.error.message} onRetry={() => void q.refetch()} compact />
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
    <dl className="grid grid-cols-[9.5rem_1fr] gap-x-3 gap-y-1.5 text-[13px]">
      {items.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words">{v ?? MISSING}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

const num = (v: number | null, d = 1) => <span className="num">{fmtFixed(v, d)}</span>;

function Details({ e, obs, groups, inv }: { e: ApiExperiment; obs: ApiObservation[]; groups: GroupSummary[] | undefined; inv: Investigation | undefined }) {
  const p = pressureOf(e);
  const doi = e.source_doi ?? inv?.doi ?? null;
  return (
    <div>
      <Section title="Identifiers">
        <Fields
          items={[
            ["Investigation", inv?.title ?? e.investigation_name],
            ["Experiment id", <span key="i" className="num">{e.experiment_id}</span>],
            ["Test label", <span key="t" className="num">{e.test_label}</span>],
            ["Sample", e.sample_id ? <span className="num">{e.sample_id}</span> : MISSING],
            ["PSI accession", <span key="a" className="num">{e.investigation_id}</span>],
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
            ["Material", [e.material_type, humanize(e.material_family)].filter(Boolean).join(" · ")],
            ["Configuration", humanize(e.flame_configuration)],
            ["Analysis group", groupLabel(groups, e.group_id)],
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
                  {num(p.kpa, 3)} <Badge>assumed</Badge>
                  <span className="mt-1 block text-xs text-muted">Not recorded in the source. {e.pressure_assumption_source}</span>
                </span>
              ) : (
                <span key="p">{num(p.kpa, 2)} <span className="text-muted">measured</span></span>
              ),
            ],
            ["Airflow range (cm/s)", <span key="f" className="num">{fmtAirflow(e)}</span>],
            ["Flow restrictor", isNum(e.flow_restrictor) ? <span className="num">{e.flow_restrictor}</span> : MISSING],
            ["CO₂ initial / final (%)", <span key="c">{num(e.co2_percent_initial, 2)} / {num(e.co2_percent_final, 2)}</span>],
          ]}
        />
      </Section>

      <Section title="Recorded outcome">
        <Fields
          items={[
            ["Outcome", humanize(e.observed_outcome ?? "unknown")],
            ["Definition", e.outcome_definition],
            ["Measurement method", e.measurement_method],
          ]}
        />
      </Section>

      <Section title={`Flow steps (${obs.length})`}>
        {obs.length === 0 ? (
          <p className="text-[13px] text-muted">No flow steps have been curated for this test, so it has no observations.</p>
        ) : (
          <Table containerClassName="max-h-80" aria-label="Flow steps">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead numeric>Step</TableHead>
                <TableHead>Airflow cm/s · basis</TableHead>
                <TableHead numeric>O₂ %</TableHead>
                <TableHead>State · mode</TableHead>
                <TableHead numeric>Label</TableHead>
                <TableHead>Conf.</TableHead>
                <TableHead>Source token and cell</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {obs.map((o) => (
                <TableRow key={o.observation_id} className="align-top">
                  <TableCell numeric className="h-auto py-1.5">{o.step_index}</TableCell>
                  <TableCell className="h-auto py-1.5">
                    <span className="num">{fmtFixed(o.airflow_cm_s, 2)}</span>
                    {isNum(o.airflow_uncertainty_cm_s) ? <span className="num text-muted"> ±{fmtFixed(o.airflow_uncertainty_cm_s, 2)}</span> : null}
                    <span className="block text-xs text-muted">
                      {BASIS_TEXT[o.airflow_basis] ?? humanize(o.airflow_basis)}
                      {o.flow_raw_value ? ` (raw ${o.flow_raw_value} ${o.flow_raw_unit})` : ""}
                      {o.flow_calibration_ref ? ` · ${o.flow_calibration_ref}` : ""}
                    </span>
                  </TableCell>
                  <TableCell numeric className="h-auto py-1.5">{fmtFixed(o.oxygen_percent, 1)}</TableCell>
                  <TableCell className="h-auto py-1.5">
                    {humanize(o.flame_state)}
                    {o.extinction_mode ? <span className="block text-xs text-muted">{humanize(o.extinction_mode)}</span> : null}
                  </TableCell>
                  <TableCell numeric className="h-auto py-1.5" title={o.label === null ? (exclusionText(o.exclusion_reason) || "Not used for training") : undefined}>
                    {o.label === null ? MISSING : o.label}
                  </TableCell>
                  <TableCell className="h-auto py-1.5">{humanize(o.confidence)}</TableCell>
                  <TableCell className="h-auto min-w-48 py-1.5">
                    <q className="font-mono text-xs">{o.raw_token}</q>
                    <span className="num block text-xs text-muted">row {o.source_row} · {o.raw_column}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="mt-2 text-xs text-muted">Label 1 = flame sustained, 0 = not sustained, {MISSING} = not used for training.</p>
      </Section>

      <Section title="Provenance and quality">
        <Fields
          items={[
            ["Source file", e.source_file ? <span className="num break-all text-xs">{e.source_file}</span> : MISSING],
            ["Sheet · row", e.source_sheet ? <span className="num">{e.source_sheet} · row {e.source_row ?? MISSING}</span> : MISSING],
            ["Extraction", `${humanize(e.extraction_method)} · confidence ${e.extraction_confidence}`],
            [
              "Training",
              e.included_in_training ? "Included" : `Excluded: ${exclusionText(e.exclusion_reason) || "no reason recorded"}`,
            ],
          ]}
        />
        <h4 className="mt-3 mb-1 text-xs text-muted">Quality flags</h4>
        {e.quality_flags.length === 0 ? (
          <p className="text-[13px] text-muted">No quality flags.</p>
        ) : (
          <ul className="space-y-1 text-[13px]">
            {e.quality_flags.map((f) => (
              <li key={f}>
                <code className="num mr-1.5 rounded-sm bg-subtle px-1 text-xs">{f}</code>
                {flagText(f)}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {e.notes_raw ? (
        <Section title="Notes as recorded (verbatim)">
          <pre className="max-h-48 overflow-auto rounded-md border border-border bg-subtle p-2.5 font-mono text-xs whitespace-pre-wrap">{e.notes_raw}</pre>
        </Section>
      ) : null}

      <Section title="Original record">
        <Button asChild>
          <a href={e.source_url} target="_blank" rel="noreferrer">
            View original NASA record <ExternalLink aria-hidden />
          </a>
        </Button>
        <p className="mt-1.5 text-xs text-muted">Opens the PSI investigation page ({e.investigation_id}), which hosts the source files.</p>
      </Section>
    </div>
  );
}
