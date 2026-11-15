"use client";

import { useEffect, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/hooks/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtCount, fmtFixed } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AssessResponse, GroupSummary, Target } from "@/lib/types";
import type { ApiError } from "@/lib/api";
import { pointsSupported } from "./evidence";
import { VerdictBadge } from "./panel-bits";

/** Starts the per-group assessments only once the table is near the viewport (keeps them out of the critical path). */
function useNearViewport<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) setSeen(true);
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

/** Feature C: the selected target assessed against every analysis group (rows share the assess query cache). */
export function MaterialCoverage({
  groups,
  target,
  selectedGroupId,
  onSelect,
}: {
  groups: readonly GroupSummary[];
  target: Target;
  selectedGroupId: string | null;
  onSelect: (id: string) => void;
}) {
  const [ref, visible] = useNearViewport<HTMLDivElement>();
  const results = useQueries({
    queries: groups.map((g) => {
      const body = { group_id: g.group_id, target };
      return {
        queryKey: queryKeys.assess(body),
        queryFn: ({ signal }: { signal: AbortSignal }) => api.assessTarget(body, signal),
        staleTime: 60_000,
        retry: false,
        enabled: visible || g.group_id === selectedGroupId,
      };
    }),
  });

  return (
    <div ref={ref}>
      <Table containerClassName="max-h-[360px]" aria-label="Coverage of the selected target by material and flame configuration" data-testid="material-coverage">
        <TableHeader>
          <tr>
            <TableHead className="whitespace-normal">Material and flame configuration</TableHead>
            <TableHead numeric className="hidden sm:table-cell">Comparable</TableHead>
            <TableHead numeric className="hidden sm:table-cell">Nearest (reference distance)</TableHead>
            <TableHead>Verdict</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {groups.map((g, i) => {
            const q = results[i];
            const a: AssessResponse | undefined = q?.data?.data;
            const err = q?.error as ApiError | null | undefined;
            const selected = g.group_id === selectedGroupId;
            const sup = a ? pointsSupported(a) : null;
            return (
              <TableRow key={g.group_id} data-state={selected ? "selected" : undefined}>
                <TableCell className="py-1.5">
                  <button
                    type="button"
                    onClick={() => onSelect(g.group_id)}
                    aria-current={selected ? "true" : undefined}
                    className={cn("w-full text-left leading-snug hover:underline", selected && "font-medium")}
                  >
                    {g.label}
                  </button>
                  {g.model_status !== "modeled" ? <span className="block text-xs text-muted">coverage only</span> : null}
                  {a ? (
                    <span className="block text-xs text-muted sm:hidden">
                      <span className="num">{fmtCount(a.coverage.comparable_observations)}</span> comparable · nearest <span className="num">{fmtFixed(a.coverage.nn_distance_min, 1)}</span> ref. dist.
                    </span>
                  ) : null}
                </TableCell>
                <TableCell numeric className="hidden sm:table-cell">{a ? fmtCount(a.coverage.comparable_observations) : q?.isPending ? "…" : "—"}</TableCell>
                <TableCell numeric className="hidden sm:table-cell">{a ? fmtFixed(a.coverage.nn_distance_min, 1) : q?.isPending ? "…" : "—"}</TableCell>
                <TableCell className="py-1.5">
                  {a ? (
                    <>
                      <VerdictBadge verdict={a.verdict} />
                      {sup !== null ? (
                        <span className="block text-xs whitespace-nowrap text-muted">
                          <span className="num">{sup}</span> of <span className="num">{a.coverage.n_target_points}</span> points
                        </span>
                      ) : null}
                    </>
                  ) : err ? (
                    <span className="text-xs text-muted" title={err.message}>unavailable</span>
                  ) : (
                    <span className="text-xs text-muted">…</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
