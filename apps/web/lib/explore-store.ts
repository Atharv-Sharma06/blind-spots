"use client";

/**
 * Explore workspace state (zustand) + shareable-link sync (?group=&target=&plane=).
 * Runtime imports are limited to react/zustand so `node --test` can exercise the pure parts.
 */
import { useEffect } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { AtmosphereProfile, CustomTarget, GroupSummary, HypotheticalOutcome, Plane, Range, ResolvedTarget, Target } from "./types";

export type LayerName = "observations" | "coverage" | "prediction" | "uncertainty" | "target" | "candidates" | "context";
export type Layers = Record<LayerName, boolean>;
export type ViewDomain = { x: [number, number]; y: [number, number] };

/** UI constants (not data): initial slice values, per docs/API.md defaults. */
export const DEFAULT_SLICE = { o2_flow: 101.3, o2_pressure: 10 } as const;
/**
 * UI constant (LEAD_DECISIONS D1): the default view is the blind spot, NASA Exploration Atmosphere
 * (8.2 psia / 34 % O2) on the O2 x pressure plane. Validated against /api/targets before use.
 */
export const PREFERRED_TARGET_PROFILE_ID = "exploration_atmosphere_8p2_34";
/** UI constant: the ISS view, one click away from the default (finding strip). */
export const ISS_TARGET_PROFILE_ID = "iss_cabin_nominal";
export const DEFAULT_PLANE: Plane = "o2_pressure";

/** D1: observations + target + candidates + context (Saffire-V/VI etc. visible near the target). */
export const DEFAULT_LAYERS: Layers = {
  observations: true,
  coverage: false,
  prediction: false,
  uncertainty: false,
  target: true,
  candidates: true,
  context: true,
};

/** D3: only one surface layer at a time; turning one on turns the others off. */
export const SURFACE_LAYERS = ["prediction", "uncertainty", "coverage"] as const satisfies readonly LayerName[];
const isSurface = (l: LayerName): boolean => (SURFACE_LAYERS as readonly LayerName[]).includes(l);

/** Applies `on` to `layer`; a surface layer switched on switches the other surface layers off. */
export function withLayer(layers: Layers, layer: LayerName, on: boolean): Layers {
  const next: Layers = { ...layers, [layer]: on };
  if (on && isSurface(layer)) for (const o of SURFACE_LAYERS) if (o !== layer) next[o] = false;
  return next;
}

/** Snapshot slice lists (manifest.slices) when answers come from the precomputed snapshot. */
export type SnapSlices = { o2_flow?: readonly number[] | null; o2_pressure?: readonly number[] | null } | null;

function nearest(list: readonly number[] | null | undefined, v: number): number {
  if (!list || list.length === 0) return Math.round(v * 10) / 10;
  let best = list[0] as number;
  for (const x of list) if (Math.abs(x - v) < Math.abs(best - v)) best = x;
  return best;
}

/** Same rule as components/explore/model.ts targetSliceFor: nominal, else documented bound / band midpoint. */
function rangeAnchor(r: Range | null | undefined): number | null {
  if (!r) return null;
  return r.nominal ?? r.max ?? r.min ?? null;
}
function bandMid(r: Range | null | undefined): number | null {
  if (!r) return null;
  if (r.nominal !== null && r.nominal !== undefined) return r.nominal;
  return r.min !== null && r.max !== null && r.min > 0 && r.max > 0 ? Math.sqrt(r.min * r.max) : null;
}

/**
 * Slice values for a target, derived synchronously (no /target/assess round trip): o2_flow = the target
 * pressure; o2_pressure = the target airflow (documented band, else the analysis band from /api/targets
 * when the API provides it). A plane is null when it cannot be derived yet (then the resolved target
 * from /target/assess is used, see syncSliceToTarget).
 */
