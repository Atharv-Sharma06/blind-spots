"use client";

import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApiQuery } from "@/hooks/api";
import type { ContextResponse, NotIntegratedInvestigation, SourcesResponse } from "@/lib/types";
import { fmtCount, fmtPair } from "@/lib/format";
import { ExtLink, P, QueryBoundary, Section, Sub } from "./primitives";

/** Only http(s) URLs are rendered as links. */
const safeUrl = (u: string | null | undefined): string | null => (u && /^https?:\/\//i.test(u) ? u : null);

const ROLE_LABEL = { integrated_model: "modelled", integrated_context: "context only", catalogued_not_integrated: "catalogued" } as const;

function NotIntegratedRow({ n }: { n: NotIntegratedInvestigation }) {
  return (
    <TableRow>
      <TableCell className="h-auto min-w-[14rem] py-2 align-top">
        <div className="font-medium">{n.name}</div>
        <div className="text-xs text-muted">
          {n.platform}; {n.years}
        </div>
      </TableCell>
      <TableCell className="num h-auto whitespace-nowrap py-2 align-top text-xs">
        O2 {fmtPair(n.oxygen_percent_range, " %", 1)}
        <br />p {fmtPair(n.pressure_kpa_range, " kPa", 1)}
        <br />flow {fmtPair(n.flow_cm_s_range, " cm/s", 1)}
      </TableCell>
      <TableCell className="h-auto min-w-[18rem] py-2 align-top text-xs">
        <details>
          <summary className="cursor-pointer text-fg underline decoration-border-strong underline-offset-2">Data availability</summary>
          <p className="mt-1 max-w-[60ch] text-muted">{n.data_availability}</p>
          <p className="mt-1 max-w-[60ch] text-muted">
            <span className="font-medium text-fg">Not integrated because:</span> {n.reason_not_integrated}
          </p>
        </details>
        <ul className="mt-1 space-y-1">
          {n.sources
            .filter((s) => safeUrl(s.url))
            .filter((s, i, arr) => arr.findIndex((o) => o.url === s.url) === i)
            .map((s) => (
              <li key={s.url} className="flex min-h-6 items-center">
                <ExtLink href={safeUrl(s.url)}>{s.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 56)}</ExtLink>
              </li>
            ))}
        </ul>
      </TableCell>
    </TableRow>
  );
}

