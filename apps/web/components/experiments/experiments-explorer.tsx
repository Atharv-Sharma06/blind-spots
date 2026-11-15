"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, Download, ExternalLink, Search, X } from "lucide-react";
import { useExperiments, useGroups, useHeadline, useInvestigations } from "@/hooks/api";
import { exportExperimentsCsvHref } from "@/lib/api";
import { getDataMode } from "@/lib/snapshot";
import { fmtCount, MISSING } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import type { ApiExperiment } from "@/lib/types";
import { ExperimentDrawer } from "./experiment-drawer";
import { ResultChip } from "./result-chip";
import {
  ALL,
  EMPTY_FILTERS,
  activeFilterCount,
  applyFilters,
  fmtAirflow,
  fmtPlain,
  materialLabel,
  oxygenOf,
  RESULT_FILTER_LABEL,
  resultOfExperiment,
  snapshotCsvHref,
  sortRows,
  sourceLabel,
  type Filters,
  type SortKey,
} from "./model";

const FILTER_KEYS = ["q", "result"] as const;

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "material", label: "Material" },
  { key: "oxygen", label: "Oxygen", numeric: true },
  { key: "airflow", label: "Airflow", numeric: true },
  { key: "result", label: "Result" },
  { key: "source", label: "Source" },
];
const SORT_KEYS = new Set<string>(COLUMNS.map((c) => c.key));

/** Phones show the experiments 25 at a time so the page does not turn into a 60,000 px scroll. */
const PHONE_PAGE = 25;

const FIELD =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-prose text-fg placeholder:text-muted hover:border-border-strong md:h-9 md:text-ui";

