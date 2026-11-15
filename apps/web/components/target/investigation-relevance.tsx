"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import { fmtCount } from "@/lib/format";
import type { AssessResponse } from "@/lib/types";
import { relevanceRows, type RelevanceRole } from "./evidence";

const ROLE: Record<RelevanceRole, { label: string; cls: string }> = {
  integrated: { label: "Used by the model", cls: "border-observed/25 bg-observed-tint text-observed" },
  context: { label: "Context only", cls: "border-border bg-subtle text-fg" },
  not_integrated: { label: "Not used by the model", cls: "border-border bg-surface text-muted" },
};

const TOP = 3;

/** The rest of the record title after its short name: "X (Long name), detail" -> "Long name, detail". */
function subtitle(name: string, head: string): string {
  if (!name.startsWith(head)) return name;
  const rest = name.slice(head.length);
  if (rest.startsWith(" (")) return rest.slice(2).replace(")", "");
  return rest.replace(/^[\s:·-]+/, "");
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
    <section id="related-work" aria-labelledby="inv-rel-heading" className="scroll-mt-20 pt-1" data-testid="investigation-relevance">
      <h3 id="inv-rel-heading" className="text-[13px] font-semibold text-fg">Related NASA work for this cabin</h3>
      <p className="mt-0.5 text-xs text-muted">
        {fromBackend ? "Ranked by how close their test conditions are to this air. Only some are used by the model." : "Documented NASA work whose test conditions reach this air. The model does not use it."}
      </p>
      <ol className="mt-2 divide-y divide-border">
        {shown.map((r) => {
          const role = ROLE[r.role];
          const count =
            r.comparable !== null
              ? `${fmtCount(r.comparable)} nearby test result${r.comparable === 1 ? "" : "s"} for this material`
              : r.comparableAny != null
                ? `${fmtCount(r.comparableAny)} nearby ISS test result${r.comparableAny === 1 ? "" : "s"} (any material)`
                : null;
          const evidence = [count, r.overlap].filter(Boolean).join(" · ");
          return (
            <li key={r.id} className="py-2 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 min-w-0 text-[13px] leading-snug font-medium text-fg">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-10 items-center gap-1 hover:underline sm:min-h-0">
                      {r.acronym}
                      <ExternalLink className="size-3 shrink-0 text-muted" aria-hidden />
                      <span className="sr-only"> (source record, opens in a new tab)</span>
                    </a>
                  ) : (
                    r.acronym
                  )}
                </p>
                <span className={cn("inline-flex h-5 shrink-0 items-center rounded-sm border px-1.5 text-xs font-medium leading-none", role.cls)}>{role.label}</span>
              </div>
              {r.name && r.name !== r.acronym ? (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted" title={r.name}>
                  {subtitle(r.name, r.acronym)}
                </p>
              ) : null}
              {r.summary && !evidence ? <p className="mt-0.5 line-clamp-2 text-xs text-muted">{r.summary}</p> : null}
              {evidence ? <p className="mt-0.5 text-xs text-fg" title={r.summary ?? undefined}>{evidence}</p> : null}
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
