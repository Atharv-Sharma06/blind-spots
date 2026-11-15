"use client";

/**
 * 30-second tour of the Cabins page ("/cabins"). Mount <HomeTour/> once in the hero: it renders the quiet
 * "30-second tour" button and, while running, a docked caption card plus a highlight ring around the part of the
 * page being explained. The page stays readable and clickable underneath (the ring ignores the pointer).
 * `/cabins?demo=1` starts it automatically (any page that mounts it honours `?demo=1`). Every number in the captions comes from the API (see tour-model.ts).
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { DotNumber } from "@/components/ui/dot-number";
import { COVERAGE_STATUS_LABEL, coverageStatus, materialName, shortCabinName } from "@/components/home/cabins";
import { useHomeSelection } from "@/components/home/use-home-selection";
import { useAssessTarget, useCounterfactual, useDataMode, useGroups, useHeadline, useRankCandidates } from "@/hooks/api";
import { cn } from "@/lib/cn";
import { CANDIDATE_FRAMING, DISCLAIMER } from "@/lib/copy";
import { snapSlice } from "@/lib/snapshot";
import type { ResolvedTarget } from "@/lib/types";
import {
  END_LINE,
  END_NAME,
  END_SCENE,
  HYPOTHETICAL_NOTE,
  SCENES,
  SCENE_COUNT,
  TITLE_LINE,
  TITLE_SECONDS,
  TITLE_SUBLINE,
  TOUR_BLIND_CABIN,
  TOUR_ISS_CABIN,
  sceneCaption,
  sceneSeconds,
  type Beat,
} from "./tour-model";

/** Public site address for the end card (omitted when unset). */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
const siteLabel = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

/** Highlight ring: a signal-yellow edge with a soft glow (the second value is the breathing peak). */
const RING_GLOW_A = "0 0 0 2px #F2D21B, 0 0 0 6px rgb(242 210 27 / .16), 0 0 28px 4px rgb(242 210 27 / .38)";
const RING_GLOW_B = "0 0 0 2px #F2D21B, 0 0 0 10px rgb(242 210 27 / .08), 0 0 40px 8px rgb(242 210 27 / .5)";

/** A fact value that is a plain number (count, percent, range): shown large in the dot-matrix face. */
const NUMERIC_FACT = /^[\d.,\s–−%]+$|^\d+ of \d+$/;

/** How long a scene waits for its data before moving on anyway (an unreachable service must not freeze the tour). */
const WAIT_GRACE_MS = 5000;

const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const noopSubscribe = () => () => {};

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
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

const isInteractive = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement && !!el.closest("input, textarea, select, [role=slider], [role=listbox], [role=combobox], [contenteditable=true]");
const isButtonLike = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement && !!el.closest("button, a, summary, [role=button], [role=tab], [role=switch]");

/** The element a beat points at: a cabin card, or a section (`data-tour`, falling back to its id). */
function findTarget(ref: string): HTMLElement | null {
  if (ref === "cabin:iss") return document.querySelector<HTMLElement>(`[data-cabin="${TOUR_ISS_CABIN}"]`);
  if (ref === "cabin:blind") return document.querySelector<HTMLElement>(`[data-cabin="${TOUR_BLIND_CABIN}"]`);
  return document.querySelector<HTMLElement>(`[data-tour="${ref}"]`) ?? document.getElementById(ref);
}

/** The verdict banner ("Covered", "Blind spot: ...") inside the answer card; null until the answer has loaded. */
function verdictBanner(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-testid='answer-verdict']:not([data-verdict='loading']):not([data-verdict='error']) > div:first-child");
}

/**
 * Rectangle the ring draws around. The "next" section also holds the what-if box and the Explorer button, which
 * scene 5 explains on its own, so scene 4 rings only the heading and the ranked list above it. The answer beat
 * rings the verdict banner alone (scrolled to the top of the window, clear of the docked card); the chart keeps its own beat.
 */
