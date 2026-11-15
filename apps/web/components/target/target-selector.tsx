"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/cn";
import { useTargets, useDataMode } from "@/hooks/api";
import { useExploreStore, analysisProfiles } from "@/lib/explore-store";
import { fmtPressure, fmtRange } from "@/lib/format";
import { pressureAnchor } from "@/components/explore/model";
import { shortCabinName } from "@/components/home/cabins";
import type { AtmosphereProfile, CustomTarget } from "@/lib/types";

export const CUSTOM_LABEL = "User-selected hypothetical conditions";

const STATUS_ORDER: Array<{ status: string; title: string }> = [
  { status: "documented_nasa", title: "NASA cabins" },
  { status: "nasa_design_recommendation", title: "Recommended designs" },
  { status: "historical_nasa", title: "Earlier cabins" },
];

const KPA_PER_PSI = 6.894757293168361;

function profileConditions(p: AtmosphereProfile): string {
  const o2 = fmtRange({ ...p.oxygen_percent, min: null, max: p.oxygen_percent.nominal === null ? p.oxygen_percent.max : null }, "% O₂");
  const pa = pressureAnchor(p.total_pressure_kpa);
  return `${o2} · ${fmtPressure(pa)}`;
}

function profileSourceLink(p: AtmosphereProfile) {
  const s = p.sources.find((x) => x.url);
  return s?.url ? { url: s.url, title: s.title } : null;
}

