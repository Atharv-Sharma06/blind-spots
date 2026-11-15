"use client";

import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/hooks/api";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtCount, fmtFixed, verdictLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AssessResponse, GroupSummary, Target } from "@/lib/types";
import type { ApiError } from "@/lib/api";

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
  const results = useQueries({
    queries: groups.map((g) => {
      const body = { group_id: g.group_id, target };
      return {
        queryKey: queryKeys.assess(body),
        queryFn: ({ signal }: { signal: AbortSignal }) => api.assessTarget(body, signal),
        staleTime: 60_000,
        retry: false,
      };
    }),
  });

  return (
    <Table containerClassName="max-h-[320px]" aria-label="Coverage of the selected target by material and configuration" data-testid="material-coverage">
      <TableHeader>
        <tr>
          <TableHead>Material · configuration</TableHead>
          <TableHead numeric>Comparable</TableHead>
          <TableHead numeric>NN dist.</TableHead>
          <TableHead>Verdict</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {groups.map((g, i) => {
          const q = results[i];
          const a: AssessResponse | undefined = q?.data?.data;
          const err = q?.error as ApiError | null | undefined;
          const selected = g.group_id === selectedGroupId;
          return (
            <TableRow key={g.group_id} data-state={selected ? "selected" : undefined}>
              <TableCell className="max-w-[190px]">
                <button
                  type="button"
                  onClick={() => onSelect(g.group_id)}
                  aria-current={selected ? "true" : undefined}
                  className={cn("w-full truncate text-left hover:underline", selected && "font-medium")}
                  title={g.label}
                >
                  {g.label}
                </button>
                {g.model_status !== "modeled" ? <span className="block text-xs text-muted">coverage only</span> : null}
              </TableCell>
              <TableCell numeric>{a ? fmtCount(a.coverage.comparable_observations) : q?.isPending ? "…" : "—"}</TableCell>
              <TableCell numeric>{a ? fmtFixed(a.coverage.nn_distance_min, 1) : q?.isPending ? "…" : "—"}</TableCell>
              <TableCell>
                {a ? (
                  <Badge tone={a.verdict === "supported" ? "accent" : a.verdict === "extrapolation" ? "gap" : "neutral"}>{verdictLabel(a.verdict)}</Badge>
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
  );
}
