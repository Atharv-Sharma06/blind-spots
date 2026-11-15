"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Slider } from "@/components/ui/slider";
import { Tooltip } from "@/components/ui/tooltip";
import { fmtFixed, fmtPair, fmtPsia, kpaToPsia, planeAxes } from "@/lib/format";
import { materialFullName } from "@/components/home/cabins";
import { CHART_OPTIONS, SHOW_HELP, heldHelp, heldLabel } from "./plain";
import type { LayerName, Layers } from "@/lib/explore-store";
import type { GroupSummary, Plane } from "@/lib/types";
import { groupBalance, SLICE_LIMITS } from "./model";

type Chip = { layer: LayerName; label: string; swatch: string; needsModel?: boolean };

/** Shown by default. */
const MAIN_CHIPS: Chip[] = [
  { layer: "observations", label: "Test results", swatch: "var(--observed)" },
  { layer: "prediction", label: "Prediction", swatch: "var(--fg)", needsModel: true },
  { layer: "coverage", label: "Coverage", swatch: "var(--gap)" },
];
/** Behind "More options". */
const MORE_CHIPS: Chip[] = [
  { layer: "uncertainty", label: "Uncertainty", swatch: "var(--plum-5)", needsModel: true },
  { layer: "context", label: "Related NASA work", swatch: "var(--muted)" },
];

/** A control's visible label plus its one short helper line (the helper is tied to the control with aria-describedby). */
export function ControlLabel({ id, label, helpId, help }: { id: string; label: string; helpId?: string; help?: string }) {
  return (
    <div className="mb-1">
      <p id={id} className="text-[13px] font-medium text-fg">{label}</p>
      {help ? <p id={helpId} className="mt-0.5 text-xs leading-snug text-muted">{help}</p> : null}
    </div>
  );
}

export function LayerChips({ layers, onToggle, modelled }: { layers: Layers; onToggle: (l: LayerName) => void; modelled: boolean }) {
  // Opens by default only when a "More options" layer the person chose (Uncertainty) is already on.
  const [more, setMore] = useState(layers.uncertainty);
  const moreId = useId();
  const chip = (c: Chip) => {
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
        title={SHOW_HELP[c.layer]}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-[13px] transition-colors md:h-8 md:px-2.5",
          on ? "border-fg bg-surface font-medium text-fg" : "border-border bg-subtle text-muted hover:text-fg",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <span aria-hidden className="size-2 rounded-full" style={{ background: c.swatch, opacity: on ? 1 : 0.45 }} />
        {c.label}
      </button>
    );
    return disabled ? (
      <Tooltip key={c.layer} content="Too few test results for a model.">
        <span tabIndex={0} className="inline-flex rounded-md">{btn}</span>
      </Tooltip>
    ) : (
      btn
    );
  };
  return (
    <div>
      <ControlLabel id="show-label" label="Show" />
      <div role="group" aria-labelledby="show-label" className="flex flex-wrap items-center gap-1.5">
        {MAIN_CHIPS.map(chip)}
        <button
          type="button"
          aria-expanded={more}
          aria-controls={moreId}
          onClick={() => setMore((v) => !v)}
          className="inline-flex h-10 items-center gap-1 rounded-md px-2 text-[13px] text-muted hover:text-fg md:h-8"
        >
          <span aria-hidden className={cn("inline-block transition-transform", more && "rotate-90")}>›</span>
          More options
        </button>
      </div>
      {more ? (
        <div id={moreId} role="group" aria-label="More options" className="mt-1.5 flex flex-wrap gap-1.5">
          {MORE_CHIPS.map(chip)}
        </div>
      ) : null}
    </div>
  );
}

export function PlaneSwitch({ plane, onChange }: { plane: Plane; onChange: (p: Plane) => void }) {
  return (
    <div>
      <ControlLabel id="chart-label" label="Chart" />
      <SegmentedControl aria-label="Chart" value={plane} onValueChange={(v) => onChange(v as Plane)} options={CHART_OPTIONS} />
    </div>
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

  const label = heldLabel(plane);
  const help = heldHelp(plane);

  if (snapValues && snapValues.length > 0) {
    return (
      <div className="w-full min-w-[150px] sm:w-[250px]">
        <ControlLabel id={id} label={label} helpId={`${id}-help`} help={help} />
        <Select
          aria-label={label}
          value={String(dedupeSlices(snapValues).reduce((b, v) => (Math.abs(v - value) < Math.abs(b - value) ? v : b), snapValues[0] as number))}
          onValueChange={(v) => onCommit(Number(v))}
          options={dedupeSlices(snapValues).map((v) => ({ value: String(v), label: `${fmtFixed(v, 1)} ${ax.unit}${plane === "o2_flow" ? ` (${fmtPsia(kpaToPsia(v))})` : ""}` }))}
        />
      </div>
    );
  }
  return (
    <div className="w-full min-w-[200px] sm:w-[250px]">
      <div className="flex items-baseline justify-between gap-2">
        <p id={id} className="text-[13px] font-medium text-fg">{label}</p>
        <span className="num text-xs text-fg" data-testid="slice-value">
          {fmtFixed(local, 1)} {ax.unit}
          {plane === "o2_flow" ? <span className="text-muted"> ({fmtPsia(kpaToPsia(local))})</span> : null}
        </span>
      </div>
      <p className="mt-0.5 mb-2 text-xs leading-snug text-muted">{help}</p>
      <Slider
        aria-labelledby={id}
        min={lim.min}
        max={lim.max}
        step={lim.step}
        value={[Math.min(lim.max, Math.max(lim.min, local))]}
        thumbLabels={[`${label}, ${ax.unit}`]}
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
    <div className="min-w-[220px] max-w-[460px] flex-[2_1_300px]">
      <ControlLabel id="material-label" label="Material" />
      <Select
        aria-label="Material"
        value={value ?? ""}
        onValueChange={onChange}
        options={groups.map((x) => ({
          value: x.group_id,
          label: `${materialFullName(x.group_id, x.label)}${x.model_status === "modeled" ? "" : " (no prediction)"}`,
        }))}
        placeholder={groups.length ? "Choose material" : "Loading…"}
      />
    </div>
  );
}

/** One plain line about the material. */
export function GroupFacts({ group }: { group: GroupSummary }) {
  const bal = groupBalance(group);
  const pr = group.pressure_kpa_range;
  const degenerate = pr ? fmtFixed(pr[0], 1) === fmtFixed(pr[1], 1) : false;
  const basis = group.pressure_measured ? "measured" : degenerate ? "assumed" : "partly assumed";
  return (
    <p className="text-xs text-muted" data-testid="group-facts">
      <span className="text-fg">{materialFullName(group.group_id, group.label)}</span>: <span className="num">{group.n_experiments}</span> experiments,{" "}
      <span className="num">{group.n_observations}</span> test results.
      {bal.n > 0 ? (
        <>
          {" "}{group.n_training < group.n_observations ? <>Of the <span className="num">{group.n_training}</span> the model uses, the</> : "The"} flame kept burning in <span className="num">{bal.sustained}</span> and went out in <span className="num">{bal.notSustained}</span>.
        </>
      ) : null}
      {pr ? (
        <>
          {" "}Pressure <span className="num">{degenerate ? `${fmtFixed(pr[0], 1)} kPa` : fmtPair(pr, "kPa", 1)}</span> ({basis}).
        </>
      ) : null}
    </p>
  );
}
