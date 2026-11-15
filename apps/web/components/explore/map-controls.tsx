"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Slider } from "@/components/ui/slider";
import { Tooltip } from "@/components/ui/tooltip";
import { fmtFixed, fmtPair, fmtPsia, kpaToPsia, modelStatusLabel, planeAxes } from "@/lib/format";
import type { LayerName, Layers } from "@/lib/explore-store";
import type { GroupSummary, Plane } from "@/lib/types";
import { groupBalance, SLICE_LIMITS } from "./model";

const CHIPS: Array<{ layer: LayerName; label: string; swatch: string; needsModel?: boolean }> = [
  { layer: "observations", label: "Observed data", swatch: "var(--observed)" },
  { layer: "prediction", label: "Model prediction", swatch: "var(--fg)", needsModel: true },
  { layer: "uncertainty", label: "Uncertainty", swatch: "var(--plum-5)", needsModel: true },
  { layer: "coverage", label: "Coverage", swatch: "var(--gap)" },
  { layer: "context", label: "Context", swatch: "var(--muted)" },
];

export function LayerChips({ layers, onToggle, modelled }: { layers: Layers; onToggle: (l: LayerName) => void; modelled: boolean }) {
  return (
    <div role="group" aria-label="Map layers" className="flex flex-wrap gap-1.5">
      {CHIPS.map((c) => {
        const disabled = !!c.needsModel && !modelled;
        const on = layers[c.layer] && !disabled;
        const btn = (
          <button
            key={c.layer}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(c.layer)}
            data-testid={`layer-${c.layer}`}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors",
              on ? "border-fg bg-surface font-medium text-fg" : "border-border bg-subtle text-muted hover:text-fg",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <span aria-hidden className="size-2 rounded-full" style={{ background: c.swatch, opacity: on ? 1 : 0.45 }} />
            {c.label}
          </button>
        );
        return disabled ? (
          <Tooltip key={c.layer} content="This group has too few training observations for a model.">
            <span tabIndex={0} className="inline-flex rounded-md">{btn}</span>
          </Tooltip>
        ) : (
          btn
        );
      })}
    </div>
  );
}

export function PlaneSwitch({ plane, onChange }: { plane: Plane; onChange: (p: Plane) => void }) {
  return (
    <SegmentedControl
      aria-label="Map plane"
      value={plane}
      onValueChange={(v) => onChange(v as Plane)}
      options={[
        { value: "o2_flow", label: "O₂ × airflow" },
        { value: "o2_pressure", label: "O₂ × pressure" },
      ]}
    />
  );
}

/** Snapshot slices that print identically at 0.1 precision are one option (keeps the value with more decimals: the profile nominal). */
function dedupeSlices(values: number[]): number[] {
  const byLabel = new Map<string, number>();
  for (const v of values) {
    const k = v.toFixed(1);
    const prev = byLabel.get(k);
    if (prev === undefined || String(v).length > String(prev).length) byLabel.set(k, v);
  }
  return [...byLabel.values()].sort((a, b) => a - b);
}

export function SliceControl({
  plane,
  value,
  onCommit,
  snapValues,
}: {
  plane: Plane;
  value: number;
  onCommit: (v: number) => void;
  /** Snapshot mode: only these slices exist. */
  snapValues: number[] | null;
}) {
  const id = useId();
  const ax = planeAxes(plane).slice;
  const lim = SLICE_LIMITS[plane];
  const [draft, setDraft] = useState<number | null>(null);
  const local = draft ?? value;

  if (snapValues && snapValues.length > 0) {
    return (
      <div className="min-w-[150px]">
        <label id={id} className="mb-1 block text-xs text-muted">{ax.title} slice</label>
        <Select
          aria-label={`${ax.title} slice`}
          value={String(dedupeSlices(snapValues).reduce((b, v) => (Math.abs(v - value) < Math.abs(b - value) ? v : b), snapValues[0] as number))}
          onValueChange={(v) => onCommit(Number(v))}
          options={dedupeSlices(snapValues).map((v) => ({ value: String(v), label: `${fmtFixed(v, 1)} ${ax.unit}` }))}
        />
      </div>
    );
  }
  return (
    <div className="min-w-[200px] max-w-[320px] flex-1">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label id={id} className="text-xs text-muted">{ax.title} slice</label>
        <span className="num text-xs text-fg" data-testid="slice-value">
          {fmtFixed(local, 1)} {ax.unit}
          {plane === "o2_flow" ? <span className="text-muted"> ({fmtPsia(kpaToPsia(local))})</span> : null}
        </span>
      </div>
      <Slider
        aria-labelledby={id}
        min={lim.min}
        max={lim.max}
        step={lim.step}
        value={[Math.min(lim.max, Math.max(lim.min, local))]}
        thumbLabels={[`${ax.title} slice, ${ax.unit}`]}
        onValueChange={(v) => setDraft(v[0] ?? local)}
        onValueCommit={(v) => {
          setDraft(null);
          onCommit(v[0] ?? local);
        }}
      />
    </div>
  );
}

export function MaterialSelect({
  groups,
  value,
  onChange,
}: {
  groups: readonly GroupSummary[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="min-w-[220px] max-w-[400px] flex-[1_1_260px]">
      <label className="mb-1 block text-xs text-muted" id="material-label">Material and flame configuration</label>
      <Select
        aria-label="Material and flame configuration"
        value={value ?? ""}
        onValueChange={onChange}
        options={groups.map((x) => ({
          value: x.group_id,
          label: `${x.label} · ${x.n_experiments} exp. · ${x.model_status === "modeled" ? "modelled" : "coverage only"}`,
        }))}
        placeholder={groups.length ? "Select group" : "Loading groups…"}
      />
    </div>
  );
}

/** One sans line of group facts (numbers in mono only on the values). */
export function GroupFacts({ group }: { group: GroupSummary }) {
  const bal = groupBalance(group);
  const pr = group.pressure_kpa_range;
  const degenerate = pr ? fmtFixed(pr[0], 1) === fmtFixed(pr[1], 1) : false;
  const basis = group.pressure_measured ? "measured" : degenerate ? "assumed, not recorded" : "partly assumed";
  return (
    <p className="text-xs text-muted" data-testid="group-facts">
      <span className="text-fg">{group.label}</span> · {modelStatusLabel(group.model_status)} · <span className="num">{group.n_experiments}</span> experiments,{" "}
      <span className="num">{group.n_observations}</span> observations
      {bal.n > 0 ? (
        <>
          {" "}· <span className="num">{group.n_training}</span> training observations (<span className="num">{bal.sustained}</span> sustained /{" "}
          <span className="num">{bal.notSustained}</span> not sustained)
        </>
      ) : null}
      {pr ? (
        <>
          {" "}· pressure <span className="num">{degenerate ? `${fmtFixed(pr[0], 1)} kPa` : fmtPair(pr, "kPa", 1)}</span> ({basis})
        </>
      ) : null}
    </p>
  );
}