export function TargetSelector({ className }: { className?: string } = {}) {
  const targets = useTargets();
  const dm = useDataMode();
  const target = useExploreStore((s) => s.target);
  const setTarget = useExploreStore((s) => s.setTarget);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "custom">("list");

  const profiles = useMemo(() => targets.data?.data.profiles ?? [], [targets.data]);
  const usable = useMemo(() => analysisProfiles(profiles), [profiles]);
  const envelope = profiles.filter((p) => p.kind === "envelope");
  const current = "profile_id" in target ? profiles.find((p) => p.profile_id === target.profile_id) : null;
  const currentLabel = "custom" in target ? CUSTOM_LABEL : (current ? shortCabinName(current.profile_id, current.name) : null) ?? (targets.isPending ? "Loading cabins…" : "Select a cabin");

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setView("list");
      }}
    >
      <SheetTrigger asChild>
        <Button variant="secondary" size="md" className={cn("max-w-full min-w-0 shrink justify-between gap-2 rounded-full border border-border bg-surface text-fg", className)} data-testid="target-selector">
          <span className="truncate font-medium">{currentLabel}</span>
          <span className="sr-only">, change cabin</span>
          <ChevronDown aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent title={view === "list" ? "Choose a cabin" : "Custom conditions"} description={view === "list" ? "Pick the air to check against ISS tests." : CUSTOM_LABEL}>
        {view === "list" ? (
          <div className="space-y-5">
            {targets.isError ? <Callout variant="warning" title="Could not load cabins">The analysis service did not respond.</Callout> : null}
            {STATUS_ORDER.map(({ status, title }) => {
              const list = usable.filter((p) => p.status === status);
              if (list.length === 0) return null;
              return (
                <section key={status} aria-label={title}>
                  <h3 className="eyebrow mb-2 text-muted">{title}</h3>
                  <ul className="card divide-y divide-border overflow-hidden">
                    {list.map((p) => {
                      const selected = "profile_id" in target && target.profile_id === p.profile_id;
                      const src = profileSourceLink(p);
                      return (
                        <li key={p.profile_id} className={cn("flex items-stretch", selected && "bg-subtle shadow-[inset_3px_0_0_var(--fg)]")}>
                          <button
                            type="button"
                            aria-pressed={selected}
                            onClick={() => {
                              setTarget({ profile_id: p.profile_id });
                              setOpen(false);
                            }}
                            className="min-h-12 min-w-0 flex-1 px-5 py-3 text-left hover:bg-subtle focus-visible:relative"
                          >
                            <span className="block text-[15px] font-medium text-fg">{shortCabinName(p.profile_id, p.name)}</span>
                            <span className="num mt-0.5 block text-xs text-muted">{profileConditions(p)}</span>
                          </button>
                          {src ? (
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              aria-label={`Source for ${shortCabinName(p.profile_id, p.name)}`}
                              className="flex min-w-11 items-center justify-center px-3 text-xs text-muted hover:text-fg"
                            >
                              <ExternalLink className="size-3.5" aria-hidden />
                            </a>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            {envelope.length > 0 ? (
              <section aria-label="Context only">
                <h3 className="eyebrow mb-2 text-muted">Context only</h3>
                <ul className="rounded-2xl border border-dashed border-border-strong bg-subtle">
                  {envelope.map((p) => (
                    <li key={p.profile_id} className="px-5 py-3">
                      <span className="block text-[15px] text-muted">{shortCabinName(p.profile_id, p.name)}</span>
                      <span className="mt-0.5 block text-xs text-muted">Crew-safety range. Not checked here.</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <section aria-label="Custom conditions">
              <h3 className="eyebrow mb-2 text-muted">Your own</h3>
              <Button variant="secondary" onClick={() => setView("custom")} disabled={dm.isSnapshot} className="w-full justify-start">
                Enter your own air…
              </Button>
              {dm.isSnapshot ? (
                <p className="mt-1.5 text-xs text-muted">Your own air is not available in this saved version.</p>
              ) : null}
            </section>
          </div>
        ) : (
          <CustomTargetForm
            onCancel={() => setView("list")}
            onApply={(c) => {
              setTarget({ custom: c });
              setOpen(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function CustomTargetForm({ onCancel, onApply }: { onCancel: () => void; onApply: (c: CustomTarget) => void }) {
  const id = useId();
  const [o2, setO2] = useState("21");
  const [pressure, setPressure] = useState("101.3");
  const [unit, setUnit] = useState<"kpa" | "psia">("kpa");
  const [fmin, setFmin] = useState("");
  const [fmax, setFmax] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const o2v = Number(o2);
    const pv = Number(pressure);
    if (!o2.trim() || !Number.isFinite(o2v) || o2v < 1 || o2v > 100) return setErr("Oxygen must be 1 to 100 %.");
    const pkpa = unit === "kpa" ? pv : pv * KPA_PER_PSI;
    if (!pressure.trim() || !Number.isFinite(pkpa) || pkpa < 5 || pkpa > 300) return setErr("Pressure must be 5 to 300 kPa (0.7 to 43.5 psia).");
    let airflow: CustomTarget["airflow_cm_s"] = null;
    if (fmin.trim() || fmax.trim()) {
      const lo = Number(fmin);
      const hi = Number(fmax);
      if (!fmin.trim() || !fmax.trim() || !Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0 || hi <= lo) return setErr("Airflow: enter a minimum above 0 and a larger maximum, or leave both empty.");
      airflow = { nominal: null, min: lo, max: hi };
    }
    setErr(null);
    onApply({
      label: CUSTOM_LABEL,
      oxygen_percent: { nominal: o2v, min: null, max: null },
      total_pressure_kpa: { nominal: Math.round(pkpa * 1000) / 1000, min: null, max: null },
      airflow_cm_s: airflow,
    });
  };

  const field = "num h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-[15px] text-fg hover:border-border-strong";
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <span className="inline-flex min-h-7 items-center rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-fg">{CUSTOM_LABEL}</span>
      <div>
        <label htmlFor={`${id}-o2`} className="mb-1 block text-xs text-muted">Oxygen (%)</label>
        <input id={`${id}-o2`} inputMode="decimal" className={field} value={o2} onChange={(e) => setO2(e.target.value)} />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor={`${id}-p`} className="text-xs text-muted">Total pressure</label>
          <SegmentedControl
            size="sm"
            aria-label="Pressure unit"
            value={unit}
            onValueChange={(v) => {
              const next = v as "kpa" | "psia";
              const n = Number(pressure);
              if (Number.isFinite(n) && pressure.trim()) setPressure((next === "psia" ? n / KPA_PER_PSI : n * KPA_PER_PSI).toFixed(next === "psia" ? 2 : 1));
              setUnit(next);
            }}
            options={[{ value: "kpa", label: "kPa" }, { value: "psia", label: "psia" }]}
          />
        </div>
        <input id={`${id}-p`} inputMode="decimal" className={field} value={pressure} onChange={(e) => setPressure(e.target.value)} />
      </div>
      <fieldset>
        <legend className="mb-1 text-xs text-muted">Airflow (cm/s), optional</legend>
        <div className="grid grid-cols-2 gap-2">
          <input aria-label="Airflow minimum, cm/s" placeholder="min" inputMode="decimal" className={field} value={fmin} onChange={(e) => setFmin(e.target.value)} />
          <input aria-label="Airflow maximum, cm/s" placeholder="max" inputMode="decimal" className={field} value={fmax} onChange={(e) => setFmax(e.target.value)} />
        </div>
        <p className="mt-1 text-xs text-muted">Empty uses the standard cabin airflow range.</p>
      </fieldset>
      {err ? <p role="alert" className="text-[13px] text-warn">{err}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="primary">Check this air</Button>
        <Button variant="ghost" onClick={onCancel}>Back</Button>
      </div>
    </form>
  );
}