function ringRect(ref: string, limit: number): DOMRect | null {
  // The answer beat rings the verdict banner itself, so the ring never wraps only the "The answer" heading.
  const el = ref === "answer" ? verdictBanner() ?? findTarget(ref) : findTarget(ref);
  if (!el) return null;
  let rect = el.getBoundingClientRect();
  const cutSelector = ref === "next" ? "#what-if, [data-tour='what-if']" : null;
  const cut = cutSelector ? el.querySelector<HTMLElement>(cutSelector) : null;
  if (cut) {
    const bottom = cut.getBoundingClientRect().top - 14;
    if (bottom > rect.top + 40) rect = new DOMRect(rect.left, rect.top, rect.width, bottom - rect.top);
  }
  // The ranked list can be taller than the free area above the docked card. Then ring the heading and the first
  // candidate only (the one the caption and its facts describe), so the ringed part is never hidden by the card.
  if (ref === "next" && rect.bottom > limit) {
    const first = el.querySelector<HTMLElement>("[data-testid='next-test-1']");
    if (first) {
      const end = first.getBoundingClientRect().bottom + 6;
      if (end > rect.top + 40) rect = new DOMRect(rect.left, rect.top, rect.width, end - rect.top);
    }
  }
  // Whatever is still taller than the free area stops at the card's top edge instead of running under it.
  if (rect.bottom > limit && limit > rect.top + 40) rect = new DOMRect(rect.left, rect.top, rect.width, limit - rect.top);
  return rect;
}

/** Height of the site header while it sticks to the top of the window (zero when it scrolls away, as on phones). */
function stickyHeaderHeight(): number {
  const h = document.querySelector("header");
  if (!h) return 0;
  return getComputedStyle(h).position === "sticky" ? h.getBoundingClientRect().height : 0;
}

/** Pressure (kPa) the target is drawn at: its nominal value, else the middle of its range. */
function targetPressure(t: ResolvedTarget | undefined): number | null {
  const p = t?.total_pressure_kpa;
  if (!p) return null;
  if (p.nominal !== null && p.nominal !== undefined) return p.nominal;
  if (p.min !== null && p.min !== undefined && p.max !== null && p.max !== undefined && p.min > 0 && p.max > 0) return Math.sqrt(p.min * p.max);
  return p.max ?? p.min ?? null;
}