export function deriveTargetSlices(
  target: Target,
  ref: { profiles?: readonly AtmosphereProfile[] | null; analysisAirflow?: Range | null },
  snap: SnapSlices = null,
): { o2_flow: number | null; o2_pressure: number | null } {
  let pressure: Range | null = null;
  let airflow: Range | null = null;
  if ("custom" in target) {
    pressure = target.custom.total_pressure_kpa;
    airflow = target.custom.airflow_cm_s;
  } else {
    const p = ref.profiles?.find((x) => x.profile_id === target.profile_id);
    if (p) {
      pressure = p.total_pressure_kpa;
      airflow = p.airflow_cm_s && p.airflow_cm_s.min !== null && p.airflow_cm_s.max !== null ? p.airflow_cm_s : (p.analysis_airflow_cm_s ?? null);
    }
  }
  if (!airflow || bandMid(airflow) === null) airflow = ref.analysisAirflow ?? null;
  const pv = rangeAnchor(pressure);
  const fv = bandMid(airflow);
  return {
    o2_flow: pv === null ? null : nearest(snap?.o2_flow, pv),
    o2_pressure: fv === null ? null : nearest(snap?.o2_pressure, fv),
  };
}

export interface ExploreState {
  groupId: string | null;
  plane: Plane;
  /** o2_flow plane: pressure in kPa; o2_pressure plane: airflow in cm/s. */
  slice: { o2_flow: number; o2_pressure: number };
  target: Target;
  layers: Layers;
  selectedObservationId: string | null;
  selectedCandidateId: string | null;
  compareIds: [string | null, string | null];
  counterfactualOpen: boolean;
  hypotheticalOutcome: HypotheticalOutcome | null;
  /** null = fit to data / default axes. */
  viewDomain: ViewDomain | null;
  demo: { active: boolean; scene: number };
  /** Encoded target each plane's slice was last set for (by derivation or by the user); null = default. */
  sliceFor: { o2_flow: string | null; o2_pressure: string | null };
  /** Reference data for synchronous slice derivation (from /api/targets and the snapshot manifest). */
  reference: { profiles: readonly AtmosphereProfile[] | null; analysisAirflow: Range | null; snap: SnapSlices };
}

export interface ExploreActions {
  setGroup: (groupId: string | null) => void;
  setPlane: (plane: Plane) => void;
  /** Sets the slice for `plane` (default: the current plane). */
  setSlice: (value: number, plane?: Plane) => void;
  setTarget: (target: Target) => void;
  setLayer: (layer: LayerName, on: boolean) => void;
  toggleLayer: (layer: LayerName) => void;
  selectObservation: (id: string | null) => void;
  selectCandidate: (id: string | null) => void;
  /** Sets compare slot 0 or 1. */
  setCompare: (index: 0 | 1, id: string | null) => void;
  /** Adds the id to the first empty slot, or removes it if already present. */
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  setCounterfactualOpen: (open: boolean) => void;
  setHypotheticalOutcome: (outcome: HypotheticalOutcome | null) => void;
  setViewDomain: (domain: ViewDomain | null) => void;
  setDemo: (demo: Partial<ExploreState["demo"]>) => void;
  /** Turns on exactly these layers' given values (D3 exclusivity still applies to surfaces). */
  setLayers: (patch: Partial<Layers>) => void;
  /**
   * Applies data-driven defaults to unset/invalid group and target (never overrides a valid choice), stores
   * reference data and derives the slice for the target synchronously (so coverage, assess and rank start
   * in parallel). `slices` = manifest.slices when answers come from the snapshot (slices snap to them).
   */
  initDefaults: (data: {
    groups?: readonly GroupSummary[] | null;
    profiles?: readonly AtmosphereProfile[] | null;
    /** Analysis airflow band for targets without a documented one (e.g. /api/targets ventilation analysis band). */
    analysisAirflow?: Range | null;
    slices?: SnapSlices;
  }) => void;
  /** Snapshot slice lists (null when answering live); re-snaps the current slices. */
  setSnapSlices: (slices: SnapSlices) => void;
  /**
   * Fallback once /target/assess resolved the target: sets each plane's slice that has not yet been set
   * for this target (by derivation or by the user). Idempotent.
   */
  syncSliceToTarget: (resolved: ResolvedTarget | null | undefined) => void;
  /** Applies ?group=&target=&plane= values (see parseExploreQuery). */
  hydrate: (q: ParsedExploreQuery) => void;
  reset: () => void;
}

export type ExploreStore = ExploreState & ExploreActions;

