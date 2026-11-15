"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtCount } from "@/lib/format";
import type { AssessResponse } from "@/lib/types";
import { relevanceRows, type RelevanceRole } from "./evidence";

/** Outlined chip with a status dot: filled blue = in the model, filled grey = context only, hollow = not in the model. */
const ROLE: Record<RelevanceRole, { label: string; dot: string }> = {
  integrated: { label: "In the model", dot: "bg-observed" },
  context: { label: "Context only", dot: "bg-border-strong" },
  not_integrated: { label: "Not in the model", dot: "border border-muted bg-transparent" },
};

const TOP = 3;

/** The one short reason a record is listed: nearby test count, else how its tested air overlaps, else its summary. */
function reasonOf(r: ReturnType<typeof relevanceRows>["rows"][number]): string | null {
  if (r.comparable !== null) return `${fmtCount(r.comparable)} nearby ISS test result${r.comparable === 1 ? "" : "s"}`;
  if (r.comparableAny != null) return `${fmtCount(r.comparableAny)} nearby ISS test result${r.comparableAny === 1 ? "" : "s"}, any material`;
  if (r.overlap) {
    return r.overlap
      .replace(/^Its tested conditions (include|overlap) this cabin's air$/, (_m, v: string) => `Tested air ${v}s this cabin's`)
      .replace(/^Its tested conditions do not (overlap|reach) this cabin's air$/, (_m, v: string) => `Tested air does not ${v} this cabin's`);
  }
  return r.summary ?? null;
}

/** "Related NASA work for this cabin": the backend's ranked investigation_relevance for the selected target. */
export function InvestigationRelevance({ a }: { a: AssessResponse }) {
  const [all, setAll] = useState(false);
  const { rows, fromBackend } = relevanceRows(a);
  const has = rows.length > 0;
  // A link ending in #related-work (from the Cabins answer card) lands on this list once it has loaded.
  useEffect(() => {
    if (!has || typeof window === "undefined" || window.location.hash !== "#related-work") return;
    document.getElementById("related-work")?.scrollIntoView({ block: "start" });
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }, [has]);
  if (rows.length === 0) return null;
  const shown = all ? rows : rows.slice(0, TOP);
  return (
    <section id="related-work" aria-labelledby="inv-rel-heading" className="card scroll-mt-20 p-6 sm:p-7" data-testid="investigation-relevance">
      <h3 id="inv-rel-heading" className="text-xl leading-7 font-medium text-fg">Related NASA work</h3>
      <p className="mt-1 text-sm text-muted">
        {fromBackend ? "Closest first. Only some feed the model." : "None of it feeds the model."}
      </p>
      <ol className="mt-4 divide-y divide-border">
        {shown.map((r) => {
          const role = ROLE[r.role];
          const reason = reasonOf(r);
          return (
            <li key={r.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 text-[15px] leading-snug font-medium text-fg" title={r.name && r.name !== r.acronym ? r.name : undefined}>
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer noopener" className="flex min-h-10 min-w-0 items-center gap-1 hover:underline sm:min-h-0">
                      <span className="truncate">{r.acronym}</span>
                      <ExternalLink className="size-3 shrink-0 text-muted" aria-hidden />
                      <span className="sr-only"> (source record, opens in a new tab)</span>
                    </a>
                  ) : (
                    <span className="block truncate">{r.acronym}</span>
                  )}
                </p>
                <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium leading-none whitespace-nowrap text-fg">
                  <span aria-hidden className={cn("size-2 shrink-0 rounded-full", role.dot)} />
                  {role.label}
                </span>
              </div>
              {reason ? <p className="mt-1 line-clamp-1 text-sm text-muted">{reason}</p> : null}
            </li>
          );
        })}
      </ol>
      {rows.length > TOP ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-1 inline-flex min-h-10 items-center text-xs text-muted underline-offset-2 hover:text-fg hover:underline sm:min-h-0" aria-expanded={all}>
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      ) : null}
    </section>
  );
}
