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
      <div className="min-w-[160px]">
        <label id={id} className="mb-1 block text-xs text-muted">{ax.title} slice (snapshot values)</label>
        <Select
          aria-label={`${ax.title} slice`}
          value={String(snapValues.reduce((b, v) => (Math.abs(v - value) < Math.abs(b - value) ? v : b), snapValues[0] as number))}
          onValueChange={(v) => onCommit(Number(v))}
          options={snapValues.map((v) => ({ value: String(v), label: `${fmtFixed(v, 1)} ${ax.unit}` }))}
        />
      </div>
    );
  }
  return (
    <div className="min-w-[200px] flex-1">
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
  const g = groups.find((x) => x.group_id === value) ?? null;
  const bal = g ? groupBalance(g) : null;
  return (
    <div className="min-w-[220px] flex-1">
      <label className="mb-1 block text-xs text-muted" id="material-label">Material and flame configuration</label>
      <Select
        aria-label="Material and flame configuration"
        value={value ?? ""}
        onValueChange={onChange}
        options={groups.map((x) => ({
          value: x.group_id,
          label: `${x.label} · ${x.n_experiments} exp. · ${x.model_status === "modeled" ? "modelled" : "coverage only"}`,
        }))}
        placeholder="Select group"
      />
      {g ? (
        <p className="num mt-1 text-xs text-muted" data-testid="group-facts">
          {modelStatusLabel(g.model_status)} · {g.n_experiments} experiments, {g.n_observations} observations
          {bal && bal.n > 0 ? ` · ${g.n_training} training rows (${bal.sustained} sustained / ${bal.notSustained} not sustained; ${g.n_observations - g.n_training} not used for the model)` : ""}
          {g.pressure_kpa_range ? ` · pressure ${fmtPair(g.pressure_kpa_range, "kPa", 1)} (${g.pressure_measured ? "measured" : "partly assumed"})` : ""}
        </p>
      ) : null}
    </div>
  );
}