export function SourcesSection({ sources, context }: { sources: ApiQuery<SourcesResponse>; context: ApiQuery<ContextResponse> }) {
  return (
    <Section id="sources" number={6} title="Sources and context" intro="Everything below is linked to its public source. Context is never used to train a model.">
      <Sub title="Integrated investigations">
        <QueryBoundary query={sources} rows={4}>
          {(s) => {
            const integrated = s.investigations.filter((i) => i.role !== "catalogued_not_integrated");
            const catalogued = s.investigations.length - integrated.length;
            return (
              <>
                <Table containerClassName="max-h-[420px]">
                  <caption className="sr-only">Investigations integrated as model data or context</caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Investigation</TableHead>
                      <TableHead>Use</TableHead>
                      <TableHead>DOI</TableHead>
                      <TableHead numeric>Experiments</TableHead>
                      <TableHead numeric>Observations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {integrated.map((i) => (
                      <TableRow key={i.investigation_id}>
                        <TableCell className="h-auto py-1.5">
                          <ExtLink href={safeUrl(i.landing_url)}>{i.acronym}</ExtLink>
                          <div className="num text-[11px] text-muted">{i.investigation_id}</div>
                        </TableCell>
                        <TableCell>
                          <Badge tone={i.role === "integrated_model" ? "accent" : "neutral"}>{ROLE_LABEL[i.role]}</Badge>
                        </TableCell>
                        <TableCell className="num whitespace-nowrap text-xs">{i.doi ? <ExtLink href={`https://doi.org/${i.doi}`}>{i.doi}</ExtLink> : "none"}</TableCell>
                        <TableCell numeric>{fmtCount(i.n_experiments)}</TableCell>
                        <TableCell numeric>{fmtCount(i.n_observations)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <P className="text-muted">
                  {fmtCount(catalogued)} further NASA PSI investigations were catalogued and not integrated (no per-test solid-fuel flammability records in a machine-readable form).
                </P>
              </>
            );
          }}
        </QueryBoundary>
      </Sub>

      <Sub title="Publications and documents">
        <QueryBoundary query={sources} rows={4}>
          {(s) =>
            s.publications.length === 0 ? (
              <P className="text-muted">No publications are listed.</P>
            ) : (
              <ul className="max-h-[360px] max-w-[78ch] space-y-1.5 overflow-y-auto rounded-md border border-border bg-surface p-3 text-[13px]" tabIndex={0} aria-label="Publications and documents">
                {s.publications.map((p, i) => (
                  <li key={`${p.url}-${p.title}-${i}`}>
                    {safeUrl(p.url) ? <ExtLink href={safeUrl(p.url)}>{p.title}</ExtLink> : <span>{p.title}</span>}
                    {p.doi ? (
                      <>
                        {" "}
                        <span className="text-muted">DOI</span> <ExtLink href={`https://doi.org/${p.doi}`}>{p.doi}</ExtLink>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )
          }
        </QueryBoundary>
      </Sub>

      <Sub title="Atmosphere-profile sources">
        <P className="text-muted">Documents that give the cabin atmospheres and ventilation used as targets; each carries the page and quotation it was taken from.</P>
        <QueryBoundary query={sources} rows={3}>
          {(s) => (
            <Table containerClassName="max-h-[420px]">
              <caption className="sr-only">Atmosphere-profile source documents</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Quoted text</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.atmosphere_sources.map((a) => (
                  <TableRow key={a.ref_id}>
                    <TableCell className="h-auto min-w-[14rem] py-2 align-top">
                      <ExtLink href={safeUrl(a.url)}>{a.title}</ExtLink>
                    </TableCell>
                    <TableCell className="num h-auto whitespace-nowrap py-2 align-top text-xs">
                      {a.doc_number ?? a.ref_id}
                      {a.page ? <div className="text-muted">{a.page}</div> : null}
                    </TableCell>
                    <TableCell className="h-auto min-w-[16rem] py-2 align-top text-xs text-muted">{a.quote ? `“${a.quote}”` : "no quotation recorded"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </QueryBoundary>
      </Sub>

      <Sub title="Related NASA work, not integrated">
        <Callout variant="info" title="Not represented in the integrated records">
          These investigations exist and may already inform conditions the integrated records do not cover. They are listed so the gaps on the map are not read as &quot;NASA has not studied this&quot;. Their data are not used by any model.
        </Callout>
        <QueryBoundary query={context} rows={4}>
          {(c) =>
            c.not_integrated.length === 0 ? (
              <P className="text-muted">No documented investigations outside the integrated records are listed.</P>
            ) : (
              <Table containerClassName="max-h-[560px]">
                <caption className="sr-only">Documented investigations not integrated, with data availability</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Investigation</TableHead>
                    <TableHead>Documented envelope</TableHead>
                    <TableHead>Data availability and sources</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.not_integrated.map((n) => (
                    <NotIntegratedRow key={n.id} n={n} />
                  ))}
                </TableBody>
              </Table>
            )
          }
        </QueryBoundary>
      </Sub>

      <Sub title="Ground (1 g) context data">
        <P className="text-muted">Normal-gravity flammability thresholds give context for material behaviour; they are shown as reference points only and are not comparable with microgravity flow-step outcomes.</P>
        <QueryBoundary query={sources} rows={2}>
          {(s) =>
            s.ground_data_sources.length === 0 ? (
              <P className="text-muted">No ground-data sources are listed.</P>
            ) : (
              <ul className="max-w-[78ch] space-y-1.5 text-[13px]">
                {s.ground_data_sources.map((g, i) => {
                  const r = g as { title?: string; url?: string | null; ntrs_id?: string | null; n_records?: number };
                  return (
                    <li key={`${r.url ?? r.title}-${i}`}>
                      <ExtLink href={safeUrl(r.url)}>{r.title ?? "Untitled source"}</ExtLink>
                      {typeof r.n_records === "number" ? <span className="num text-muted"> · {r.n_records} records</span> : null}
                    </li>
                  );
                })}
              </ul>
            )
          }
        </QueryBoundary>
        <QueryBoundary query={context} rows={1}>
          {(c) => <P className="text-muted">{fmtCount(c.ground_flammability.length)} ground flammability records are held as context in total.</P>}
        </QueryBoundary>
      </Sub>
    </Section>
  );
}
