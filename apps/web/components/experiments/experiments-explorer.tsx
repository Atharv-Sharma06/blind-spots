"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Download, Search, X } from "lucide-react";
import { useExperiments, useGroups, useInvestigations } from "@/hooks/api";
import { exportExperimentsCsvHref } from "@/lib/api";
import { getDataMode } from "@/lib/snapshot";
import { fmtCount, fmtFixed, MISSING } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import type { ApiExperiment } from "@/lib/types";
import { ExperimentDrawer } from "./experiment-drawer";
import {
  ALL,
  EMPTY_FILTERS,
  activeFilterCount,
  airflowOf,
  applyFilters,
  configurationLabel,
  confidenceLabel,
  exclusionShort,
  exclusionText,
  experimentTitle,
  fmtAirflow,
  groupLabel,
  materialLabel,
  OUTCOME_DESCRIBED,
  outcomeBucket,
  outcomeLabel,
  outcomeShort,
  oxygenOf,
  pressureOf,
  snapshotCsvHref,
  sortRows,
  uniqueSorted,
  type Filters,
  type SortKey,
} from "./model";

const FILTER_KEYS = ["q", "investigation", "platform", "group", "outcome", "training", "confidence"] as const;

// Narrow screens scroll the table sideways; the first column stays put so each row keeps its name.
const STICKY = "max-md:sticky max-md:left-0 max-md:z-[1] max-md:bg-surface max-md:shadow-[inset_-1px_0_0_var(--border)]";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean; className?: string }[] = [
  { key: "experiment", label: "Experiment", className: STICKY },
  { key: "material", label: "Material" },
  { key: "configuration", label: "Configuration" },
  { key: "oxygen", label: "O₂ initial %", numeric: true },
  { key: "pressure", label: "Pressure kPa", numeric: true },
  { key: "airflow", label: "Airflow cm/s", numeric: true },
  { key: "outcome", label: "Outcome" },
  { key: "steps", label: "Steps", numeric: true, className: "max-xl:hidden" },
  { key: "quality", label: "Confidence", className: "max-xl:hidden" },
  { key: "training", label: "Training" },
];
const SORT_KEYS = new Set<string>(["experiment", "material", "configuration", "oxygen", "pressure", "airflow", "outcome", "steps", "quality", "training"]);