/** Value with its unit in muted text; "—" (missing) has no unit. */
function Measure({ value, unit }: { value: string; unit: string }) {
  if (value === MISSING) return <span className="text-muted">{MISSING}</span>;
  return (
    <>
      <span className="num">{value}</span> <span className="text-xs text-muted">{unit}</span>
    </>
  );
}

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
  const headline = useHeadline();

  // Sort lives in the URL (?sort=&dir=); the default (source, ascending) is omitted.
  const sortParam = params.get("sort");
  const sort: { key: SortKey; dir: "asc" | "desc" } = {
    key: sortParam && SORT_KEYS.has(sortParam) ? (sortParam as SortKey) : "source",
    dir: params.get("dir") === "desc" ? "desc" : "asc",
  };
  const all = exps.data?.data;
  const rows = React.useMemo(() => (all ? sortRows(applyFilters(all, filters), sort.key, sort.dir) : []), [all, filters, sort.key, sort.dir]);

  // Phone list length: starts at one page and resets whenever the search, filters or sort change.
  const listSig = `${filters.q}|${filters.result}|${sort.key}|${sort.dir}`;
  const [phoneLimit, setPhoneLimit] = React.useState({ sig: listSig, n: PHONE_PAGE });
  if (phoneLimit.sig !== listSig) setPhoneLimit({ sig: listSig, n: PHONE_PAGE });
  const phoneShown = phoneLimit.sig === listSig ? phoneLimit.n : PHONE_PAGE;

  // Counted from the records, never typed: all experiments, and how many the model uses.
  const total = all?.length ?? 0;
  const used = React.useMemo(() => (all ?? []).filter((e) => e.included_in_training).length, [all]);
  const steps = headline.data?.data.envelope.n_steps;

  // CSV: always the whole normalized file (the export endpoint cannot follow these filters). The link is built without
  // downloading anything: a URL in live mode, a manifest lookup for the snapshot (also when auto mode fell back to it).
  const fromSnapshot = getDataMode() === "snapshot" || exps.data?.meta.source === "snapshot";
  const [csvHref, setCsvHref] = React.useState<string | null>(null);
  React.useEffect(() => {
    let live = true;
    const resolve = async () => (fromSnapshot ? await snapshotCsvHref({}) : await exportExperimentsCsvHref({}));
    resolve().then(
      (h) => live && setCsvHref(h || null),
      () => live && setCsvHref(null),
    );
    return () => {
      live = false;
    };
  }, [fromSnapshot]);

  // Roving row focus on the desktop table; `lastOpened` lets phones return focus to the card that opened the drawer.
  const [focusIdx, setFocusIdx] = React.useState(0);
  const lastOpened = React.useRef<string | null>(null);
  const bodyRef = React.useRef<HTMLTableSectionElement>(null);
  const focusRow = (i: number) => {
    const n = Math.max(0, Math.min(rows.length - 1, i));
    setFocusIdx(n);
    bodyRef.current?.rows[n]?.focus();
  };
  const onRowKey = (e: React.KeyboardEvent, i: number, row: ApiExperiment) => {
    if (e.target !== e.currentTarget) return; // keys on the Source link keep their own meaning
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
      lastOpened.current = row.experiment_id;
      setFocusIdx(i);
      setParams({ id: row.experiment_id });
    }
  };

  const setSort = (key: SortKey, dir: "asc" | "desc") => setParams({ sort: key === "source" ? null : key, dir: dir === "asc" ? null : dir });
  const toggleSort = (key: SortKey) => setSort(key, sort.key === key && sort.dir === "asc" ? "desc" : "asc");

  const filtersActive = activeFilterCount(filters) > 0;
  const clear = () => {
    setQText("");
    setParams(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])));
  };

  if (exps.isError && !all) {
    return <ErrorState code={exps.error.code} error={exps.error} message={exps.error.message} onRetry={() => void exps.refetch()} />;
  }

  const openRow = (e: ApiExperiment, i: number) => {
    lastOpened.current = e.experiment_id;
    setFocusIdx(i);
    setParams({ id: e.experiment_id });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:grid-cols-[minmax(0,1fr)_14rem_auto]" role="search" aria-label="Filter experiments">
        <label className="relative col-span-2 block md:col-span-1">
          <span className="sr-only">Search experiments</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" value={qText} onChange={(e) => setQText(e.target.value)} placeholder="Search by material" className={cn(FIELD, "pl-9")} />
        </label>
        <FilterSelect
          label="Result"
          value={filters.result}
          allLabel="Any result"
          options={(["burned", "out", "steps", "other"] as const).map((k) => ({ value: k, label: RESULT_FILTER_LABEL[k]! }))}
          onChange={(v) => setParams({ result: v })}
        />
        {csvHref && !exps.isError ? (
          <Button asChild className="h-10 md:h-9">
            <a href={csvHref} download="experiments.csv" title="Every experiment in our data, as a CSV file.">
              <Download aria-hidden /> Download all (CSV)
            </a>
          </Button>
        ) : (
          <Button disabled aria-disabled="true" className="h-10 md:h-9" title="No download is available right now.">
            <Download aria-hidden /> Download all (CSV)
          </Button>
        )}
      </div>

      <p className="flex flex-wrap items-center gap-x-3 text-ui text-muted" aria-live="polite">
        {!all ? (
          "Loading experiments"
        ) : filtersActive ? (
          <>
            <span>
              <span className="num text-fg">{fmtCount(rows.length)}</span> of <span className="num">{fmtCount(total)}</span> experiments
            </span>
            <Button variant="ghost" onClick={clear} className="h-10 md:h-8">
              <X aria-hidden /> Clear
            </Button>
          </>
        ) : (
          <span>
            <span className="num text-fg">{fmtCount(total)}</span> experiments.
            {used > 0 ? (
              <>
                {" "}
                The model uses <span className="num text-fg">{fmtCount(used)}</span>
                {steps ? (
                  <>
                    {" "}
                    (<span className="num text-fg">{fmtCount(steps)}</span> test results)
                  </>
                ) : null}
                .
              </>
            ) : null}
          </span>
        )}
      </p>

      {!all ? (
        <div className="space-y-1" role="status" aria-label="Loading experiments">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={<Search aria-hidden />}
            title="No experiments match"
            description="Try a different word."
            action={
              <Button onClick={clear}>
                <X aria-hidden /> Clear
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {/* Desktop: a plain table. */}
          <div className="hidden max-h-[calc(100dvh-15rem)] min-h-64 overflow-auto rounded-lg border border-border bg-surface md:block" role="region" aria-label="Experiments (scrollable)" tabIndex={0}>
            <table className="w-full table-fixed border-separate border-spacing-0 text-prose" aria-label="Experiments" aria-rowcount={rows.length + 1}>
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[12%]" />
                <col className="w-[16%]" />
                <col className="w-[24%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead>
                <tr>
                  {COLUMNS.map((c) => {
                    const active = sort.key === c.key;
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                        className={cn("sticky top-0 z-10 h-10 border-b border-border bg-subtle px-4 text-left text-ui font-medium text-muted", c.numeric && "text-right")}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className={cn("inline-flex items-center gap-1 rounded-sm hover:text-fg", active && "text-fg")}
                        >
                          {c.label}
                          {active ? sort.dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden /> : null}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody ref={bodyRef}>
                {rows.map((e, i) => {
                  const r = resultOfExperiment(e);
                  return (
                    <tr
                      key={e.experiment_id}
                      tabIndex={i === Math.min(focusIdx, rows.length - 1) ? 0 : -1}
                      data-state={e.experiment_id === selectedId ? "selected" : undefined}
                      onClick={() => openRow(e, i)}
                      onKeyDown={(ev) => onRowKey(ev, i, e)}
                      aria-label={`${materialLabel(e.material_family)}, ${sourceLabel(e)}`}
                      className="cursor-pointer transition-colors hover:bg-subtle/60 focus-visible:outline-offset-[-2px] data-[state=selected]:bg-accent-tint [&:last-child>td]:border-b-0"
                    >
                      <td className="border-b border-border px-4 py-2 align-top">
                        <span className="block font-medium text-fg">{materialLabel(e.material_family)}</span>
                      </td>
                      <td className="border-b border-border px-4 py-2 text-right align-top whitespace-nowrap">
                        <Measure value={fmtPlain(oxygenOf(e), 1)} unit="%" />
                      </td>
                      <td className="border-b border-border px-4 py-2 text-right align-top whitespace-nowrap">
                        <Measure value={fmtAirflow(e)} unit="cm/s" />
                      </td>
                      <td className="border-b border-border px-4 py-2 align-top">
                        <ResultChip kind={r.kind} label={r.label} />
                      </td>
                      <td className="max-w-[16rem] border-b border-border px-4 py-2 align-top">
                        <a
                          href={e.source_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(ev) => ev.stopPropagation()}
                          className="inline-flex max-w-full items-center gap-1 rounded-sm text-observed underline-offset-2 hover:underline"
                          title="Open the NASA record in a new tab"
                        >
                          <span className="truncate" title={sourceLabel(e)}>
                            {sourceLabel(e)}
                          </span>
                          <ExternalLink className="size-3 shrink-0" aria-hidden />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Phones: one compact line per experiment, shown 25 at a time. Source link is in the details. */}
          <ul className="flex flex-col gap-1.5 md:hidden" aria-label="Experiments">
            {rows.slice(0, phoneShown).map((e, i) => {
              const r = resultOfExperiment(e);
              return (
                <li
                  key={e.experiment_id}
                  data-state={e.experiment_id === selectedId ? "selected" : undefined}
                  className="overflow-hidden rounded-lg border border-border bg-surface data-[state=selected]:border-accent"
                >
                  <button type="button" data-exp-id={e.experiment_id} onClick={() => openRow(e, i)} className="block min-h-14 w-full px-3.5 py-2.5 text-left">
                    <span className="sr-only">Open details: </span>
                    <span className="block text-prose font-medium text-fg">{materialLabel(e.material_family)}</span>
                    <span className="mt-1 flex flex-col items-start gap-1 text-ui">
                      <ResultChip kind={r.kind} label={r.label} />
                      <span className="text-muted">
                        <Measure value={fmtPlain(oxygenOf(e), 1)} unit="% oxygen" /> · <Measure value={fmtAirflow(e)} unit="cm/s" />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {rows.length > phoneShown ? (
            <div className="flex flex-col items-center gap-2 md:hidden">
              <p className="text-ui text-muted" aria-live="polite">
                Showing <span className="num text-fg">{fmtCount(phoneShown)}</span> of <span className="num">{fmtCount(rows.length)}</span>
              </p>
              <Button className="h-10 w-full" onClick={() => setPhoneLimit({ sig: listSig, n: phoneShown + PHONE_PAGE })}>
                Show {fmtCount(Math.min(PHONE_PAGE, rows.length - phoneShown))} more
              </Button>
            </div>
          ) : null}
        </>
      )}

      <p className="max-w-[72ch] text-xs text-muted">
        Results are our reading of NASA&apos;s notes; open one for the original and its source. The model skips experiments from other apparatus or with unclear results.{" "}
        {MISSING} means not given.
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
          if (row && row.offsetParent !== null) {
            ev.preventDefault();
            row.focus();
            return;
          }
          const card = Array.from(document.querySelectorAll<HTMLElement>("button[data-exp-id]")).find((b) => b.dataset.expId === lastOpened.current);
          if (card && card.offsetParent !== null) {
            ev.preventDefault();
            card.focus();
          }
        }}
      />
    </div>
  );
}

function FilterSelect(props: {
  label: string;
  value: string;
  allLabel: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const { label, value, allLabel, options, onChange } = props;
  // Keep a URL value that is not (yet) in the option list selectable.
  const opts = options.some((o) => o.value === value) || value === ALL ? options : [...options, { value, label: value }];
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cn(FIELD, "appearance-none pr-9")}>
        <option value={ALL}>{allLabel}</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </label>
  );
}
