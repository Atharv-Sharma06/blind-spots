"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Disclosure } from "@/components/ui/disclosure";
import { cn } from "@/lib/cn";
import type { GroupSummary } from "@/lib/types";
import { materialFlowNote, materialName } from "./cabins";

export interface MaterialPickerProps {
  /** Every analysis group (the API's 20). Only modelled ones can be chosen. */
  groups: readonly GroupSummary[];
  /** Nearby ISS test results for the selected cabin per group (headline `by_group`); null when unavailable. */
  nearby: ReadonlyMap<string, number> | null;
  selectedId: string;
  onChange: (groupId: string) => void;
  /** "select" = the dropdown and its note; "list" = the "By material" disclosure; "both" (default) = everything. */
  part?: "select" | "list" | "both";
}

const countText = (n: number) => `${n.toLocaleString("en-US")} nearby`;

/** Short airflow wording for option text (the same material appears with different airflow, so it must stay). */
const SHORT_FLOW: Record<string, string> = {
  opposed: "air against flame",
  concurrent: "air with flame",
  wake: "flame in wake",
  stagnation: "air at sample",
  unknown: "airflow unknown",
};
const shortFlow = (groupId: string) => SHORT_FLOW[groupId.split("__")[1] ?? ""] ?? materialFlowNote(groupId);

function sortGroups(groups: readonly GroupSummary[], nearby: ReadonlyMap<string, number> | null): GroupSummary[] {
  return [...groups].sort((a, b) => (nearby ? (nearby.get(b.group_id) ?? 0) - (nearby.get(a.group_id) ?? 0) : 0) || b.n_training - a.n_training || a.label.localeCompare(b.label));
}

/** "Material [48 nearby · Thin acrylic film (PMMA), air against flame v]" plus the "By material" list. Counts come from the API. */
export function MaterialPicker({ groups, nearby, selectedId, onChange, part = "both" }: MaterialPickerProps) {
  const selectId = React.useId();
  const modelled = sortGroups(
    groups.filter((g) => g.model_status === "modeled"),
    nearby,
  );
  const all = sortGroups(groups, nearby);
  const withNearby = nearby ? groups.filter((g) => (nearby.get(g.group_id) ?? 0) > 0).length : null;
  const full = (g: GroupSummary) => {
    const flow = shortFlow(g.group_id);
    return flow ? `${materialName(g.group_id, g.label)}, ${flow}` : materialName(g.group_id, g.label);
  };

  const showSelect = part !== "list";
  const showList = part !== "select";

  return (
    <div data-testid={part === "list" ? "material-list" : "material-picker"}>
      {showSelect ? (
      <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <label htmlFor={selectId} className="text-ui font-semibold text-fg">
          Material
        </label>
        <div className="relative w-full sm:max-w-xl">
          <select
            id={selectId}
            value={selectedId}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 w-full min-w-0 appearance-none truncate rounded-md border border-border-strong bg-surface pr-10 pl-3 text-prose text-fg transition-colors hover:border-fg"
          >
            {modelled.map((g) => (
              <option key={g.group_id} value={g.group_id}>
                {nearby ? `${countText(nearby.get(g.group_id) ?? 0)} · ` : ""}
                {full(g)}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
        </div>
      </div>
      {nearby && modelled.length > 0 && modelled.every((g) => (nearby.get(g.group_id) ?? 0) === 0) ? (
        <p className="mt-1.5 text-ui text-muted sm:pl-[4.25rem]" data-testid="no-material-nearby">
          No material has nearby ISS tests here.
        </p>
      ) : null}
      </>
      ) : null}

      {showList && withNearby !== null ? (
        <Disclosure
          className="mt-2"
          summaryClassName="min-h-10"
          summary={
            <span className="text-ui">
              By material: <span className="font-semibold text-fg">{withNearby}</span> of <span className="font-semibold text-fg">{groups.length}</span> material setups have nearby ISS tests
            </span>
          }
          contentClassName="pl-0 sm:pl-5"
        >
          <p className="mb-2 text-ui text-muted">Pick a row to switch material. Grey rows have too few ISS tests for the model.</p>
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
            {all.map((g) => {
              const n = nearby?.get(g.group_id) ?? 0;
              const canPick = g.model_status === "modeled";
              const isSel = g.group_id === selectedId;
              const body = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-ui", canPick ? "text-fg" : "text-muted")}>{full(g)}</span>
                  </span>
                  <span className={cn("shrink-0 text-xs tabular", n > 0 ? "text-fg" : "text-muted")}>{countText(n)}{!canPick && n > 0 ? ", too few for the model" : ""}{!canPick && n === 0 ? <span className="sr-only">, too few for the model</span> : null}</span>
                  {canPick ? <Check aria-hidden className={cn("size-4 shrink-0", isSel ? "text-accent" : "text-transparent")} /> : <span className="w-4 shrink-0" aria-hidden />}
                </>
              );
              return (
                <li key={g.group_id}>
                  {canPick ? (
                    <button
                      type="button"
                      onClick={() => onChange(g.group_id)}
                      aria-pressed={isSel}
                      className={cn("flex min-h-10 w-full items-center gap-3 px-3 text-left transition-colors hover:bg-subtle focus-inset", isSel && "bg-accent-tint")}
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="flex min-h-10 items-center gap-3 bg-subtle/60 px-3" title="Too few ISS tests for the model">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Disclosure>
      ) : null}
    </div>
  );
}