export function HomeTour({ className }: { className?: string }) {
  const sel = useHomeSelection();
  const selRef = useRef(sel);
  useEffect(() => {
    selRef.current = sel;
  }, [sel]);
  const reduced = usePrefersReducedMotion();
  const dm = useDataMode();

  const [active, setActive] = useState(false);
  /** 0 = title card, 1..SCENE_COUNT = scenes, END_SCENE = end card. */
  const [scene, setScene] = useState(0);
  const [beat, setBeat] = useState(0);
  const [paused, setPaused] = useState(false);
  /** Bumped whenever a beat's clock restarts (resume, replay), so the progress animation restarts with it. */
  const [runId, setRunId] = useState(0);
  const [graceKey, setGraceKey] = useState("");
  /** False while rendering on the server and during hydration (the overlay renders into document.body). */
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const rootRef = useRef<HTMLElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const cardH = useRef(0);
  const startCabin = useRef<string | null>(null);
  const autostarted = useRef(false);

  // ---- data (all from the API; the same requests the page itself makes, so they come from the cache or the snapshot)
  const headlineQ = useHeadline();
  const groupsQ = useGroups();
  const groups = useMemo(() => groupsQ.data?.data ?? [], [groupsQ.data]);
  const group = useMemo(() => {
    if (sel.material) return groups.find((g) => g.group_id === sel.material) ?? null;
    return groups.find((g) => g.is_default) ?? groups.find((g) => g.model_status === "modeled") ?? null;
  }, [groups, sel.material]);
  const modelled = group?.model_status === "modeled";
  const profiles = headlineQ.data?.data.profiles;
  const issRow = profiles?.find((p) => p.profile_id === TOUR_ISS_CABIN) ?? null;
  const blindRow = profiles?.find((p) => p.profile_id === TOUR_BLIND_CABIN) ?? null;

  const target = useMemo(() => ({ profile_id: TOUR_BLIND_CABIN }), []);
  // Loads from the start of the tour (the same request scene 3 shows), so no scene waits and the end card lands before 27 s.
  const needAnswer = active && !!group;
  const assessQ = useAssessTarget(needAnswer && group ? { group_id: group.group_id, target } : null);
  const assess = assessQ.isPlaceholderData ? null : assessQ.data?.data ?? null;
  // Rank and the what-if load while the earlier scenes play, so no scene has to wait.
  const rankQ = useRankCandidates(active && group && modelled ? { group_id: group.group_id, target, k: 3 } : null);
  const rank = rankQ.isPlaceholderData ? null : rankQ.data?.data ?? null;
  const top = rank?.candidates[0] ?? null;
  // A material the model does not cover has no ranking: its query is switched off (and so stays "pending" forever),
  // so "unavailable" must be decided before the pending check, or the scenes would wait for data that never comes.
  const rankStatus = !group
    ? "loading"
    : !modelled
      ? "unavailable"
      : rankQ.isPending
        ? "loading"
        : rankQ.isError || (rank && rank.candidates.length === 0)
          ? "none"
          : rank
            ? "ok"
            : "loading";
  // The what-if request is the Explorer's own: the target's pressure on the oxygen x airflow chart (snapped in snapshot mode).
  const pressure = targetPressure(assess?.target) ?? blindRow?.total_pressure_kpa ?? null;
  const slice = pressure === null ? null : dm.snapshotOnly ? snapSlice("o2_flow", pressure, dm.slices) : pressure;
  const cfQ = useCounterfactual(
    active && group && top && slice !== null
      ? {
          group_id: group.group_id,
          target,
          candidate: { oxygen_percent: top.oxygen_percent, airflow_cm_s: top.airflow_cm_s, pressure_kpa: top.pressure_kpa },
          plane: "o2_flow",
          slice,
        }
      : null,
  );
  const counterfactual = cfQ.isPlaceholderData ? null : cfQ.data?.data ?? null;

  const sceneScript = scene >= 1 && scene <= SCENE_COUNT ? SCENES[scene - 1] : undefined;
  const cap = sceneScript
    ? sceneCaption({
        scene: sceneScript.id,
        beat,
        iss: issRow,
        issStatus: issRow ? coverageStatus(issRow) : null,
        cabin: blindRow
          ? {
              name: shortCabinName(blindRow.profile_id, blindRow.label),
              oxygen_percent: blindRow.oxygen_percent,
              total_pressure_kpa: blindRow.total_pressure_kpa,
              statusLabel: COVERAGE_STATUS_LABEL[coverageStatus(blindRow)],
            }
          : null,
        materialName: group ? materialName(group.group_id, group.label) : null,
        testedKpa: group?.pressure_kpa_range ?? null,
        testedKpaMeasured: group ? group.pressure_measured : null,
        assess,
        rankStatus,
        top,
        counterfactual,
      })
    : null;
  const sceneKey = `${scene}.${beat}`;
  const blocked = !!cap?.waiting && graceKey !== sceneKey;

  // ---- navigation
  const go = useCallback((n: number) => {
    const next = Math.max(0, Math.min(END_SCENE, n));
    setScene(next);
    setBeat(0);
    setRunId((r) => r + 1);
  }, []);

  const start = useCallback(() => {
    startCabin.current = selRef.current.cabin;
    setPaused(false);
    setActive(true);
    go(0);
    dropDemoParam();
    window.scrollTo({ top: 0, behavior: "auto" });
    window.setTimeout(() => rootRef.current?.focus({ preventScroll: true }), 0);
  }, [go]);

  const exit = useCallback(() => {
    setActive(false);
    setPaused(false);
    setScene(0);
    setBeat(0);
    // Reached the Exploration Atmosphere (scene 2 or later): leave it selected, it is what the page showed. Earlier: put back the cabin that was selected.
    const back = startCabin.current;
    if (scene < 2 && back && selRef.current.cabin !== back) selRef.current.setCabin(back);
    dropDemoParam();
    window.setTimeout(() => launcherRef.current?.focus({ preventScroll: true }), 0);
  }, [scene]);

  const replay = useCallback(() => {
    setPaused(false);
    go(0);
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }, [go, reduced]);

  // ?demo=1 starts the tour once the page has mounted.
  useEffect(() => {
    if (autostarted.current || !mounted) return;
    if (new URLSearchParams(window.location.search).get("demo") !== "1") return;
    autostarted.current = true;
    const id = window.setTimeout(start, 0);
    return () => window.clearTimeout(id);
  }, [mounted, start]);

  // ---- the scene changes the page: pick the cabin the scene is about
  useEffect(() => {
    if (!active || !sceneScript) return;
    const wanted = sceneScript.id === "iss" ? TOUR_ISS_CABIN : TOUR_BLIND_CABIN;
    if (selRef.current.cabin !== wanted) selRef.current.setCabin(wanted);
  }, [active, sceneScript]);

  // ---- scroll the part being explained into the free area above the caption card
  const beatDef: Beat | undefined = sceneScript?.beats[Math.min(beat, sceneScript.beats.length - 1)];
  useEffect(() => {
    if (!active || !beatDef) return;
    let tries = 0;
    let timer = 0;
    const attempt = () => {
      const isAnswer = beatDef.scroll === "answer";
      const banner = isAnswer ? verdictBanner() : null;
      // The answer beat waits (about 4 s) for the verdict banner to load; then it falls back to the whole section.
      const el = banner ?? (isAnswer && tries < 15 ? null : findTarget(beatDef.scroll));
      if (!el) {
        if (++tries < 16) timer = window.setTimeout(attempt, 250);
        return;
      }
      const rect = el.getBoundingClientRect();
      // The verdict banner sits ~80 px from the top, so it and the sentences under it stay clear of the docked card.
      const top = banner ? Math.max(80, stickyHeaderHeight() + 12) : stickyHeaderHeight() + 12;
      const free = window.innerHeight - cardH.current - top - 12;
      let y = rect.top + window.scrollY - top;
      if (beatDef.scroll === "chart" && rect.height < free) y -= (free - rect.height) / 2;
      window.scrollTo({ top: Math.max(0, y), behavior: reduced ? "auto" : "smooth" });
    };
    timer = window.setTimeout(attempt, 120);
    return () => window.clearTimeout(timer);
  }, [active, beatDef, reduced]);

  // ---- the highlight ring follows its element (scrolling, resizing, content loading in)
  useEffect(() => {
    const ring = ringRef.current;
    if (!active || !ring || !beatDef) return;
    let raf = 0;
    const pad = 8;
    const tick = () => {
      const cardTop = rootRef.current ? rootRef.current.getBoundingClientRect().top : window.innerHeight;
      // Cabin scenes: the answer verdict peeks out beside the card and would read as cut-off text, so fade the strip around the card.
      if (veilRef.current) veilRef.current.style.height = `${Math.max(0, Math.round(window.innerHeight - cardTop + 6))}px`;
      const r = ringRect(beatDef.ring, cardTop - 14);
      if (r) {
        const visible = r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
        ring.style.opacity = visible ? "1" : "0";
        ring.style.transform = `translate(${Math.round(r.left - pad)}px, ${Math.round(r.top - pad)}px)`;
        ring.style.width = `${Math.round(r.width + pad * 2)}px`;
        ring.style.height = `${Math.round(r.height + pad * 2)}px`;
      } else ring.style.opacity = "0";
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [active, beatDef, scene]);

  // ---- keep the card's height known: scroll targets leave room for it, and the page gets that much extra room
  // at the bottom so the last section can scroll clear of the card
  useEffect(() => {
    const el = rootRef.current;
    if (!active || !el) return;
    const docked = scene >= 1 && scene <= SCENE_COUNT;
    const apply = () => {
      cardH.current = docked ? el.getBoundingClientRect().height : 0;
      document.body.style.paddingBottom = docked ? `${Math.ceil(cardH.current) + 24}px` : "";
      // Keyboard focus scrolls the focused control clear of the docked card (WCAG 2.4.11).
      document.documentElement.style.scrollPaddingBottom = docked ? `${Math.ceil(cardH.current) + 24}px` : "";
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.body.style.paddingBottom = "";
      document.documentElement.style.scrollPaddingBottom = "";
    };
  }, [active, scene, cap?.facts.length]);

  // ---- keep keyboard focus inside the tour: a scene change that replaces the focused node would drop it to <body>
  useEffect(() => {
    if (!active) return;
    const ae = document.activeElement;
    if (!ae || ae === document.body || !document.body.contains(ae)) rootRef.current?.focus({ preventScroll: true });
  }, [active, scene]);

  // ---- a scene that waits for data moves on after a grace period (never a frozen tour)
  useEffect(() => {
    if (!active || !cap?.waiting) return;
    const id = window.setTimeout(() => setGraceKey(sceneKey), WAIT_GRACE_MS);
    return () => window.clearTimeout(id);
  }, [active, cap?.waiting, sceneKey]);

  // ---- autoplay: only an explicit Pause stops it; reduced motion never autoplays (step with Next)
  useEffect(() => {
    if (!active || paused || reduced) return;
    if (scene === 0) {
      const id = window.setTimeout(() => go(1), TITLE_SECONDS * 1000);
      return () => window.clearTimeout(id);
    }
    if (!sceneScript || blocked) return;
    const b = sceneScript.beats[beat];
    if (!b) return;
    const id = window.setTimeout(() => {
      if (beat + 1 < sceneScript.beats.length) {
        setBeat(beat + 1);
        setRunId((r) => r + 1);
      } else go(scene + 1);
    }, b.seconds * 1000);
    return () => window.clearTimeout(id);
  }, [active, paused, reduced, scene, beat, blocked, sceneScript, go, runId]);

  const togglePause = useCallback(() => {
    setPaused((p) => !p);
    setRunId((r) => r + 1);
  }, []);

  // ---- keyboard: Esc exits, arrows step, Space pauses (never while typing or on a button)
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") exit();
      else if (e.key === "ArrowRight" && !isInteractive(e.target)) {
        e.preventDefault();
        go(scene + 1);
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
  }, [active, scene, go, exit, togglePause]);

  const launcher = (
    <Button
      ref={launcherRef}
      variant="secondary"
      data-testid="home-tour-start"
      aria-pressed={active}
      onClick={start}
      className={className}
    >
      <span aria-hidden className="text-[11px] text-accent">▶</span>
      30-second tour
    </Button>
  );
  if (!active || !mounted) return launcher;

  const isEnd = scene >= END_SCENE;
  const isTitle = scene === 0;
  const running = !paused && !reduced && !blocked;
  const pill = "h-10 rounded-full px-4";
  /** The one forward action: signal-yellow dot-texture pill (forced over the Button variant colours). */
  const yellow = "pill-yellow !border-transparent !bg-accent !text-[#0B0B0C] font-semibold";
  const pauseButton = reduced ? (
    <span className="text-xs text-muted">Autoplay is off. Use Next.</span>
  ) : (
    <Button size="sm" variant="secondary" onClick={togglePause} aria-pressed={paused} aria-keyshortcuts="Space" className={pill}>
      {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
      {paused ? "Play" : "Pause"}
    </Button>
  );

  const style = (
    <style>{`
      @keyframes tour-fill{from{width:var(--from)}to{width:var(--to)}}
      @keyframes tour-ring{0%,100%{box-shadow:${RING_GLOW_A}}50%{box-shadow:${RING_GLOW_B}}}
      @media (prefers-reduced-motion: reduce){[data-tour-ring]{animation:none!important}}
    `}</style>
  );

  // ---- title and end cards: full screen, large type (readable in a 1080p recording)
  if (isTitle || isEnd) {
    return (
      <>
        {launcher}
        {createPortal(
          <section
            ref={rootRef}
            tabIndex={-1}
            role="region"
            aria-label="Tour"
            data-testid="home-tour-card"
            data-tour-state={isTitle ? "title" : "end"}
            className="bg-dots fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto px-5 py-10 text-white outline-none"
            style={{ backgroundColor: "#08080A" }}
          >
            {style}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(60% 50% at 50% 42%, rgb(92 89 196 / .22) 0%, rgb(8 8 10 / 0) 70%)" }}
            />
            <div className={cn("relative w-full max-w-[880px]", isEnd && "text-center")} aria-live="polite">
              {isTitle ? (
                <>
                  <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-fg">
                    <span aria-hidden className="size-2 rounded-full bg-accent shadow-[0_0_10px_rgb(242_210_27/.7)]" />
                    {TITLE_SUBLINE}
                  </p>
                  <h2 className="mt-5 text-balance text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:text-[56px]">{TITLE_LINE}</h2>
                </>
              ) : (
                <>
                  <h2 className="text-[52px] font-semibold leading-none tracking-[-0.035em] text-white sm:text-[88px]">{END_NAME}</h2>
                  <p className="mx-auto mt-5 max-w-[720px] text-balance text-[20px] leading-snug text-white/90 sm:text-[28px]">{END_LINE}</p>
                  {siteLabel ? (
                    <p className="mt-7" data-testid="home-tour-site-url">
                      <a
                        href={SITE_URL}
                        className="num inline-flex min-h-11 items-center rounded-full border border-border-strong bg-surface px-5 text-[17px] text-accent underline-offset-4 hover:underline sm:text-[22px]"
                      >
                        {siteLabel}
                      </a>
                    </p>
                  ) : null}
                  <p className="mx-auto mt-7 max-w-[640px] text-[13px] leading-relaxed text-muted sm:text-[14px]">{DISCLAIMER}</p>
                </>
              )}
            </div>
            <div className={cn("relative mt-10 flex w-full max-w-[880px] flex-wrap items-center gap-2.5", isEnd && "justify-center")}>
              {isTitle ? (
                <>
                  <Button size="sm" variant="primary" onClick={() => go(1)} aria-keyshortcuts="ArrowRight" className={cn(pill, yellow)}>
                    Start<ChevronRight aria-hidden />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={exit} aria-keyshortcuts="Escape" className={cn(pill, "ml-auto")}>
                    <X aria-hidden />Exit
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="primary" onClick={exit} aria-keyshortcuts="Escape" className={cn(pill, yellow)}>
                    <X aria-hidden />Close the tour
                  </Button>
                  <Button size="sm" variant="secondary" onClick={replay} className={pill}>
                    <RotateCcw aria-hidden />Replay
                  </Button>
                </>
              )}
            </div>
            {isTitle && running ? (
              <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/10" aria-hidden>
                <div
                  key={runId}
                  className="h-full rounded-r-full bg-accent shadow-[0_0_12px_rgb(242_210_27/.6)]"
                  style={{ ["--from" as string]: "0%", ["--to" as string]: "100%", animation: `tour-fill ${TITLE_SECONDS}s linear forwards` }}
                />
              </div>
            ) : null}
            {isEnd ? <span className="sr-only">Tour finished.</span> : null}
          </section>,
          document.body,
        )}
      </>
    );
  }

  // ---- scenes: ring around the explained part, caption card docked at the bottom
  const beatStart = sceneScript ? sceneScript.beats.slice(0, beat).reduce((t, b) => t + b.seconds, 0) : 0;
  const total = sceneScript ? sceneSeconds(sceneScript) : 1;
  const from = (beatStart / total) * 100;
  const to = ((beatStart + (beatDef?.seconds ?? 0)) / total) * 100;
  const playing = !paused && !reduced;

  return (
    <>
      {launcher}
      {createPortal(
        <>
          {style}
          <div
            ref={ringRef}
            aria-hidden
            data-tour-ring
            className="pointer-events-none fixed left-0 top-0 z-20 rounded-[22px] opacity-0 transition-opacity duration-200"
            style={{ boxShadow: RING_GLOW_A, animation: "tour-ring 1.8s ease-in-out infinite" }}
          />
          {scene <= 2 ? (
            <div
              ref={veilRef}
              aria-hidden
              data-tour-veil
              className="pointer-events-none fixed inset-x-0 bottom-0 z-40"
              style={{ background: "linear-gradient(to bottom, transparent, var(--bg) 6px)" }}
            />
          ) : null}
          <section
            ref={rootRef}
            tabIndex={-1}
            role="region"
            aria-label="Tour"
            data-testid="home-tour-card"
            data-tour-state={`scene-${scene}`}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[56vh] w-full max-w-[780px] overflow-y-auto rounded-t-[28px] text-white outline-none backdrop-blur-xl sm:bottom-5 sm:w-[calc(100%-2rem)] sm:rounded-[34px]"
            style={{
              background: "linear-gradient(160deg, rgb(40 40 46 / .9) 0%, rgb(24 24 27 / .93) 55%, rgb(17 17 19 / .96) 100%)",
              boxShadow: "inset 0 1px 0 rgb(255 255 255 / .09), inset 0 0 0 1px rgb(255 255 255 / .07), 0 30px 60px -18px rgb(0 0 0 / .85)",
            }}
          >
            <div className="flex gap-1.5 px-5 pt-4 sm:px-7 sm:pt-5" aria-hidden>
              {SCENES.map((s, k) => {
                const n = k + 1;
                const done = scene > n;
                const cur = scene === n;
                return (
                  <div key={s.id} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    {cur ? (
                      <div
                        key={`${runId}-${beat}`}
                        className="h-full rounded-full bg-accent shadow-[0_0_10px_rgb(242_210_27/.6)]"
                        style={{
                          ["--from" as string]: `${from}%`,
                          ["--to" as string]: `${to}%`,
                          width: `${from}%`,
                          animation: playing ? `tour-fill ${beatDef?.seconds ?? 1}s linear forwards` : undefined,
                          animationPlayState: blocked ? "paused" : "running",
                        }}
                      />
                    ) : (
                      <div className={cn("h-full rounded-full bg-accent", done ? "w-full" : "w-0")} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-5 pb-3 pt-3 sm:px-7 sm:pb-4 sm:pt-4" aria-live="polite" aria-atomic="true">
              <p className="num text-[12px] text-muted sm:text-[13px]">
                {`${scene} of ${SCENE_COUNT} · ${cap?.title ?? ""}`}
                {paused ? " · paused" : ""}
              </p>
              <h2 className="mt-1.5 text-balance text-[21px] font-semibold leading-[1.2] tracking-[-0.015em] text-white sm:text-[30px]" data-testid="home-tour-caption">
                {cap?.caption}
              </h2>
              {cap && cap.facts.length > 0 ? (
                <dl className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2 sm:mt-4 sm:gap-x-9">
                  {cap.facts.map((f) => (
                    <div key={f.label} className="min-w-0">
                      <dt className="text-[11px] leading-tight text-muted sm:text-[13px]">{f.label}</dt>
                      {NUMERIC_FACT.test(f.value) ? (
                        <DotNumber as="dd" className="mt-1.5 text-[32px] !font-black text-white sm:text-[40px]">
                          {f.value}
                        </DotNumber>
                      ) : (
                        <dd className="tabular mt-1 text-[15px] font-medium text-white sm:text-[18px]">{f.value}</dd>
                      )}
                    </div>
                  ))}
                </dl>
              ) : null}
              {cap && cap.notes.length > 0 ? (
                <p className="mt-2.5 text-[11px] leading-snug text-muted sm:text-[12px]">
                  {cap.notes.includes("hypothetical") ? `${HYPOTHETICAL_NOTE} ` : ""}
                  {cap.notes.includes("candidate_framing") ? CANDIDATE_FRAMING : ""}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-white/[.07] px-5 py-3 sm:px-7">
              <Button size="sm" variant="secondary" onClick={() => go(scene - 1)} aria-keyshortcuts="ArrowLeft" className={pill}>
                <ChevronLeft aria-hidden />Back
              </Button>
              <Button size="sm" variant="primary" onClick={() => go(scene + 1)} aria-keyshortcuts="ArrowRight" className={cn(pill, yellow)}>
                Next<ChevronRight aria-hidden />
              </Button>
              {pauseButton}
              <p className="ml-auto hidden text-xs text-muted sm:block" aria-hidden>
                <Kbd>←</Kbd> <Kbd>→</Kbd> to step
              </p>
              <Button size="sm" variant="secondary" onClick={exit} aria-keyshortcuts="Escape" aria-label="Exit the tour" className={cn(pill, "ml-auto w-10 max-md:px-0 sm:ml-0 sm:w-auto")}>
                <X aria-hidden />
                <span className="max-sm:sr-only">Exit</span>
              </Button>
            </div>
          </section>
        </>,
        document.body,
      )}
    </>
  );
}