const initialState = (): ExploreState => ({
  groupId: null,
  plane: DEFAULT_PLANE,
  slice: { ...DEFAULT_SLICE },
  target: { profile_id: PREFERRED_TARGET_PROFILE_ID },
  layers: { ...DEFAULT_LAYERS },
  selectedObservationId: null,
  selectedCandidateId: null,
  compareIds: [null, null],
  counterfactualOpen: false,
  hypotheticalOutcome: null,
  viewDomain: null,
  demo: { active: false, scene: 0 },
  sliceFor: { o2_flow: null, o2_pressure: null },
  reference: { profiles: null, analysisAirflow: null, snap: null },
});

/** Slice patch for `target` on every plane that can be derived now (marks those planes as set for it). */
function slicePatch(s: ExploreState, target: Target, onlyUnset: boolean): Partial<ExploreState> {
  const key = encodeTarget(target);
  const d = deriveTargetSlices(target, s.reference, s.reference.snap);
  const slice = { ...s.slice };
  const sliceFor = { ...s.sliceFor };
  let changed = false;
  for (const plane of ["o2_flow", "o2_pressure"] as const) {
    const v = d[plane];
    if (v === null) continue;
    if (onlyUnset && s.sliceFor[plane] === key) continue;
    if (slice[plane] !== v || sliceFor[plane] !== key) changed = true;
    slice[plane] = v;
    sliceFor[plane] = key;
  }
  return changed ? { slice, sliceFor } : {};
}

/** Clears everything derived from a particular group/target/candidate. */
const clearedSelection = (): Partial<ExploreState> => ({
  selectedCandidateId: null,
  compareIds: [null, null],
  counterfactualOpen: false,
  hypotheticalOutcome: null,
});

export const useExploreStore = create<ExploreStore>((set, get) => ({
  ...initialState(),
  setGroup: (groupId) => {
    if (get().groupId === groupId) return;
    set({ groupId, ...clearedSelection(), selectedObservationId: null, viewDomain: null });
  },
  setPlane: (plane) => {
    if (get().plane === plane) return;
    set({ plane, viewDomain: null, selectedObservationId: null });
  },
  setSlice: (value, plane) =>
    set((s) => {
      const p = plane ?? s.plane;
      return { slice: { ...s.slice, [p]: value }, sliceFor: { ...s.sliceFor, [p]: encodeTarget(s.target) } };
    }),
  setTarget: (target) =>
    set((s) => {
      const same = encodeTarget(s.target) === encodeTarget(target);
      return { target, ...clearedSelection(), ...(same ? {} : slicePatch({ ...s, target }, target, false)) };
    }),
  setLayer: (layer, on) => set((s) => (s.layers[layer] === on ? {} : { layers: withLayer(s.layers, layer, on) })),
  toggleLayer: (layer) => set((s) => ({ layers: withLayer(s.layers, layer, !s.layers[layer]) })),
  setLayers: (patch) =>
    set((s) => {
      let layers = s.layers;
      // Off first, then on, so an "on" surface wins exclusivity.
      for (const [k, v] of Object.entries(patch) as [LayerName, boolean][]) if (!v) layers = withLayer(layers, k, false);
      for (const [k, v] of Object.entries(patch) as [LayerName, boolean][]) if (v) layers = withLayer(layers, k, true);
      return { layers };
    }),
  selectObservation: (id) => set({ selectedObservationId: id }),
  selectCandidate: (id) => set({ selectedCandidateId: id, hypotheticalOutcome: null }),
  setCompare: (index, id) =>
    set((s) => {
      const next: [string | null, string | null] = [s.compareIds[0], s.compareIds[1]];
      next[index] = id;
      return { compareIds: next };
    }),
  toggleCompare: (id) =>
    set((s) => {
      const [a, b] = s.compareIds;
      if (a === id) return { compareIds: [null, b] };
      if (b === id) return { compareIds: [a, null] };
      if (a === null) return { compareIds: [id, b] };
      if (b === null) return { compareIds: [a, id] };
      return { compareIds: [a, id] }; // both full: replace the second slot
    }),
  clearCompare: () => set({ compareIds: [null, null] }),
  setCounterfactualOpen: (open) => set({ counterfactualOpen: open, ...(open ? {} : { hypotheticalOutcome: null }) }),
  setHypotheticalOutcome: (outcome) => set({ hypotheticalOutcome: outcome }),
  setViewDomain: (domain) => set({ viewDomain: domain }),
  setDemo: (demo) => set((s) => ({ demo: { ...s.demo, ...demo } })),
  initDefaults: ({ groups, profiles, analysisAirflow, slices }) => {
    const s = get();
    const patch: Partial<ExploreState> = {};
    const reference = {
      profiles: profiles && profiles.length > 0 ? profiles : s.reference.profiles,
      analysisAirflow: analysisAirflow !== undefined ? analysisAirflow : s.reference.analysisAirflow,
      snap: slices !== undefined ? slices : s.reference.snap,
    };
    if (
      reference.profiles !== s.reference.profiles ||
      reference.analysisAirflow !== s.reference.analysisAirflow ||
      reference.snap !== s.reference.snap
    ) {
      patch.reference = reference;
    }
    if (groups && groups.length > 0 && (s.groupId === null || !groups.some((g) => g.group_id === s.groupId))) {
      const g = pickDefaultGroup(groups);
      if (g) patch.groupId = g.group_id;
    }
    let target = s.target;
    if (profiles && profiles.length > 0 && "profile_id" in s.target) {
      const id = s.target.profile_id;
      const valid = profiles.some((p) => p.profile_id === id && p.kind !== "envelope");
      if (!valid) {
        const p = pickDefaultProfile(profiles);
        if (p) target = patch.target = { profile_id: p.profile_id };
      }
    }
    Object.assign(patch, slicePatch({ ...s, ...patch, reference }, target, true));
    if (Object.keys(patch).length > 0) set(patch);
  },
  setSnapSlices: (slices) =>
    set((s) => {
      if (s.reference.snap === slices) return {};
      const reference = { ...s.reference, snap: slices };
      const slice = { ...s.slice };
      if (slices) for (const plane of ["o2_flow", "o2_pressure"] as const) slice[plane] = nearest(slices[plane], slice[plane]);
      return { reference, slice };
    }),
  syncSliceToTarget: (resolved) => {
    if (!resolved) return;
    const s = get();
    const key = encodeTarget(s.target);
    const slice = { ...s.slice };
    const sliceFor = { ...s.sliceFor };
    let changed = false;
    for (const plane of ["o2_flow", "o2_pressure"] as const) {
      if (s.sliceFor[plane] === key) continue;
      const v = plane === "o2_flow" ? rangeAnchor(resolved.total_pressure_kpa) : bandMid(resolved.airflow_cm_s);
      if (v === null) continue;
      slice[plane] = nearest(s.reference.snap?.[plane], v);
      sliceFor[plane] = key;
      changed = true;
    }
    if (changed) set({ slice, sliceFor });
  },
  hydrate: (q) => {
    const patch: Partial<ExploreState> = {};
    if (q.group) patch.groupId = q.group;
    if (q.plane) patch.plane = q.plane;
    if (q.target) patch.target = q.target;
    if (Object.keys(patch).length > 0) set(patch);
  },
  reset: () => set(initialState()),
}));

