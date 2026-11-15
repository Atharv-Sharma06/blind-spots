"use client";

/**
 * Explore workspace state (zustand) + shareable-link sync (?group=&target=&plane=).
 * Runtime imports are limited to react/zustand so `node --test` can exercise the pure parts.
 */
import { useEffect } from "react";
import { create } from "zustand";
import type { AtmosphereProfile, CustomTarget, GroupSummary, HypotheticalOutcome, Plane, Range, Target } from "./types";

export type LayerName = "observations" | "coverage" | "prediction" | "uncertainty" | "target" | "candidates" | "context";
export type Layers = Record<LayerName, boolean>;
export type ViewDomain = { x: [number, number]; y: [number, number] };

/** UI constants (not data): initial slice values, per docs/API.md defaults. */
export const DEFAULT_SLICE = { o2_flow: 101.3, o2_pressure: 10 } as const;
/** UI constant: preferred starting target if the API lists it; validated against /api/targets before use. */
export const PREFERRED_TARGET_PROFILE_ID = "iss_cabin_nominal";
/** UI constant: preferred starting group if it is modelled; otherwise the modelled group with most training rows. */

export const DEFAULT_LAYERS: Layers = {
  observations: true,
  coverage: false,
  prediction: false,
  uncertainty: false,
  target: true,
  candidates: true,
  // Documented NASA tests that are not in the model (Saffire, drop tower, DARTFire): honest context, on by default.
  context: true,
};

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
  /** Applies data-driven defaults to unset/invalid group and target. Never overrides a valid choice. */
  initDefaults: (data: { groups?: readonly GroupSummary[] | null; profiles?: readonly AtmosphereProfile[] | null }) => void;
  /** Applies ?group=&target=&plane= values (see parseExploreQuery). */
  hydrate: (q: ParsedExploreQuery) => void;
  reset: () => void;
}

export type ExploreStore = ExploreState & ExploreActions;

const initialState = (): ExploreState => ({
  groupId: null,
  plane: "o2_flow",
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
});

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
  setSlice: (value, plane) => set((s) => ({ slice: { ...s.slice, [plane ?? s.plane]: value } })),
  setTarget: (target) => set({ target, ...clearedSelection() }),
  setLayer: (layer, on) => set((s) => ({ layers: { ...s.layers, [layer]: on } })),
  toggleLayer: (layer) => set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),
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
  initDefaults: ({ groups, profiles }) => {
    const s = get();
    const patch: Partial<ExploreState> = {};
    if (groups && groups.length > 0 && (s.groupId === null || !groups.some((g) => g.group_id === s.groupId))) {
      const g = pickDefaultGroup(groups);
      if (g) patch.groupId = g.group_id;
    }
    if (profiles && profiles.length > 0 && "profile_id" in s.target) {
      const id = s.target.profile_id;
      const valid = profiles.some((p) => p.profile_id === id && p.kind !== "envelope");
      if (!valid) {
        const p = pickDefaultProfile(profiles);
        if (p) patch.target = { profile_id: p.profile_id };
      }
    }
    if (Object.keys(patch).length > 0) set(patch);
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
  return usable.find((p) => p.profile_id === PREFERRED_TARGET_PROFILE_ID) ?? usable[0] ?? null;
}

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
