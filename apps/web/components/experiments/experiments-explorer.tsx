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
  configurationLabel,
  fmtAirflow,
  fmtPlain,
  isContextReason,
  materialLabel,
  pressureOf,
  oxygenOf,
  RESULT_FILTER_LABEL,
  resultFilterKey,
  resultOfExperiment,
  snapshotCsvHref,
  sortRows,
  sourceLabel,
  uniqueSorted,
  type Filters,
  type SortKey,
} from "./model";

const FILTER_KEYS = ["q", "material", "result"] as const;

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "material", label: "Material" },
  { key: "oxygen", label: "Oxygen", numeric: true },
  { key: "pressure", label: "Pressure", numeric: true },
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

function PressureValue({ e }: { e: ApiExperiment }) {
  const p = pressureOf(e);
  return (
    <>
      <Measure value={fmtPlain(p.kpa, 1)} unit="kPa" />
      {p.assumed ? (
        <span className="ml-1.5 text-xs text-muted" title="The NASA source does not record the pressure, so the documented ISS cabin pressure is assumed.">
          assumed
        </span>
      ) : null}
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
  const listSig = `${filters.q}|${filters.material}|${filters.result}|${sort.key}|${sort.dir}`;
  const [phoneLimit, setPhoneLimit] = React.useState({ sig: listSig, n: PHONE_PAGE });
  if (phoneLimit.sig !== listSig) setPhoneLimit({ sig: listSig, n: PHONE_PAGE });
  const phoneShown = phoneLimit.sig === listSig ? phoneLimit.n : PHONE_PAGE;

  const materials = React.useMemo(
    () =>
      uniqueSorted((all ?? []).map((e) => e.material_family))
        .map((v) => ({ value: v, label: `${materialLabel(v)} (${(all ?? []).filter((e) => e.material_family === v).length})` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [all],
  );
  const resultCounts = React.useMemo(() => {
    const c: Record<string, number> = { burned: 0, out: 0, steps: 0, other: 0 };
    for (const e of all ?? []) c[resultFilterKey(e)]! += 1;
    return c;
  }, [all]);

  // How many records are ISS glovebox tests and how many come from other apparatus (context only). Counted, never typed.
  const counts = React.useMemo(() => {
    const list = all ?? [];
    return {
      total: list.length,
      iss: list.filter((e) => /glovebox/i.test(e.experimental_platform ?? "")).length,
      context: list.filter((e) => isContextReason(e.exclusion_reason)).length,
      used: list.filter((e) => e.included_in_training).length,
    };
  }, [all]);

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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {all ? (
        <div className="max-w-[68ch] space-y-1.5 text-prose text-muted">
          <p>
            <span className="num text-fg">{fmtCount(counts.total)}</span> experiments in total.
            {counts.iss > 0 ? (
              <>
                {" "}
                <span className="num text-fg">{fmtCount(counts.iss)}</span> ran in the ISS glovebox
              </>
            ) : null}
            {counts.context > 0 ? (
              <>
                {counts.iss > 0 ? "; " : " "}
                <span className="num text-fg">{fmtCount(counts.context)}</span> come from other NASA apparatus and are shown for context only. The model does not use them
              </>
            ) : null}
            {counts.iss > 0 || counts.context > 0 ? "." : null}
          </p>
          {counts.used > 0 && counts.iss > 0 ? (
            <p>
              Each experiment has one or more airflow steps. The model counts each step as one test result
              {headline.data?.data.envelope.n_steps ? (
                <>
                  : <span className="num text-fg">{fmtCount(headline.data.data.envelope.n_steps)}</span> test results from{" "}
                  <span className="num text-fg">{fmtCount(counts.used)}</span> experiments
                </>
              ) : (
                <>
                  {" "}
                  (<span className="num text-fg">{fmtCount(counts.used)}</span> experiments are used)
                </>
              )}
              .
              {counts.iss > counts.used ? (
                <>
                  {" "}
                  The other <span className="num text-fg">{fmtCount(counts.iss - counts.used)}</span> ISS experiments are left out: no flame lit, or the airflow or outcome could not be read reliably.
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : (
        <Skeleton className="h-16 w-full max-w-[68ch]" />
      )}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]" role="search" aria-label="Filter experiments">
        <label className="relative col-span-2 block lg:col-span-1">
          <span className="sr-only">Search experiments</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Search material or experiment name"
            className={cn(FIELD, "pl-9")}
          />
        </label>
        <FilterSelect
          label="Material"
          value={filters.material}
          allLabel="All materials"
          options={materials}
          onChange={(v) => setParams({ material: v })}
        />
        <FilterSelect
          label="Result"
          value={filters.result}
          allLabel="All results"
          options={(["burned", "out", "steps", "other"] as const).map((k) => ({ value: k, label: `${RESULT_FILTER_LABEL[k]} (${resultCounts[k]})` }))}
          onChange={(v) => setParams({ result: v })}
        />
        {filtersActive ? (
          <Button variant="ghost" onClick={clear} className="col-span-2 h-10 md:h-9 lg:col-span-1">
            <X aria-hidden /> Clear filters
          </Button>
        ) : (
          <span className="hidden lg:block" />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-ui">
        <p className="text-muted" aria-live="polite">
          {all ? (
            <>
              Showing <span className="num text-fg">{fmtCount(rows.length)}</span> of <span className="num">{fmtCount(all.length)}</span> experiments
              <span className="hidden md:inline"> · click a row for the full record</span>
              <span className="md:hidden"> · tap an experiment for details</span>
            </>
          ) : (
            "Loading experiments"
          )}
        </p>
        <div className="flex w-full flex-wrap items-center justify-between gap-2 md:w-auto">
          <label className="flex items-center gap-2 text-muted md:hidden">
            <span className="whitespace-nowrap">Sort by</span>
            <span className="relative">
              <select
                aria-label="Sort by"
                value={sort.key}
                onChange={(e) => setSort(e.target.value as SortKey, "asc")}
                className="h-10 appearance-none rounded-md border border-border bg-surface pr-8 pl-3 text-prose text-fg"
              >
                {COLUMNS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
            </span>
          </label>
          {csvHref && !exps.isError ? (
            <Button asChild className="h-10 md:h-8">
              <a href={csvHref} download="experiments.csv" title="Every experiment in our data, one row per experiment, as a CSV file.">
                <Download aria-hidden /> Download all (CSV)
              </a>
            </Button>
          ) : (
            <Button disabled aria-disabled="true" className="h-10 md:h-8" title="No download is available right now.">
              <Download aria-hidden /> Download all (CSV)
            </Button>
          )}
        </div>
      </div>

      {!all ? (
        <div className="space-y-1" role="status" aria-label="Loading experiments">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={<Search aria-hidden />}
            title="No experiments match"
            description="Nothing in our data matches this search. Try fewer words or another material."
            action={
              <Button onClick={clear}>
                <X aria-hidden /> Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {/* Desktop: a plain table. */}
          <div className="hidden max-h-[calc(100dvh-17rem)] min-h-64 overflow-auto rounded-lg border border-border bg-surface md:block" role="region" aria-label="Experiments (scrollable)" tabIndex={0}>
            <table className="w-full table-fixed border-separate border-spacing-0 text-prose" aria-label="Experiments" aria-rowcount={rows.length + 1}>
              <colgroup>
                <col className="w-[25%]" />
                <col className="w-[9%]" />
                <col className="w-[13%]" />
                <col className="w-[15%]" />
                <col className="w-[22%]" />
                <col className="w-[16%]" />
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
                      <td className="border-b border-border px-4 py-2.5 align-top">
                        <span className="block font-medium text-fg">{materialLabel(e.material_family)}</span>
                        <span className="block text-xs text-muted">{configurationLabel(e.flame_configuration)}</span>
                      </td>
                      <td className="border-b border-border px-4 py-2.5 text-right align-top whitespace-nowrap">
                        <Measure value={fmtPlain(oxygenOf(e), 1)} unit="%" />
                      </td>
                      <td className="border-b border-border px-4 py-2.5 text-right align-top whitespace-nowrap">
                        <PressureValue e={e} />
                      </td>
                      <td className="border-b border-border px-4 py-2.5 text-right align-top whitespace-nowrap">
                        <Measure value={fmtAirflow(e)} unit="cm/s" />
                      </td>
                      <td className="border-b border-border px-4 py-2.5 align-top">
                        <ResultChip kind={r.kind} label={r.label} detail={r.detail} />
                      </td>
                      <td className="border-b border-border px-4 py-2.5 align-top whitespace-nowrap">
                        <a
                          href={e.source_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(ev) => ev.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-sm text-observed underline-offset-2 hover:underline"
                          title="Open the NASA record in a new tab"
                        >
                          {sourceLabel(e)}
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Phones: one card per test, no sideways scrolling. */}
          <ul className="flex flex-col gap-2 md:hidden" aria-label="Experiments">
            {rows.slice(0, phoneShown).map((e, i) => {
              const r = resultOfExperiment(e);
              return (
                <li
                  key={e.experiment_id}
                  data-state={e.experiment_id === selectedId ? "selected" : undefined}
                  className="overflow-hidden rounded-lg border border-border bg-surface data-[state=selected]:border-accent"
                >
                  <button type="button" data-exp-id={e.experiment_id} onClick={() => openRow(e, i)} className="block w-full px-3.5 py-3 text-left">
                    <span className="sr-only">Open details: </span>
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-prose font-medium text-fg">{materialLabel(e.material_family)}</span>
                        <span className="block text-xs text-muted">{configurationLabel(e.flame_configuration)}</span>
                      </span>
                    </span>
                    <span className="mt-2 block">
                      <ResultChip kind={r.kind} label={r.label} detail={r.detail} />
                    </span>
                    <span className="mt-2.5 grid grid-cols-[1fr_1fr_1.35fr] gap-2 text-ui">
                      <span>
                        <span className="block text-xs text-muted">Oxygen</span>
                        <Measure value={fmtPlain(oxygenOf(e), 1)} unit="%" />
                      </span>
                      <span>
                        <span className="block text-xs text-muted">Pressure</span>
                        <PressureValue e={e} />
                      </span>
                      <span>
                        <span className="block text-xs text-muted">Airflow</span>
                        <Measure value={fmtAirflow(e)} unit="cm/s" />
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center justify-between gap-2 border-t border-border bg-subtle/50 px-3.5 py-2 text-ui">
                    <span className="text-muted">Source</span>
                    <a
                      href={e.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center gap-1 rounded-sm text-observed underline-offset-2 hover:underline"
                    >
                      {sourceLabel(e)}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
          {rows.length > phoneShown ? (
            <div className="flex flex-col items-center gap-2 md:hidden">
              <p className="text-ui text-muted" aria-live="polite">
                <span className="num text-fg">{fmtCount(phoneShown)}</span> of <span className="num">{fmtCount(rows.length)}</span> experiments listed
              </p>
              <Button className="h-10 w-full" onClick={() => setPhoneLimit({ sig: listSig, n: phoneShown + PHONE_PAGE })}>
                Show {fmtCount(Math.min(PHONE_PAGE, rows.length - phoneShown))} more
              </Button>
            </div>
          ) : null}
        </>
      )}

      <p className="max-w-[72ch] text-xs text-muted">
        The result is our plain-words reading of NASA&apos;s notes; open an experiment to see the original text. A pressure marked <em>assumed</em> is not recorded in the
        NASA source, so we use the documented ISS cabin pressure. {MISSING} means the source does not give a value.
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
