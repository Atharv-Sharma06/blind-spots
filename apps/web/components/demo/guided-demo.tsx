"use client";

/**
 * Guided demo: five scenes driven through the real Explore store, so every finding can be inspected with
 * the normal controls after exiting. Mount <DemoLauncher/> in the page header and <DemoOverlay/> once.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileText, Pause, Play, RotateCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { briefHref } from "@/components/brief/link";
import { useCounterfactual, useGroups, useRankCandidates, useTargets } from "@/hooks/api";
import { queryKeys } from "@/hooks/api/keys";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { analysisProfiles, pickDefaultGroup, useExploreStore, type Layers } from "@/lib/explore-store";
import type { AssessResponse } from "@/lib/types";
import { pressureAnchor } from "@/components/explore/model";
import { END_SCENE, END_TITLE, SCENE_COUNT, SCENE_SECONDS, pickDemoProfile, pressureOutsideObserved, sceneCaption } from "./model";

const LAYERS_BY_SCENE: Record<number, Layers> = {
  1: { observations: true, coverage: false, prediction: false, uncertainty: false, target: false, candidates: false, context: false },
  2: { observations: true, coverage: false, prediction: false, uncertainty: false, target: true, candidates: false, context: false },
  3: { observations: true, coverage: true, prediction: false, uncertainty: true, target: true, candidates: false, context: true },
  4: { observations: true, coverage: true, prediction: false, uncertainty: true, target: true, candidates: true, context: true },
  5: { observations: true, coverage: true, prediction: false, uncertainty: true, target: true, candidates: true, context: true },
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const f = () => setReduced(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return reduced;
}

function dropDemoParam() {
  try {
    const p = new URLSearchParams(window.location.search);
    if (!p.has("demo")) return;
    p.delete("demo");
    const qs = p.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  } catch {
    /* ignore: history unavailable */
  }
}

/** Starts the demo from the Explore header. */
export function DemoLauncher() {
  const active = useExploreStore((s) => s.demo.active);
  const groupsQ = useGroups();
  const groups = groupsQ.data?.data;
  return (
    <Button
      variant="secondary"
      disabled={!groups || groups.length === 0}
      aria-pressed={active}
      onClick={() => {
        const st = useExploreStore.getState();
        const g = groups ? pickDefaultGroup(groups) : null;
        if (g) st.setGroup(g.group_id);
        st.setDemo({ active: true, scene: 1 });
      }}
    >
      <Sparkles aria-hidden />
      Guided demo
    </Button>
  );
}

const isInteractive = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  return !!el.closest("input, textarea, select, [role=slider], [role=listbox], [role=combobox], [contenteditable=true]");
};
const isButtonLike = (el: EventTarget | null): boolean => el instanceof HTMLElement && !!el.closest("button, a, summary, [role=button], [role=tab], [role=switch]");

