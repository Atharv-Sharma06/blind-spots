"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DisclosureChevron } from "@/components/ui/disclosure";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApiQuery } from "@/hooks/api";
import type { ContextResponse, NotIntegratedInvestigation, SourcesResponse } from "@/lib/types";
import { fmtCount, fmtPair } from "@/lib/format";
import { ExtLink, P, QueryBoundary, Section, Sub } from "./primitives";

/** Only http(s) URLs are rendered as links. */
const safeUrl = (u: string | null | undefined): string | null => (u && /^https?:\/\//i.test(u) ? u : null);

const ROLE_LABEL = { integrated_model: "model", integrated_context: "context", catalogued_not_integrated: "listed" } as const;

/** Collapsed block with a plain summary line (>= 40 px tap target). */
function More({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="card group/disclosure max-w-[78ch] px-5 sm:px-6">
      <summary data-disclosure="" className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--radius-sm)] text-[17px] font-medium tracking-[-0.01em] text-fg hover:text-accent focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-subtle">
          <DisclosureChevron />
        </span>
      </summary>
      <div className="space-y-3 pb-4 pt-1">{children}</div>
    </details>
  );
}

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
      <TableCell className="h-auto min-w-[16rem] py-2 align-top text-xs">
        <details>
          <summary className="flex min-h-10 cursor-pointer items-center text-fg underline decoration-border-strong underline-offset-2">Why not used</summary>
          <p className="mt-1 max-w-[60ch] text-muted">{n.reason_not_integrated}</p>
          <p className="mt-1 max-w-[60ch] text-muted">{n.data_availability}</p>
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
        </details>
      </TableCell>
    </TableRow>
  );
}

export function SourcesSection({ sources, context }: { sources: ApiQuery<SourcesResponse>; context: ApiQuery<ContextResponse> }) {
  return (
    <Section id="sources" number={6} title="Sources" intro="Every source is linked. Context is never used to train the model.">
      <Sub title="Data we use">
        <QueryBoundary query={sources} rows={4}>
          {(s) => {
            const integrated = s.investigations.filter((i) => i.role !== "catalogued_not_integrated");
            const catalogued = s.investigations.length - integrated.length;
            return (
              <>
                <Table containerClassName="max-h-[420px] rounded-[var(--radius-md)] border-border">
                  <caption className="sr-only">NASA investigations used as model data or context</caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Study</TableHead>
                      <TableHead>Use</TableHead>
                      <TableHead numeric>Tests</TableHead>
                      <TableHead numeric>Results</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {integrated.map((i) => (
                      <TableRow key={i.investigation_id}>
                        <TableCell className="h-auto py-1.5">
                          <ExtLink href={safeUrl(i.landing_url)}>{i.acronym}</ExtLink>
                          {i.doi ? (
                            <div className="num text-[11px] text-muted">
                              <ExtLink href={`https://doi.org/${i.doi}`}>{i.doi}</ExtLink>
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge tone={i.role === "integrated_model" ? "accent" : "neutral"}>{ROLE_LABEL[i.role]}</Badge>
                        </TableCell>
                        <TableCell numeric>{fmtCount(i.n_experiments)}</TableCell>
                        <TableCell numeric>{fmtCount(i.n_observations)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <P className="text-muted">{fmtCount(catalogued)} more NASA PSI studies were listed but not used: no per-test solid-fuel data in a form we can read.</P>
              </>
            );
          }}
        </QueryBoundary>
      </Sub>

      <More summary="Papers and documents">
        <QueryBoundary query={sources} rows={4}>
          {(s) =>
            s.publications.length === 0 ? (
              <P className="text-muted">None listed.</P>
            ) : (
              <ul className="max-h-[360px] max-w-[78ch] space-y-1.5 overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-subtle p-4 text-[13px]" tabIndex={0} aria-label="Papers and documents">
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
      </More>

      <More summary="Where the cabin air values come from">
        <P className="text-muted">Each document gives its page and the exact quote.</P>
        <QueryBoundary query={sources} rows={3}>
          {(s) => (
            <ul className="max-h-[420px] max-w-[78ch] space-y-3 overflow-y-auto text-[13px]">
              {s.atmosphere_sources.map((a) => (
                <li key={a.ref_id}>
                  <ExtLink href={safeUrl(a.url)}>{a.title}</ExtLink>
                  <div className="num text-xs text-muted">
                    {a.doc_number ?? a.ref_id}
                    {a.page ? `, ${a.page}` : ""}
                  </div>
                  <div className="text-xs text-muted">{a.quote ? `“${a.quote}”` : "No quote recorded."}</div>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </More>

      <More summary="Other NASA work we do not use">
        <P className="text-muted">These studies exist, so gaps on the map do not mean NASA has not studied them. No model uses their data.</P>
        <QueryBoundary query={context} rows={4}>
          {(c) =>
            c.not_integrated.length === 0 ? (
              <P className="text-muted">None listed.</P>
            ) : (
              <Table containerClassName="max-h-[560px] rounded-[var(--radius-md)] border-border">
                <caption className="sr-only">Documented investigations not used, with data availability</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Study</TableHead>
                    <TableHead>Conditions tested</TableHead>
                    <TableHead>Details</TableHead>
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
      </More>

      <More summary="Ground tests (normal gravity)">
        <P className="text-muted">For reference only. Ground flame tests are not the same as ISS tests, so no model uses them.</P>
        <QueryBoundary query={sources} rows={2}>
          {(s) =>
            s.ground_data_sources.length === 0 ? (
              <P className="text-muted">None listed.</P>
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
          {(c) => <P className="text-muted">{fmtCount(c.ground_flammability.length)} ground records in total.</P>}
        </QueryBoundary>
      </More>
    </Section>
  );
}