// ---- Defaults (data-driven) ------------------------------------------------------------------------------

/** Default group: the API's data-driven default (is_default), else the modelled group with most training rows. */
export function pickDefaultGroup(groups: readonly GroupSummary[]): GroupSummary | null {
  const flagged = groups.find((g) => g.is_default);
  if (flagged) return flagged;
  const modelled = groups.filter((g) => g.model_status === "modeled");
  if (modelled.length > 0) return modelled.reduce((best, g) => (g.n_training > best.n_training ? g : best));
  // Nothing modelled: coverage-only exploration of the group with the most observations.
  if (groups.length > 0) return groups.reduce((best, g) => (g.n_observations > best.n_observations ? g : best));
  return null;
}

/** Profiles usable as analysis targets (the NASA-STD-3001 crew envelope is context only). */
export function analysisProfiles(profiles: readonly AtmosphereProfile[]): AtmosphereProfile[] {
  return profiles.filter((p) => p.kind !== "envelope");
}

export function pickDefaultProfile(profiles: readonly AtmosphereProfile[]): AtmosphereProfile | null {
  const usable = analysisProfiles(profiles);
  return (
    usable.find((p) => p.profile_id === PREFERRED_TARGET_PROFILE_ID) ??
    usable.find((p) => p.profile_id === ISS_TARGET_PROFILE_ID) ??
    usable[0] ??
    null
  );
}

// ---- Stable selectors (subscribe to fields, never to the whole store) --------------------------------------

/** Actions never change identity; read them without subscribing (no re-render on any state change). */
export const exploreActions = (): ExploreActions => useExploreStore.getState();

