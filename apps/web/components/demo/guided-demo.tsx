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
import { DEFAULT_LAYERS, analysisProfiles, pickDefaultGroup, useExploreStore, type Layers } from "@/lib/explore-store";
import { DISCLAIMER } from "@/lib/copy";
import type { AssessResponse } from "@/lib/types";
import { pressureAnchor } from "@/components/explore/model";
import { END_LINE, END_NAME, END_SCENE, SCENE_COUNT, SCENE_SECONDS, TITLE_LINE, TITLE_SECONDS, TITLE_SUBLINE, observedPressureSlice, pickDemoProfile, pressureOutsideObserved, sceneCaption } from "./model";

// Scenes 3-5: uncertainty only (no amber gap fill on top of plum, which reads as a muddy wash).
const LAYERS_BY_SCENE: Record<number, Layers> = {
  1: { observations: true, coverage: false, prediction: false, uncertainty: false, target: false, candidates: false, context: false },
  2: { observations: true, coverage: false, prediction: false, uncertainty: false, target: true, candidates: false, context: false },
  3: { observations: true, coverage: false, prediction: false, uncertainty: true, target: true, candidates: false, context: true },
  4: { observations: true, coverage: false, prediction: false, uncertainty: true, target: true, candidates: true, context: true },
  5: { observations: true, coverage: false, prediction: false, uncertainty: true, target: true, candidates: true, context: true },
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
      data-testid="demo-launcher"
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

/** Public site address for the end card (omitted when unset). */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
const siteLabel = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

export function DemoOverlay() {
  const active = useExploreStore((s) => s.demo.active);
  const scene = useExploreStore((s) => s.demo.scene);
  const groupId = useExploreStore((s) => s.groupId);
  const target = useExploreStore((s) => s.target);
  const plane = useExploreStore((s) => s.plane);
  const slice = useExploreStore((s) => s.slice[s.plane]);
  const reduced = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  /** The title card is shown at the start of scene 1 (and on Replay) until it times out or the viewer skips it. */
  const [intro, setIntro] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  const groupsQ = useGroups();
  const targetsQ = useTargets();
  const groups = useMemo(() => groupsQ.data?.data ?? [], [groupsQ.data]);
  const profiles = useMemo(() => targetsQ.data?.data.profiles ?? [], [targetsQ.data]);
  const group = groups.find((g) => g.group_id === groupId) ?? null;
  const modelled = group?.model_status === "modeled";

  // Assess every documented profile for the current group (only while the demo runs) to choose the demo's target.
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

  // Data for scenes 4-5 uses the demo target directly, so it can load while the earlier scenes play.
  const demoTarget = useMemo(() => (demoProfileId ? { profile_id: demoProfileId } : target), [demoProfileId, target]);
  const rankQ = useRankCandidates(active && group && modelled && demoProfileId ? { group_id: group.group_id, target: demoTarget, k: 3 } : null);
  const rank = rankQ.isPlaceholderData ? null : rankQ.data?.data ?? null;
  const top = rank?.candidates[0] ?? null;
  const assessCur = (demoProfileId ? assessMap.get(demoProfileId) : null) ?? null;
  // When the demo target's pressure is outside what the group observed, scenes 2-5 use the O2 x pressure plane so the gap is visible.
  const demoProfile = profiles.find((p) => p.profile_id === demoProfileId) ?? null;
  const demoPressure = demoProfile ? pressureAnchor(demoProfile.total_pressure_kpa) : null;
  const gapPlane = !!group?.pressure_kpa_range && pressureOutsideObserved(demoPressure, group.pressure_kpa_range);
  const cfQ = useCounterfactual(
    active && scene >= 4 && group && top
      ? { group_id: group.group_id, target: demoTarget, candidate: { oxygen_percent: top.oxygen_percent, airflow_cm_s: top.airflow_cm_s, pressure_kpa: top.pressure_kpa }, plane, slice }
      : null,
  );
  const counterfactual = cfQ.isPlaceholderData ? null : cfQ.data?.data ?? null;

  const rankStatus = !modelled && group ? "unavailable" : rankQ.isPending && !rank ? "loading" : rank && rank.candidates.length === 0 ? "none" : "ok";

  // ---- apply the scene to the real store
  const topId = top?.candidate_id ?? null;
  /** O2 x airflow slice in place before scene 1 moved it to the observed pressure; restored afterwards. */
  const savedFlowSlice = useRef<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const st = useExploreStore.getState();
    const layers = LAYERS_BY_SCENE[Math.min(scene, SCENE_COUNT)];
    if (!layers || !group) return;
    const l = { ...layers, uncertainty: layers.uncertainty && !!modelled, prediction: layers.prediction && !!modelled, candidates: layers.candidates && !!modelled };
    (Object.keys(l) as (keyof Layers)[]).forEach((k) => st.setLayer(k, l[k]));
    if (scene >= 2 && savedFlowSlice.current !== null) {
      // Back to the target's own slice before the target is (re)applied below.
      st.setSlice(savedFlowSlice.current, "o2_flow");
      savedFlowSlice.current = null;
    }
    if (scene >= 2) st.setPlane(gapPlane ? "o2_pressure" : "o2_flow");
    if (scene === 1) {
      st.setPlane("o2_flow");
      // Show the evidence: slice at the pressure the group was actually tested at, so its recorded steps are on the map
      // (the target's slice can sit far from every observation, e.g. 56.5 kPa for the Exploration Atmosphere).
      const observed = observedPressureSlice(group.pressure_kpa_range, st.reference.snap?.o2_flow);
      if (observed !== null && st.slice.o2_flow !== observed) {
        if (savedFlowSlice.current === null) savedFlowSlice.current = st.slice.o2_flow;
        st.setSlice(observed, "o2_flow");
      }
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
      // Show the what-if map (uncertainty after one hypothetical observation); the caption gives both outcomes.
      st.setHypotheticalOutcome("sustained");
    }
    const behavior: ScrollBehavior = reduced ? "auto" : "smooth";
    if (scene === 5 && topId) {
      // The map is sticky on wide screens; bring the counterfactual panel into the viewport beside it.
      const t = window.setTimeout(() => document.getElementById("counterfactual-preview")?.scrollIntoView({ block: "end", behavior }), 350);
      return () => window.clearTimeout(t);
    }
    // Keep the map in view (never scroll past it).
    const mapEl = document.querySelector('[data-testid="map-region"]');
    if (mapEl) {
      const y = mapEl.getBoundingClientRect().top;
      // Bring the map to the top of the viewport (below the sticky site header) so the whole plot is in frame.
      if (window.innerWidth >= 1024 ? Math.abs(y - 64) > 24 : y < 0 || y > window.innerHeight * 0.5) {
        window.scrollBy({ top: window.innerWidth >= 1024 ? y - 64 : y - 8, behavior });
      }
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, scene, group?.group_id, modelled, demoProfileId, topId, gapPlane]);

  // ---- navigation
  const go = useCallback((n: number) => {
    setIntro(false);
    useExploreStore.getState().setDemo({ scene: Math.max(1, Math.min(END_SCENE, n)) });
  }, []);
  const exit = useCallback(() => {
    const st = useExploreStore.getState();
    st.setDemo({ active: false, scene: 0 });
    if (savedFlowSlice.current !== null) {
      st.setSlice(savedFlowSlice.current, "o2_flow");
      savedFlowSlice.current = null;
    }
    // Leave a calm, normal Explore view of what the demo showed: same group, target and plane, default layers.
    st.setHypotheticalOutcome(null);
    st.setCounterfactualOpen(false);
    st.selectCandidate(null);
    st.setViewDomain(null);
    (Object.keys(DEFAULT_LAYERS) as (keyof Layers)[]).forEach((k) => st.setLayer(k, DEFAULT_LAYERS[k]));
    setPaused(false);
    setIntro(false);
    dropDemoParam();
    window.setTimeout(() => (document.querySelector('[data-testid="demo-launcher"]') as HTMLElement | null)?.focus(), 0);
  }, []);
  const replay = useCallback(() => {
    setPaused(false);
    go(1);
    setIntro(true);
  }, [go]);

  // ?demo=1 autostart, once the group list is known
  const autostarted = useRef(false);
  useEffect(() => {
    if (autostarted.current || groups.length === 0) return;
    if (new URLSearchParams(window.location.search).get("demo") !== "1") return;
    autostarted.current = true;
    const st = useExploreStore.getState();
    const g = pickDefaultGroup(groups);
    if (g) st.setGroup(g.group_id);
    st.setDemo({ active: true, scene: 1 });
  }, [groups]);

  // Start: show the title card and move focus to the demo region (a programmatic focus never pauses autoplay).
  const wasActive = useRef(false);
  useEffect(() => {
    if (active && !wasActive.current) {
      setIntro(true);
      setPaused(false);
      window.setTimeout(() => rootRef.current?.focus({ preventScroll: true }), 0);
    }
    wasActive.current = active;
  }, [active]);

  // Autoplay: only an explicit Pause (button or Space) stops it (WCAG 2.2.2). Reduced motion: no autoplay; step with Next.
  useEffect(() => {
    if (!active || paused || reduced) return;
    if (intro) {
      const id = window.setTimeout(() => setIntro(false), TITLE_SECONDS * 1000);
      return () => window.clearTimeout(id);
    }
    if (scene < 1 || scene > SCENE_COUNT) return;
    const id = window.setTimeout(() => go(scene + 1), SCENE_SECONDS * 1000);
    return () => window.clearTimeout(id);
  }, [active, paused, reduced, intro, scene, go]);

  const togglePause = useCallback(() => {
    setIntro(false);
    setPaused((p) => !p);
  }, []);

  // keyboard
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        exit();
      } else if (e.key === "ArrowRight" && !isInteractive(e.target)) {
        e.preventDefault();
        if (intro) setIntro(false);
        else go(scene + 1);
      } else if (e.key === "ArrowLeft" && !isInteractive(e.target)) {
        e.preventDefault();
        go(scene - 1);
      } else if (e.key === " " && !isInteractive(e.target) && !isButtonLike(e.target)) {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, scene, intro, go, exit, togglePause]);

  if (!active) return null;
  const isEnd = scene >= END_SCENE;
  const showTitle = intro && scene === 1 && !isEnd;
  const cap = sceneCaption({ scene, group, assess: assessCur, top, rankStatus, counterfactual });
  // The brief without an explicit candidate is the API's top-ranked one, labelled as such (same candidate as scene 4).
  const href = briefHref(groupId, demoProfileId ? { profile_id: demoProfileId } : target);
  const running = !paused && !reduced;

  const progress = (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: SCENE_COUNT }, (_, k) => {
        const n = k + 1;
        const done = isEnd || scene > n;
        const cur = scene === n && !showTitle && !isEnd;
        return (
          <div key={n} className="h-1 flex-1 overflow-hidden rounded-xs bg-subtle">
            <div
              className={cn("h-full bg-accent", done || (cur && !running) ? "w-full" : "w-0")}
              style={cur && running ? { width: "100%", transformOrigin: "left", animation: `demo-progress ${SCENE_SECONDS}s linear` } : undefined}
            />
          </div>
        );
      })}
    </div>
  );
  const style = <style>{`@keyframes demo-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}@media (max-width:1023px){html{scroll-padding-bottom:40vh}}`}</style>;
  const pauseButton = reduced ? (
    <span className="text-xs text-muted">Autoplay is off (reduced motion): use Next</span>
  ) : (
    <Button size="sm" variant="secondary" onClick={togglePause} aria-pressed={paused} aria-keyshortcuts="Space">
      {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
      {paused ? "Play" : "Pause"}
    </Button>
  );

  // Title and end cards fill the viewport (readable in a 1080p recording); scenes use the docked caption card.
  if (showTitle || isEnd) {
    return (
      <section
        ref={rootRef}
        tabIndex={-1}
        role="region"
        aria-label="Guided demo"
        data-testid="demo-card"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/95 px-4 outline-none backdrop-blur-sm"
      >
        {style}
        <div className="w-full max-w-[880px]" aria-live="polite">
          {showTitle ? (
            <>
              <p className="text-sm font-medium uppercase tracking-[0.12em] text-muted">Guided demo · about 30 seconds</p>
              <h2 className="mt-4 text-balance text-[34px] font-semibold leading-[1.15] tracking-[-0.02em] text-fg sm:text-[48px]">{TITLE_LINE}</h2>
              <p className="mt-5 text-[20px] leading-snug text-muted sm:text-[24px]">{TITLE_SUBLINE}</p>
            </>
          ) : (
            <>
              <p className="num text-sm font-medium uppercase tracking-[0.12em] text-muted">Demo complete</p>
              <h2 className="mt-4 text-[44px] font-semibold leading-none tracking-[-0.03em] text-fg sm:text-[64px]">{END_NAME}</h2>
              <p className="mt-4 text-balance text-[22px] leading-snug text-fg sm:text-[28px]">{END_LINE}</p>
              {siteLabel ? (
                <p className="num mt-6 text-[20px] text-accent sm:text-[24px]" data-testid="demo-site-url">
                  <a href={SITE_URL} className="underline-offset-4 hover:underline">{siteLabel}</a>
                </p>
              ) : null}
              <p className="mt-6 text-[15px] text-muted">{DISCLAIMER}</p>
            </>
          )}
        </div>
        <div className="mt-10 flex w-full max-w-[880px] flex-wrap items-center gap-2">
          {showTitle ? (
            <>
              <Button size="sm" variant="primary" onClick={() => setIntro(false)} aria-keyshortcuts="ArrowRight">
                Start<ChevronRight aria-hidden />
              </Button>
              {pauseButton}
              <Button size="sm" variant="ghost" onClick={exit} aria-keyshortcuts="Escape" className="ml-auto">
                <X aria-hidden />Exit
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="primary" onClick={exit} aria-keyshortcuts="Escape">
                <X aria-hidden />Exit and explore
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link href={href}><FileText aria-hidden />Research brief</Link>
              </Button>
              <Button size="sm" variant="secondary" onClick={() => go(scene - 1)} aria-keyshortcuts="ArrowLeft">
                <ChevronLeft aria-hidden />Back
              </Button>
              <Button size="sm" variant="secondary" onClick={replay}>
                <RotateCcw aria-hidden />Replay
              </Button>
            </>
          )}
        </div>
        {showTitle && running ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-subtle" aria-hidden>
            <div className="h-full bg-accent" style={{ width: "100%", transformOrigin: "left", animation: `demo-progress ${TITLE_SECONDS}s linear` }} />
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section
      ref={rootRef}
      tabIndex={-1}
      role="region"
      aria-label="Guided demo"
      data-testid="demo-card"
      // Docked outside the map: a bottom sheet below lg (the page reserves space for it), sticky at the top of the right column at lg and up.
      className="fixed inset-x-0 bottom-0 z-40 max-h-[44vh] overflow-y-auto rounded-t-lg border border-border-strong bg-surface shadow-[var(--shadow-popover)] outline-none lg:sticky lg:top-16 lg:z-20 lg:max-h-none lg:overflow-visible lg:rounded-lg"
    >
      {style}
      <div className="px-5 pt-4">{progress}</div>
      <div className="px-5 pb-4 pt-3" aria-live="polite" aria-atomic="true">
        <p className="num text-[13px] text-muted">
          {`Scene ${scene} of ${SCENE_COUNT}`}
          {cap.title ? ` · ${cap.title}` : ""}
          {paused ? " · paused" : ""}
        </p>
        <h2 className="mt-2 text-balance text-[22px] font-semibold leading-[1.25] tracking-[-0.015em] text-fg lg:text-[24px]" data-testid="demo-caption">{cap.caption}</h2>
        {cap.facts.length > 0 ? (
          <dl className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-x-5 gap-y-2">
            {cap.facts.map((f) => (
              <div key={f.label}>
                <dt className="text-[13px] text-muted">{f.label}</dt>
                <dd className="num text-[17px] font-medium text-fg">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {cap.note ? <p className="mt-3 text-[13px] leading-snug text-muted">{cap.note}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-2.5">
        <Button size="sm" variant="secondary" onClick={() => go(scene - 1)} disabled={scene <= 1} aria-keyshortcuts="ArrowLeft">
          <ChevronLeft aria-hidden />Back
        </Button>
        <Button size="sm" variant="primary" onClick={() => go(scene + 1)} aria-keyshortcuts="ArrowRight">
          Next<ChevronRight aria-hidden />
        </Button>
        {pauseButton}
        <Button size="sm" variant="ghost" onClick={exit} aria-keyshortcuts="Escape" className="ml-auto">
          <X aria-hidden />Exit
        </Button>
        <p className="hidden w-full text-xs text-muted sm:block" aria-hidden>
          <Kbd>←</Kbd> <Kbd>→</Kbd> step · <Kbd>Space</Kbd> pause · <Kbd>Esc</Kbd> exit
        </p>
      </div>
    </section>
  );
}