export function DemoOverlay() {
  const active = useExploreStore((s) => s.demo.active);
  const scene = useExploreStore((s) => s.demo.scene);
  const groupId = useExploreStore((s) => s.groupId);
  const target = useExploreStore((s) => s.target);
  const plane = useExploreStore((s) => s.plane);
  const slice = useExploreStore((s) => s.slice[s.plane]);
  const reduced = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  const groupsQ = useGroups();
  const targetsQ = useTargets();
  const groups = useMemo(() => groupsQ.data?.data ?? [], [groupsQ.data]);
  const profiles = useMemo(() => targetsQ.data?.data.profiles ?? [], [targetsQ.data]);
  const group = groups.find((g) => g.group_id === groupId) ?? null;
  const modelled = group?.model_status === "modeled";

  // Assess every documented profile for the current group (only while the demo runs) to choose scene 2's target.
  const usable = useMemo(() => analysisProfiles(profiles), [profiles]);
  const assessList = useQueries({
    queries: usable.map((p) => {
      const body = { group_id: groupId ?? "", target: { profile_id: p.profile_id } };
      return {
        queryKey: queryKeys.assess(body),
        queryFn: ({ signal }: { signal: AbortSignal }) => api.assessTarget(body, signal),
        enabled: active && !!groupId,
        staleTime: 60_000,
      };
    }),
    combine: (results) => results.map((r) => r.data?.data ?? null),
  });
  const assessMap = useMemo(() => {
    const m = new Map<string, AssessResponse>();
    usable.forEach((p, i) => {
      const d = assessList[i];
      if (d && d.group_id === groupId) m.set(p.profile_id, d);
    });
    return m;
  }, [usable, assessList, groupId]);
  const demoProfileId = useMemo(() => pickDemoProfile(profiles, assessMap), [profiles, assessMap]);

  // Data for scenes 4-5 uses the store's current target (set in scene 2).
  const ready = active && !!group && scene >= 2;
  const rankQ = useRankCandidates(ready && modelled ? { group_id: group.group_id, target, k: 3 } : null);
  const rank = rankQ.isPlaceholderData ? null : rankQ.data?.data ?? null;
  const top = rank?.candidates[0] ?? null;
  const assessCur = (demoProfileId ? assessMap.get(demoProfileId) : null) ?? null;
  // When the demo target's pressure is outside what the group observed, scenes 2-5 use the O2 x pressure plane so the gap is visible.
  const demoProfile = profiles.find((p) => p.profile_id === demoProfileId) ?? null;
  const demoPressure = demoProfile ? pressureAnchor(demoProfile.total_pressure_kpa) : null;
  const pressureGap = group?.pressure_kpa_range && pressureOutsideObserved(demoPressure, group.pressure_kpa_range) && demoPressure !== null ? { target: demoPressure, lo: group.pressure_kpa_range[0], hi: group.pressure_kpa_range[1] } : null;
  const gapPlane = pressureGap !== null;
  const cfQ = useCounterfactual(
    active && scene >= 5 && group && top
      ? { group_id: group.group_id, target, candidate: { oxygen_percent: top.oxygen_percent, airflow_cm_s: top.airflow_cm_s, pressure_kpa: top.pressure_kpa }, plane, slice }
      : null,
  );
  const counterfactual = cfQ.isPlaceholderData ? null : cfQ.data?.data ?? null;

  const rankStatus = !modelled && group ? "unavailable" : rankQ.isPending && !rank ? "loading" : rank && rank.candidates.length === 0 ? "none" : "ok";

  // ---- apply the scene to the real store
  const topId = top?.candidate_id ?? null;
  useEffect(() => {
    if (!active) return;
    const st = useExploreStore.getState();
    const layers = LAYERS_BY_SCENE[Math.min(scene, SCENE_COUNT)];
    if (!layers || !group) return;
    const l = { ...layers, uncertainty: layers.uncertainty && !!modelled, prediction: layers.prediction && !!modelled, candidates: layers.candidates && !!modelled };
    (Object.keys(l) as (keyof Layers)[]).forEach((k) => st.setLayer(k, l[k]));
    if (scene >= 2) st.setPlane(gapPlane ? "o2_pressure" : "o2_flow");
    if (scene === 1) {
      st.setPlane("o2_flow");
      st.setViewDomain(null);
      st.setCounterfactualOpen(false);
      st.selectCandidate(null);
      st.selectObservation(null);
    }
    if (scene >= 2 && demoProfileId && !("profile_id" in st.target && st.target.profile_id === demoProfileId)) st.setTarget({ profile_id: demoProfileId });
    if (scene === 2 || scene === 3) {
      st.setCounterfactualOpen(false);
      st.selectCandidate(null);
    }
    if (scene === 4) {
      st.setCounterfactualOpen(false);
      st.selectCandidate(topId);
    }
    if (scene === 5 && topId) {
      st.selectCandidate(topId);
      st.setCounterfactualOpen(true);
    }
    // Keep the map in view (never scroll past it); on wide screens the map card stays sticky while the right column shows the counterfactual.
    const mapEl = document.querySelector('[data-testid="map-region"]');
    if (mapEl) {
      const top = mapEl.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.5) mapEl.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, scene, group?.group_id, modelled, demoProfileId, topId, gapPlane]);

  // ---- navigation
  const go = useCallback((n: number) => useExploreStore.getState().setDemo({ scene: Math.max(1, Math.min(END_SCENE, n)) }), []);
  const exit = useCallback(() => {
    useExploreStore.getState().setDemo({ active: false, scene: 0 });
    setPaused(false);
    dropDemoParam();
  }, []);
  const replay = useCallback(() => {
    setPaused(false);
    go(1);
  }, [go]);

  // ?demo=1 autostart, once the group list is known
  const autostarted = useRef(false);
  useEffect(() => {
    if (autostarted.current || groups.length === 0) return;
    if (new URLSearchParams(window.location.search).get("demo") !== "1") return;
    autostarted.current = true;
    useExploreStore.getState().setDemo({ active: true, scene: 1 });
  }, [groups]);

  // autoplay
  useEffect(() => {
    // No autoplay for reduced-motion users or while focus is inside the card (WCAG 2.2.2 / 2.3.3); they step with Next.
    if (!active || paused || reduced || focusWithin || scene < 1 || scene > SCENE_COUNT) return;
    const id = window.setTimeout(() => go(scene + 1), SCENE_SECONDS * 1000);
    return () => window.clearTimeout(id);
  }, [active, paused, reduced, focusWithin, scene, go]);

  // keyboard
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        exit();
      } else if (e.key === "ArrowRight" && !isInteractive(e.target)) {
        e.preventDefault();
        go(scene + 1);
      } else if (e.key === "ArrowLeft" && !isInteractive(e.target)) {
        e.preventDefault();
        go(scene - 1);
      } else if (e.key === " " && !isInteractive(e.target) && !isButtonLike(e.target)) {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, scene, go, exit]);

  const wasActive = useRef(false);
  useEffect(() => {
    if (active && !wasActive.current) nextRef.current?.focus();
    wasActive.current = active;
  }, [active]);

  if (!active) return null;
  const isEnd = scene >= END_SCENE;
  const cap = sceneCaption({ scene, group, assess: assessCur, top, rankStatus, counterfactual, pressureGap });
  const href = briefHref(groupId, target, top ? { oxygen_percent: top.oxygen_percent, airflow_cm_s: top.airflow_cm_s, pressure_kpa: top.pressure_kpa } : null);

  return (
    <section
      role="region"
      aria-label="Guided demo"
      data-testid="demo-card"
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
      }}
      // Docked outside the map: a bottom sheet below lg (the page reserves space for it), the top of the right column at lg and up.
      className="fixed inset-x-0 bottom-0 z-40 max-h-[38vh] overflow-y-auto rounded-t-lg border border-border-strong bg-surface shadow-[var(--shadow-popover)] lg:static lg:z-10 lg:max-h-none lg:overflow-visible lg:rounded-lg"
    >
      <div className="flex gap-1 px-4 pt-3" aria-hidden>
        {Array.from({ length: SCENE_COUNT }, (_, k) => {
          const n = k + 1;
          const done = scene > n;
          const cur = scene === n;
          return (
            <div key={n} className="h-1 flex-1 overflow-hidden rounded-xs bg-subtle">
              <div
                className={cn("h-full bg-accent", done || (cur && (reduced || paused)) ? "w-full" : "w-0")}
                style={cur && !reduced ? { width: "100%", transformOrigin: "left", animation: `demo-progress ${SCENE_SECONDS}s linear`, animationPlayState: paused ? "paused" : "running" } : undefined}
              />
            </div>
          );
        })}
      </div>
      <style>{`@keyframes demo-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}@media (max-width:1023px){html{scroll-padding-bottom:40vh}}`}</style>
      <div className="px-4 pb-3 pt-2" aria-live="polite" aria-atomic="false">
        <p className="num text-xs text-muted">{isEnd ? "Demo complete" : `Scene ${scene} of ${SCENE_COUNT}`}{paused && !isEnd ? " · paused" : ""}</p>
        {isEnd ? (
          <>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.01em]">{END_TITLE}</h2>
            <p className="mt-1 text-[13px] text-muted">Everything shown stays on the map: exit to keep exploring with the normal controls, or export the findings as a research brief.</p>
          </>
        ) : (
          <>
            <h2 className="mt-1 text-lg font-semibold leading-snug tracking-[-0.01em]">{cap.title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-fg">{cap.body}</p>
            {cap.facts.length > 0 ? (
              <dl className="num mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                {cap.facts.map((f) => (
                  <div key={f.label}>
                    <dt className="text-muted">{f.label}</dt>
                    <dd className="text-[13px] text-fg">{f.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2">
        <Button size="sm" variant="secondary" onClick={() => go(scene - 1)} disabled={scene <= 1} aria-keyshortcuts="ArrowLeft">
          <ChevronLeft aria-hidden />Back
        </Button>
        {isEnd ? (
          <Button size="sm" variant="secondary" onClick={replay}>
            <RotateCcw aria-hidden />Replay
          </Button>
        ) : (
          <>
            <Button ref={nextRef} size="sm" variant="primary" onClick={() => go(scene + 1)} aria-keyshortcuts="ArrowRight">
              Next<ChevronRight aria-hidden />
            </Button>
            {reduced ? (
              <span className="text-xs text-muted">Autoplay is off (reduced motion)</span>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setPaused((p) => !p)} aria-pressed={paused} aria-keyshortcuts="Space">
                {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
                {paused ? "Play" : "Pause"}
              </Button>
            )}
          </>
        )}
        {isEnd ? (
          <Button asChild size="sm" variant="secondary">
            <Link href={href}><FileText aria-hidden />Research brief</Link>
          </Button>
        ) : null}
        <Button ref={isEnd ? nextRef : undefined} size="sm" variant={isEnd ? "primary" : "ghost"} onClick={exit} aria-keyshortcuts="Escape" className="ml-auto">
          <X aria-hidden />{isEnd ? "Exit and explore" : "Exit"}
        </Button>
        <p className="hidden w-full text-xs text-muted sm:block" aria-hidden>
          <Kbd>←</Kbd> <Kbd>→</Kbd> step · <Kbd>Space</Kbd> pause · <Kbd>Esc</Kbd> exit
        </p>
      </div>
    </section>
  );
}