export function ExperimentsExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters: Filters = React.useMemo(() => {
    const f = { ...EMPTY_FILTERS };
    for (const k of FILTER_KEYS) f[k] = params.get(k) || EMPTY_FILTERS[k];
    return f;
  }, [params]);
  const selectedId = params.get("id");

  const setParams = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "" || v === ALL) next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  // Search box: local text, committed to the URL after a short pause.
  const [qText, setQText] = React.useState(filters.q);
  const [seenQ, setSeenQ] = React.useState(filters.q);
  if (seenQ !== filters.q) {
    setSeenQ(filters.q);
    setQText(filters.q);
  }
  React.useEffect(() => {
    if (qText === filters.q) return;
    const t = setTimeout(() => setParams({ q: qText.trim() ? qText : null }), 200);
    return () => clearTimeout(t);
  }, [qText, filters.q, setParams]);

  const exps = useExperiments();
  const invs = useInvestigations();
  const groups = useGroups();

  // Sort lives in the URL (?sort=&dir=) so a shared link keeps it; default experiment/asc is omitted.
  const sortParam = params.get("sort");
  const sort: { key: SortKey; dir: "asc" | "desc" } = {
    key: sortParam && SORT_KEYS.has(sortParam) ? (sortParam as SortKey) : "experiment",
    dir: params.get("dir") === "desc" ? "desc" : "asc",
  };
  const all = exps.data?.data;
  const rows = React.useMemo(() => (all ? sortRows(applyFilters(all, filters), sort.key, sort.dir) : []), [all, filters, sort.key, sort.dir]);

  const options = React.useMemo(() => {
    const rowsAll = all ?? [];
    const withAll = (label: string, vals: { value: string; label: string }[]) => [{ value: ALL, label }, ...vals];
    return {
      investigation: withAll(
        "All investigations",
        uniqueSorted(rowsAll.map((e) => e.investigation_id)).map((id) => ({
          value: id,
          label: `${rowsAll.find((e) => e.investigation_id === id)?.investigation_acronym ?? id} (${id})`,
        })),
      ),
      platform: withAll(
        "All platforms",
        uniqueSorted(rowsAll.map((e) => e.experimental_platform)).map((v) => ({ value: v, label: v })),
      ),
      group: withAll(
        "All groups",
        uniqueSorted(rowsAll.map((e) => e.group_id)).map((v) => ({ value: v, label: groupLabel(groups.data?.data, v) })),
      ),
      outcome: withAll(
        "All outcomes",
        uniqueSorted(rowsAll.map((e) => outcomeBucket(e.observed_outcome)))
          .map((v) => ({ value: v, label: v === OUTCOME_DESCRIBED ? "Described in words (Saffire)" : outcomeLabel(v) }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      ),
      training: [
        { value: ALL, label: "Any training status" },
        { value: "included", label: "Included in training" },
        { value: "excluded", label: "Excluded from training" },
      ],
      confidence: withAll(
        "Any confidence",
        ["high", "medium", "low"].map((v) => ({ value: v, label: confidenceLabel(v) })),
      ),
    };
  }, [all, groups.data]);

  // CSV export honours the filters the endpoint supports (investigation, group); others are applied only to the table.
  const exportQuery = React.useMemo(() => {
    const q: { investigation?: string; group?: string } = {};
    if (filters.investigation !== ALL) q.investigation = filters.investigation;
    if (filters.group !== ALL) q.group = filters.group;
    return q;
  }, [filters.investigation, filters.group]);
  // The link is built without downloading anything: a URL in live mode, a manifest lookup for the snapshot
  // (also when auto mode fell back to it). If the snapshot has no file for these filters, offer the full file.
  const fromSnapshot = getDataMode() === "snapshot" || exps.data?.meta.source === "snapshot";
  const [csv, setCsv] = React.useState<{ href: string; filtered: boolean } | null>(null);
  React.useEffect(() => {
    let live = true;
    const filtered = Object.keys(exportQuery).length > 0;
    const resolve = async () => {
      if (!fromSnapshot) return { href: (await exportExperimentsCsvHref(exportQuery)) ?? "", filtered };
      const h = await snapshotCsvHref(exportQuery);
      if (h) return { href: h, filtered };
      const full = filtered ? await snapshotCsvHref({}) : null;
      return full ? { href: full, filtered: false } : null;
    };
    resolve().then(
      (r) => live && setCsv(r && r.href ? r : null),
      () => live && setCsv(null),
    );
    return () => {
      live = false;
    };
  }, [exportQuery, fromSnapshot]);
  const csvHref = csv?.href ?? null;
  const csvPartial = !!csv && !csv.filtered && Object.keys(exportQuery).length > 0;
  const backendDown = exps.isError;
  const extraFilters = filters.q || filters.platform !== ALL || filters.outcome !== ALL || filters.training !== ALL || filters.confidence !== ALL;

  // Roving row focus.
  const [focusIdx, setFocusIdx] = React.useState(0);
  const bodyRef = React.useRef<HTMLTableSectionElement>(null);
  const focusRow = (i: number) => {
    const n = Math.max(0, Math.min(rows.length - 1, i));
    setFocusIdx(n);
    // Focus synchronously (the rows already exist) so key repeat never drops presses.
    bodyRef.current?.rows[n]?.focus();
  };
  const onRowKey = (e: React.KeyboardEvent, i: number, row: ApiExperiment) => {
    const move = (n: number) => {
      e.preventDefault();
      focusRow(n);
    };
    if (e.key === "ArrowDown") move(i + 1);
    else if (e.key === "ArrowUp") move(i - 1);
    else if (e.key === "PageDown") move(i + 10);
    else if (e.key === "PageUp") move(i - 10);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(rows.length - 1);
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setParams({ id: row.experiment_id });
    }
  };

  const toggleSort = (key: SortKey) => {
    const dir = sort.key === key && sort.dir === "asc" ? "desc" : "asc";
    setParams({ sort: key === "experiment" ? null : key, dir: dir === "asc" ? null : dir });
  };

  const filtersActive = activeFilterCount(filters) > 0;
  const clear = () => {
    setQText("");
    setParams(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])));
  };

  if (exps.isError && !all) {
    return <ErrorState code={exps.error.code} error={exps.error} message={exps.error.message} onRetry={() => void exps.refetch()} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2" role="search" aria-label="Filter experiments">
        <label className="relative block w-full sm:w-64">
          <span className="sr-only">Search label, material, notes</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Search label, material, notes"
            className="h-8 w-full rounded-md border border-border bg-surface pr-2.5 pl-8 text-[13px] text-fg placeholder:text-muted hover:border-border-strong"
          />
        </label>
        <FilterSelect label="Investigation" value={filters.investigation} options={options.investigation} onChange={(v) => setParams({ investigation: v })} />
        <FilterSelect label="Platform" value={filters.platform} options={options.platform} onChange={(v) => setParams({ platform: v })} wide />
        <FilterSelect label="Group" value={filters.group} options={options.group} onChange={(v) => setParams({ group: v })} wide />
        <FilterSelect label="Outcome" value={filters.outcome} options={options.outcome} onChange={(v) => setParams({ outcome: v })} />
        <FilterSelect label="Training" value={filters.training} options={options.training} onChange={(v) => setParams({ training: v })} />
        <FilterSelect label="Confidence" value={filters.confidence} options={options.confidence} onChange={(v) => setParams({ confidence: v })} />
        {filtersActive ? (
          <Button variant="ghost" onClick={clear}>
            <X aria-hidden /> Clear filters
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <p className="text-muted" aria-live="polite">
          {all ? (
            <>
              <span className="num text-fg">{fmtCount(rows.length)}</span> of <span className="num">{fmtCount(all.length)}</span> experiments
              {filtersActive ? " match" : ""} ·{" "}
              <span className="num">{fmtCount(rows.filter((r) => r.included_in_training).length)}</span> in training
            </>
          ) : (
            "Loading experiments"
          )}
        </p>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          {backendDown || !csvHref ? (
            <Tooltip content={backendDown ? "The data could not be loaded, so there is nothing to export." : "No export file is available in this version."}>
              <span tabIndex={0} className="inline-flex">
                <Button disabled aria-disabled="true" className="h-auto min-h-8 max-w-full whitespace-normal">
                  <Download aria-hidden /> Download normalized records (CSV)
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Tooltip
              content={
                csvPartial
                  ? "This version has no separate file for these filters, so the download contains every record."
                  : extraFilters
                    ? "The file follows the investigation and group filters; search, platform, outcome, training and confidence apply to the table only."
                    : "Normalized experiment records, one row per test."
              }
            >
              <Button asChild className="h-auto min-h-8 max-w-full whitespace-normal">
                <a href={csvHref} download="experiments.csv">
                  <Download aria-hidden /> {csvPartial ? "Download all normalized records (CSV)" : "Download normalized records (CSV)"}
                </a>
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {!all ? (
        <div className="space-y-1" role="status" aria-label="Loading experiments">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={<Search aria-hidden />}
            title="No experiments match these filters"
            description="Nothing in the integrated records matches the current search and filters."
            action={
              <Button onClick={clear}>
                <X aria-hidden /> Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <Table containerClassName="max-h-[calc(100dvh-15rem)] min-h-64" aria-label="Experiments" aria-rowcount={rows.length + 1}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((c) => {
                const active = sort.key === c.key;
                return (
                  <TableHead key={c.key} numeric={c.numeric} className={c.className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn("inline-flex items-center gap-1 rounded-sm hover:text-fg", active && "text-fg")}
                    >
                      {c.label}
                      {active ? sort.dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden /> : null}
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody ref={bodyRef}>
            {rows.map((e, i) => (
              <ExperimentRow
                key={e.experiment_id}
                e={e}
                groupName={groupLabel(groups.data?.data, e.group_id)}
                selected={e.experiment_id === selectedId}
                tabIndex={i === Math.min(focusIdx, rows.length - 1) ? 0 : -1}
                onKeyDown={(ev) => onRowKey(ev, i, e)}
                onOpen={() => {
                  setFocusIdx(i);
                  setParams({ id: e.experiment_id });
                }}
              />
            ))}
          </TableBody>
        </Table>
      )}

      <p className="text-xs text-muted">
        Arrow keys (and Page Up/Down) move between rows, Enter opens the record, Escape closes it. Pressure marked <em>assumed</em> was not recorded in the source.
        Missing values are shown as {MISSING}.
      </p>

      <ExperimentDrawer
        id={selectedId}
        known={all && selectedId ? all.some((r) => r.experiment_id === selectedId) : undefined}
        investigations={invs.data?.data}
        groups={groups.data?.data}
        onClose={() => setParams({ id: null })}
        onCloseAutoFocus={(ev) => {
          // The drawer is opened from a row click, not a Radix trigger: return focus to that row ourselves.
          const row = bodyRef.current?.querySelector<HTMLElement>('tr[tabindex="0"]');
          if (row) {
            ev.preventDefault();
            row.focus();
          }
        }}
      />
    </div>
  );
}

function FilterSelect(props: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  wide?: boolean;
}) {
  const { label, value, options, onChange, wide } = props;
  // Keep a URL value that is not (yet) in the option list selectable.
  const opts = options.some((o) => o.value === value) ? options : [...options, { value, label: value }];
  return (
    <div className={cn("w-40", wide && "sm:w-56")}>
      <Select aria-label={label} value={value} onValueChange={onChange} options={opts} />
    </div>
  );
}

function ExperimentRow(props: {
  e: ApiExperiment;
  groupName: string;
  selected: boolean;
  tabIndex: number;
  onKeyDown: (ev: React.KeyboardEvent) => void;
  onOpen: () => void;
}) {
  const { e, groupName, selected, tabIndex, onKeyDown, onOpen } = props;
  const p = pressureOf(e);
  const flags = e.quality_flags.length;
  const af = airflowOf(e);
  const sameName = e.test_label.startsWith(e.investigation_acronym);
  return (
    <TableRow
      tabIndex={tabIndex}
      data-state={selected ? "selected" : undefined}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      className="cursor-pointer focus-visible:outline-offset-[-2px]"
      aria-label={experimentTitle(e)}
    >
      <TableCell className={cn("whitespace-nowrap", STICKY)} title={`${e.test_label} · ${e.investigation_name}`}>
        <span className="flex max-w-56 items-baseline gap-1.5 overflow-hidden">
          <span className="num min-w-0 shrink truncate font-medium text-fg">{e.test_label}</span>
          {sameName ? null : <span className="min-w-0 max-w-28 shrink-[2] truncate text-muted">{e.investigation_acronym}</span>}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap" title={`Analysis group: ${groupName}`}>
        {materialLabel(e.material_family)}
      </TableCell>
      <TableCell className="whitespace-nowrap">{configurationLabel(e.flame_configuration)}</TableCell>
      <TableCell numeric>{fmtFixed(oxygenOf(e), 1)}</TableCell>
      <TableCell numeric className="whitespace-nowrap">
        {p.assumed ? <span className="mr-1.5 text-xs text-muted" title="Not recorded in the source; ISS cabin nominal assumed">assumed</span> : null}
        {fmtFixed(p.kpa, 1)}
      </TableCell>
      <TableCell numeric className="whitespace-nowrap" data-airflow={af.lo ?? ""}>
        {fmtAirflow(e)}
      </TableCell>
      <TableCell className="max-w-52 truncate" title={outcomeLabel(e.observed_outcome)}>
        {outcomeShort(e.observed_outcome)}
      </TableCell>
      <TableCell numeric className="max-xl:hidden">{e.n_observations}</TableCell>
      <TableCell className="whitespace-nowrap max-xl:hidden">
        {confidenceLabel(e.extraction_confidence)}
        {flags ? <span className="num text-muted"> · {flags} {flags === 1 ? "flag" : "flags"}</span> : null}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {e.included_in_training ? (
          <span>Included</span>
        ) : (
          <Tooltip content={exclusionText(e.exclusion_reason) || "Excluded from training"}>
            <span className="text-muted">
              Excluded{e.exclusion_reason ? <span className="text-xs"> · {exclusionShort(e.exclusion_reason)}</span> : null}
            </span>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
}