/** Current plane's slice value. */
export const useExploreSlice = (): number => useExploreStore((s) => s.slice[s.plane]);

/** The selection that drives the data queries (shallow-compared: re-renders only when one of these changes). */
export const useExploreSelection = () =>
  useExploreStore(useShallow((s) => ({ groupId: s.groupId, plane: s.plane, slice: s.slice[s.plane], target: s.target })));

/** Layer toggles (re-renders only on a layer change). */
export const useExploreLayers = (): Layers => useExploreStore((s) => s.layers);

/** Candidate selection / compare / counterfactual state. */
export const useExploreCandidateState = () =>
  useExploreStore(
    useShallow((s) => ({
      selectedCandidateId: s.selectedCandidateId,
      compareIds: s.compareIds,
      counterfactualOpen: s.counterfactualOpen,
      hypotheticalOutcome: s.hypotheticalOutcome,
    })),
  );

// ---- URL sync ----------------------------------------------------------------------------------------------

export interface ParsedExploreQuery {
  group?: string;
  plane?: Plane;
  target?: Target;
}

const CUSTOM_PREFIX = "custom:";

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64: string): string {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4);
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const isNumOrNull = (v: unknown): v is number | null => v === null || (typeof v === "number" && Number.isFinite(v));

function isRange(v: unknown): v is Range {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return isNumOrNull(r.nominal) && isNumOrNull(r.min) && isNumOrNull(r.max);
}

function isCustomTarget(v: unknown): v is CustomTarget {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return typeof c.label === "string" && isRange(c.oxygen_percent) && isRange(c.total_pressure_kpa) && (c.airflow_cm_s === null || isRange(c.airflow_cm_s));
}

/** `target` query value: a profile id, or `custom:<base64url(JSON)>`. */
export function encodeTarget(target: Target): string {
  return "profile_id" in target ? target.profile_id : CUSTOM_PREFIX + toBase64Url(JSON.stringify(target.custom));
}

export function decodeTarget(value: string): Target | null {
  if (!value) return null;
  if (!value.startsWith(CUSTOM_PREFIX)) return { profile_id: value };
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(value.slice(CUSTOM_PREFIX.length)));
    return isCustomTarget(parsed) ? { custom: parsed } : null;
  } catch {
    return null;
  }
}

export function parseExploreQuery(search: string): ParsedExploreQuery {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const out: ParsedExploreQuery = {};
  const group = p.get("group");
  if (group) out.group = group;
  const plane = p.get("plane");
  if (plane === "o2_flow" || plane === "o2_pressure") out.plane = plane;
  const target = p.get("target");
  if (target) {
    const t = decodeTarget(target);
    if (t) out.target = t;
  }
  return out;
}

/**
 * Returns `search` (with or without leading "?") with group/target/plane replaced by the state's values.
 * Other params (e.g. demo=1) are preserved. Result has no leading "?"; empty string when nothing remains.
 */
export function serializeExploreQuery(state: Pick<ExploreState, "groupId" | "plane" | "target">, search = ""): string {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  p.delete("group");
  p.delete("target");
  p.delete("plane");
  if (state.groupId) p.set("group", state.groupId);
  p.set("target", encodeTarget(state.target));
  p.set("plane", state.plane);
  return p.toString();
}

/**
 * Call once in the Explore page: reads ?group=&target=&plane= into the store on mount, then mirrors
 * store changes back into the URL with history.replaceState (shareable links; no navigation).
 */
export function useExploreUrlSync(): void {
  useEffect(() => {
    useExploreStore.getState().hydrate(parseExploreQuery(window.location.search));
    let last = "";
    const write = (s: ExploreState) => {
      const qs = serializeExploreQuery(s, window.location.search);
      if (qs === last || qs === window.location.search.replace(/^\?/, "")) {
        last = qs;
        return;
      }
      last = qs;
      try {
        window.history.replaceState(window.history.state, "", `${window.location.pathname}?${qs}${window.location.hash}`);
      } catch {
        /* history may be unavailable (sandboxed frames); the link just will not update */
      }
    };
    write(useExploreStore.getState());
    return useExploreStore.subscribe((s, prev) => {
      if (s.groupId !== prev.groupId || s.plane !== prev.plane || s.target !== prev.target) write(s);
    });
  }, []);
}
