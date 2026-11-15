"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Map as MapIcon } from "lucide-react";
import ParameterMap from "@/components/visualization/parameter-map";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { TargetSelector } from "@/components/target/target-selector";
import { TargetAnalysis } from "@/components/target/target-analysis";
import { MaterialCoverage } from "@/components/target/material-coverage";
import { CandidatePanel } from "@/components/recommendations/candidate-panel";
import { CounterfactualPanel } from "@/components/recommendations/counterfactual-panel";
import { CompareSheet } from "@/components/recommendations/compare-sheet";
import {
  useAssessTarget,
  useContextEvidence,
  useCounterfactual,
  useCoverage,
  useDataMode,
  useGroups,
  useObservations,
  useRankCandidates,
  useSurface,
  useTargets,
} from "@/hooks/api";
import { isApiError } from "@/lib/api";
import { verdictLabel } from "@/lib/format";
import {
  exploreActions,
  useExploreCandidateState,
  useExploreLayers,
  useExploreSelection,
  useExploreStore,
  useExploreUrlSync,
  type LayerName,
  type Layers,
  type ViewDomain,
} from "@/lib/explore-store";
import type { Candidate, GridQuery, Plane } from "@/lib/types";
import { FooterStrip } from "./footer-strip";
import { GroupFacts, LayerChips, MaterialSelect, PlaneSwitch, SliceControl } from "./map-controls";
import { FindingStrip } from "./finding-strip";
import {
  DEFAULT_X,
  DEFAULT_Y,
  Y_SCALE,
  candidateXY,
  contextForMap,
  frameDomain,
  nearestIds,
  observationsForMap,
  targetForMap,
  xDomainFor,
} from "./model";
import { PanelSkeleton } from "./query-state";
import { DemoLauncher, DemoOverlay } from "@/components/demo/guided-demo";

// Plot height set by CSS (phones 340, tablets 440, lg+: fits the sticky map card in the viewport), so the server
// render already has the final height and phones do not jump at load (a04-02).
const MAP_PLOT_CLASS = "h-[340px] sm:h-[440px] lg:h-[clamp(420px,calc(100vh-400px),640px)]";

const Panel = ({ id, title, children, busy = false }: { id: string; title: string; children: React.ReactNode; busy?: boolean }) => (
  <section aria-labelledby={id} aria-busy={busy} className="rounded-lg border border-border bg-surface p-4">
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} tabIndex={-1} className="text-[15px] font-semibold tracking-[-0.01em] text-fg outline-none">{title}</h2>
      {busy ? <span className="text-xs text-muted motion-safe:animate-[fade-in_120ms_ease-out_150ms_both]">Updating…</span> : null}
    </div>
    {/* Previous content stays (dimmed, inert) while the new answer loads: no collapse, no stale clicks. */}
    <div className={busy ? "mt-3 opacity-50 transition-opacity delay-150 duration-200" : "mt-3 transition-opacity duration-150"} inert={busy}>
      {children}
    </div>
  </section>
);

type MapView = {
  plane: Plane;
  xDomain: [number, number];
  yDomain: [number, number];
  observations: ReturnType<typeof observationsForMap>["points"];
  coverage: NonNullable<ReturnType<typeof useCoverage>["data"]>["data"] | null;
  surface: NonNullable<ReturnType<typeof useSurface>["data"]>["data"] | null;
  hypothetical: { p_sustained: number[][]; latent_std_ratio: number[][] } | null;
  layers: Layers;
  target: ReturnType<typeof targetForMap>;
  candidates: Array<{ id: string; rank: number; x: number; y: number; title: string; slice: number | null }>;
  ctx: ReturnType<typeof contextForMap>;
  highlight: string[];
  ariaLabel: string;
};

export function ExploreWorkspace() {
  useExploreUrlSync();
  const dm = useDataMode();

  // Field selectors (a04-04): the workspace re-renders only when what it draws changes, never per zoom frame of another field.
  const { groupId, plane, slice, target } = useExploreSelection();
  const layers = useExploreLayers();
  const { selectedCandidateId, compareIds, counterfactualOpen, hypotheticalOutcome } = useExploreCandidateState();
  const viewDomain = useExploreStore((x) => x.viewDomain);
  const selectedObservationId = useExploreStore((x) => x.selectedObservationId);
  const demoActive = useExploreStore((x) => x.demo.active);

  const groupsQ = useGroups();
  const targetsQ = useTargets();
  const groups = useMemo(() => groupsQ.data?.data ?? [], [groupsQ.data]);
  const profiles = useMemo(() => targetsQ.data?.data.profiles ?? [], [targetsQ.data]);
  const snapSlices = dm.isSnapshot ? dm.slices : null;
  useEffect(() => {
    // Only applies when the current choice is unset/invalid; derives the target's slice synchronously (a04-03).
    exploreActions().initDefaults({ groups, profiles, ...(snapSlices ? { slices: snapSlices } : {}) });
  }, [groups, profiles, snapSlices]);

  const group = groups.find((g) => g.group_id === groupId) ?? null;
  const modelled = group?.model_status === "modeled";
  const targetValid = "custom" in target || profiles.some((p) => p.profile_id === (target as { profile_id: string }).profile_id && p.kind !== "envelope");
  const ready = !!group && targetValid;

  // ---- queries
  const assessQ = useAssessTarget(ready ? { group_id: group.group_id, target } : null);
  const rankQ = useRankCandidates(ready && modelled ? { group_id: group.group_id, target, k: 3 } : null);
  const assess = assessQ.isPlaceholderData ? null : assessQ.data?.data ?? null;
  const rank = rankQ.isPlaceholderData ? null : rankQ.data?.data ?? null;

  const xDomain = useMemo(() => xDomainFor(assess?.target), [assess?.target]);
  const yDomain = DEFAULT_Y[plane];
  const customAxes = xDomain[1] !== DEFAULT_X[1];
  const gridQuery: GridQuery | null = group
    ? { group: group.group_id, plane, slice, ...(customAxes ? { x_min: xDomain[0], x_max: xDomain[1] } : {}) }
    : null;
  const covQ = useCoverage(gridQuery);
  const needSurface = !!modelled && (layers.prediction || layers.uncertainty || hypotheticalOutcome !== null);
  const surfQ = useSurface(gridQuery, { enabled: needSurface });
  const obsQ = useObservations(groupId);
  const ctxQ = useContextEvidence();

  // Only answers for the current request count as current (placeholder data belongs to the previous group/plane/slice).
  const cov = !covQ.isPlaceholderData && covQ.data?.data && covQ.data.data.group_id === groupId && covQ.data.data.plane === plane ? covQ.data.data : null;
  const surf = !surfQ.isPlaceholderData && surfQ.data?.data && surfQ.data.data.group_id === groupId && surfQ.data.data.plane === plane ? surfQ.data.data : null;

  // ---- derived map data
  const obsResult = useMemo(
    () => observationsForMap(plane, obsQ.data?.data ?? [], cov ? new Set(cov.observations_in_slice) : null),
    [plane, obsQ.data, cov],
  );
  const mapTarget = useMemo(() => targetForMap(plane, assess?.target), [plane, assess?.target]);
  const ctx = useMemo(() => contextForMap(plane, ctxQ.data?.data, plane === "o2_flow" ? slice : undefined), [plane, ctxQ.data, slice]);
  const candidates = useMemo(
    // Rank 1 last, so it is drawn on top when candidates coincide.
    // `slice` lets the map draw candidates that sit on another slice hollow, labelled "off-slice" (D3).
    () =>
      (rank?.candidates ?? [])
        .map((c) => ({ id: c.candidate_id, rank: c.rank, ...candidateXY(plane, c), title: `Candidate ${c.rank}`, slice: plane === "o2_flow" ? c.pressure_kpa : c.airflow_cm_s }))
        .sort((a, b) => b.rank - a.rank),
    [rank, plane],
  );
  const selectedCandidate = rank?.candidates.find((c) => c.candidate_id === selectedCandidateId) ?? null;
  const exploring = counterfactualOpen && selectedCandidate !== null;
  const highlight = useMemo(() => (exploring ? nearestIds(assess?.coverage.nearest_observations) : []), [exploring, assess]);
  const [compareOpen, setCompareOpen] = useState(false);

  const cfQ = useCounterfactual(
    exploring && hypotheticalOutcome && group && selectedCandidate
      ? {
          group_id: group.group_id,
          target,
          candidate: { oxygen_percent: selectedCandidate.oxygen_percent, airflow_cm_s: selectedCandidate.airflow_cm_s, pressure_kpa: selectedCandidate.pressure_kpa },
          plane,
          slice,
        }
      : null,
  );
  // Placeholder data belongs to the previous slice/plane, and the counterfactual grid uses the default axes: draw the
  // what-if surface only when it is current and matches the drawn surface grid (far targets widen the axes).
  const hypSurface = hypotheticalOutcome && !cfQ.isPlaceholderData && !customAxes ? cfQ.data?.data.scenarios.find((x) => x.outcome === hypotheticalOutcome)?.surface ?? null : null;
  const hypothetical =
    hypSurface && (!surf?.p_sustained || (hypSurface.p_sustained.length === surf.p_sustained.length && hypSurface.p_sustained[0]?.length === surf.p_sustained[0]?.length)) ? hypSurface : null;

  // ---- fallback: set the slice from the resolved target once its analysis loads (idempotent, never overrides a user slice)
  useEffect(() => exploreActions().syncSliceToTarget(assess?.target), [assess]);

  const nearestPoints = (assess?.coverage.nearest_observations ?? []).flatMap((o) => {
    const x = o.oxygen_percent;
    const y = plane === "o2_flow" ? o.airflow_cm_s : o.pressure_kpa;
    return x !== null && y !== null && (plane !== "o2_flow" || y > 0) ? [{ x, y }] : [];
  });
  const exploreCandidate = (c: Candidate) => {
    const a = exploreActions();
    a.selectCandidate(c.candidate_id);
    a.setCounterfactualOpen(true);
    a.setLayers({ candidates: true, target: true, observations: true });
    // The map card is sticky at lg, so bringing the preview into view keeps the reframed map visible beside it.
    setTimeout(() => {
      document.getElementById("counterfactual-preview")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      document.getElementById("cf-heading")?.focus({ preventScroll: true });
    }, 300);
    a.setViewDomain(frameDomain(plane, candidateXY(plane, c), mapTarget, { x: xDomain, y: yDomain }, nearestPoints));
  };

  // Stable callbacks (actions never change identity), so the memoised map and panels do not re-render per zoom frame.
  const onLayer = useCallback((l: LayerName) => exploreActions().toggleLayer(l), []);
  const onOutcome = useCallback((o: "sustained" | "not_sustained" | null) => {
    const a = exploreActions();
    a.setHypotheticalOutcome(o);
    // One surface layer at a time (D3): the what-if is read as the change in knowledge uncertainty.
    if (o) a.setLayers({ uncertainty: true });
  }, []);
  const onViewDomainChange = useCallback((d: ViewDomain | null) => exploreActions().setViewDomain(d), []);
  const onSelectObservation = useCallback((id: string | null) => exploreActions().selectObservation(id), []);
  const onSelectCandidate = useCallback((id: string | null) => exploreActions().selectCandidate(id), []);
  const onGroup = useCallback((id: string) => exploreActions().setGroup(id), []);
  const onPlane = useCallback((p: Plane) => exploreActions().setPlane(p), []);
  const onSlice = useCallback((v: number) => exploreActions().setSlice(v), []);
  const onToggleCompare = useCallback((id: string) => exploreActions().toggleCompare(id), []);
  const onOpenCompare = useCallback(() => setCompareOpen(true), []);
  const onCloseCounterfactual = useCallback(() => {
    const a = exploreActions();
    a.setCounterfactualOpen(false);
    a.selectCandidate(null);
    // Focus returns to the candidate list instead of dropping to <body>.
    requestAnimationFrame(() => document.getElementById("candidate-heading")?.focus({ preventScroll: true }));
  }, []);

  const cmpA = rank?.candidates.find((c) => c.candidate_id === compareIds[0]) ?? null;
  const cmpB = rank?.candidates.find((c) => c.candidate_id === compareIds[1]) ?? null;
  const showEstimate = !!assess && assess.verdict !== "insufficient_evidence";

  const mapLayers = useMemo(
    () => ({ ...layers, prediction: layers.prediction && !!modelled, uncertainty: layers.uncertainty && !!modelled }),
    [layers, modelled],
  );
  const ariaLabel = group
    ? `Coverage map for ${group.label}: ${plane === "o2_flow" ? "oxygen versus airflow" : "oxygen versus pressure"} at ${plane === "o2_flow" ? "pressure" : "airflow"} ${slice}`
    : "Coverage map (loading)";

  // ---- one consistent map frame: shown only when coverage, observations, target and (if needed) surface all belong to the current request
  const obsSettled = !!obsQ.data && !obsQ.isPlaceholderData;
  const assessSettled = !ready || (!assessQ.isPlaceholderData && (!!assessQ.data || assessQ.isError));
  const surfSettled = !needSurface || !!surf || surfQ.isError;
  const liveView = useMemo<MapView | null>(() => {
    if (!group || !cov || !obsSettled || !assessSettled || !surfSettled) return null;
    return { plane, xDomain, yDomain, observations: obsResult.points, coverage: cov, surface: surf, hypothetical, layers: mapLayers, target: mapTarget, candidates, ctx, highlight, ariaLabel };
  }, [group, cov, obsSettled, assessSettled, surfSettled, plane, xDomain, yDomain, obsResult.points, surf, hypothetical, mapLayers, mapTarget, candidates, ctx, highlight, ariaLabel]);
  // Keep the last consistent frame on screen (dimmed) while the next one loads: the map never collapses or remounts.
  const [heldView, setHeldView] = useState<MapView | null>(null);
  if (liveView && liveView !== heldView) setHeldView(liveView);
  const emptyView = useMemo<MapView>(
    () => ({
      plane, xDomain: DEFAULT_X, yDomain: DEFAULT_Y[plane], observations: [], coverage: null, surface: null, hypothetical: null,
      layers: { ...mapLayers, prediction: false, uncertainty: false }, target: null, candidates: [], ctx: { envelopes: [], points: [] }, highlight: [], ariaLabel,
    }),
    [plane, mapLayers, ariaLabel],
  );
  const view = liveView ?? heldView ?? emptyView;
  const mapBusy = liveView === null;

  // ---- loading / error shells
  if (groupsQ.isError && !groupsQ.data) {
    const e = groupsQ.error;
    return <ErrorState code={isApiError(e) ? e.code : "backend_unavailable"} message={e.message} onRetry={() => void groupsQ.refetch()} />;
  }

  const mapNode =
    covQ.isError && !cov && !heldView ? (
      <ErrorState compact code={isApiError(covQ.error) ? covQ.error.code : "backend_unavailable"} message={covQ.error?.message} onRetry={() => void covQ.refetch()} />
    ) : groupsQ.data && groups.length === 0 ? (
      <EmptyState icon={<MapIcon aria-hidden />} title="No analysis groups available" description="The analysis service returned no groups." />
    ) : (
      <div className="relative">
        <div className={mapBusy ? "opacity-55 transition-opacity delay-150 duration-200" : "transition-opacity duration-150"}>
          <ParameterMap
            plane={view.plane}
            xDomain={view.xDomain}
            yDomain={view.yDomain}
            yScale={Y_SCALE[view.plane]}
            observations={view.observations}
            coverage={view.coverage}
            surface={view.surface}
            hypotheticalSurface={view.hypothetical}
            layers={view.layers}
            target={view.target}
            candidates={view.candidates}
            contextEnvelopes={view.ctx.envelopes}
            contextPoints={view.ctx.points}
            highlightObservationIds={view.highlight}
            selectedObservationId={selectedObservationId}
            selectedCandidateId={selectedCandidateId}
            viewDomain={view.plane === plane ? viewDomain : null}
            onViewDomainChange={onViewDomainChange}
            onSelectObservation={onSelectObservation}
            onSelectCandidate={onSelectCandidate}
            plotClassName={MAP_PLOT_CLASS}
            ariaLabel={view.ariaLabel}
          />
        </div>
        {mapBusy ? (
          // Blocks clicks on the previous frame and says what is happening (after a short delay, so cached switches never flash).
          <div className="absolute inset-0 z-10 flex cursor-progress items-start justify-center pt-14" role="status" aria-live="polite">
            <span className="rounded-md bg-surface px-2.5 py-1 text-xs text-muted shadow-popover motion-safe:animate-[fade-in_120ms_ease-out_150ms_both]">
              {heldView ? "Updating map…" : "Loading map…"}
            </span>
          </div>
        ) : null}
      </div>
    );

  const scrollToMap = () => {
    const el = document.querySelector('[data-testid="map-region"]');
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) el.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <div className={`flex flex-col gap-4 ${demoActive ? "pb-[42vh] lg:pb-0" : ""}`}>
      <header className="flex flex-col gap-2">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-fg md:text-[26px]">
          Blind Spots: where NASA&apos;s microgravity fire evidence ends, and what to learn next.
        </h1>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="min-w-0 max-w-[760px]">
            <p className="text-[15px] text-fg">
              Fire safety in crew cabins: spacecraft, and Moon and Mars habitats. This maps which cabin atmospheres NASA&apos;s ISS flame experiments cover, and which they do not.
            </p>
            <p className="mt-1 text-[13px] text-muted">
              Machine learning: a Gaussian-process model that says when it does not know, plus active learning that ranks the most informative next experiment.
            </p>
          </div>
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 lg:flex-nowrap">
            <DemoLauncher />
            <TargetSelector />
          </div>
        </div>
      </header>

      <FindingStrip groups={groups} profiles={profiles} onShowMap={scrollToMap} />
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {assess && group && !assessQ.isPlaceholderData ? `${assess.target.label}, ${group.label}: ${verdictLabel(assess.verdict)}.` : ""}
      </p>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <section
          aria-labelledby="map-heading"
          data-testid="map-region"
          className="min-w-0 rounded-lg border border-border bg-surface lg:sticky lg:top-[calc(var(--header-h)+12px)] lg:z-10 lg:max-h-[calc(100vh-var(--header-h)-24px)] lg:overflow-y-auto"
        >
          <div className="space-y-3 border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
              <h2 id="map-heading" className="sr-only">Coverage map</h2>
              <MaterialSelect groups={groups} value={groupId} onChange={onGroup} />
              <div>
                <p className="mb-1 text-xs text-muted">Plane</p>
                <PlaneSwitch plane={plane} onChange={onPlane} />
              </div>
              <SliceControl plane={plane} value={slice} onCommit={onSlice} snapValues={dm.isSnapshot ? dm.slices?.[plane] ?? null : null} />
            </div>
            <LayerChips layers={layers} onToggle={onLayer} modelled={!!modelled} />
          </div>
          <div className="p-2 sm:p-3" aria-busy={mapBusy}>
            {mapNode}
          </div>
          {group && !modelled ? (
            <p className="border-t border-border px-4 py-2 text-xs text-muted">
              <span className="font-medium text-fg">Coverage only.</span> {group.label} has too few training observations for a model ({group.model_reason ?? "insufficient data"}). Prediction, uncertainty and candidates are unavailable; the map shows observations and coverage.
            </p>
          ) : null}
          <div className="space-y-1 border-t border-border px-4 py-2">
            {group ? <GroupFacts group={group} /> : <p className="text-xs text-muted">&nbsp;</p>}
            {cov ? (
              <p className="text-xs text-muted" data-testid="obs-note">
                <span className="num">{obsResult.points.length}</span> of <span className="num">{obsResult.total}</span> observations in this group are plotted: only those within one reference distance of the{" "}
                {plane === "o2_flow" ? "pressure" : "airflow"} slice
                {obsResult.points.length === 0
                  ? `. No integrated observation lies within this slice${assess?.coverage.nn_distance_min != null ? `; the nearest to the target is ${assess.coverage.nn_distance_min.toFixed(1)} reference distances away` : ""}`
                  : ""}
                {obsResult.hiddenZeroFlow > 0 ? `; ${obsResult.hiddenZeroFlow} zero-flow steps cannot be drawn on the log axis` : ""}.
              </p>
            ) : null}
            {dm.snapshotOnly ? <p className="text-xs text-muted">Precomputed snapshot: slices are limited to the exported values; custom targets are available in the full (local) version.</p> : null}
          </div>
          {mapLayers.context && ctx.envelopes.length > 0 ? (
            <details className="group border-t border-border px-4 py-2 text-xs" data-testid="context-list">
              <summary className="cursor-pointer list-none text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="mr-1 inline-block transition-transform group-open:rotate-90">›</span>
                Dotted boxes: documented work not integrated into the model ({ctx.envelopes.length})
              </summary>
              <ul className="mt-1 space-y-0.5 text-muted">
                {ctx.envelopes.map((e) => (
                  <li key={e.id}>
                    {/* The map tag in bold; the full name once (no "SSCE: SSCE (...)" repetition). */}
                    <span className="font-medium text-fg">{e.short}</span>
                    {e.label.startsWith(e.short) ? e.label.slice(e.short.length) : `: ${e.label}`}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-muted">Each box spans the documented test conditions; the tag on the map names the work where it fits.</p>
              <p className="mt-1 text-muted">Grey triangles are individual documented tests (Saffire, drop tower) that are not integrated either; hover or focus one for its name.</p>
            </details>
          ) : null}
        </section>

        <aside aria-label="Analysis" className="flex min-w-0 flex-col gap-4">
          <DemoOverlay />
          <Panel id="target-heading" title="Target analysis" busy={ready && assessQ.isPlaceholderData}>
            {!ready ? <PanelSkeleton /> : <TargetAnalysis query={assessQ} group={group} pending={false} />}
          </Panel>

          <Panel id="candidate-heading" title="Next research candidate" busy={ready && !!modelled && rankQ.isPlaceholderData}>
            {!ready ? (
              <PanelSkeleton />
            ) : (
              <CandidatePanel
                query={rankQ}
                group={group}
                modelled={!!modelled}
                showEstimate={showEstimate}
                pending={false}
                selectedId={selectedCandidateId}
                compareIds={compareIds}
                onExplore={exploreCandidate}
                onToggleCompare={onToggleCompare}
                onOpenCompare={onOpenCompare}
              />
            )}
          </Panel>

          {exploring && group && selectedCandidate ? (
            <Panel id="cf-heading" title="Counterfactual preview">
              <CounterfactualPanel
                groupId={group.group_id}
                target={target}
                candidate={selectedCandidate}
                plane={plane}
                slice={slice}
                showEstimate={showEstimate}
                outcome={hypotheticalOutcome}
                onOutcome={onOutcome}
                onClose={onCloseCounterfactual}
              />
            </Panel>
          ) : null}
        </aside>
      </div>

      {groups.length > 0 && ready ? (
        <Panel id="material-heading" title="Coverage by material">
          <p className="mb-2 text-xs text-muted">The selected target assessed in every analysis group. Select a row to switch the map.</p>
          <MaterialCoverage groups={groups} target={target} selectedGroupId={groupId} onSelect={onGroup} />
        </Panel>
      ) : null}

      <CompareSheet
        open={compareOpen && !!cmpA && !!cmpB}
        onOpenChange={setCompareOpen}
        groupId={groupId ?? ""}
        target={target}
        showEstimate={showEstimate}
        a={cmpA}
        b={cmpB}
      />
      <FooterStrip
        candidate={
          exploring && selectedCandidate && (!dm.isSnapshot || selectedCandidate.rank === 1)
            ? { oxygen_percent: selectedCandidate.oxygen_percent, airflow_cm_s: selectedCandidate.airflow_cm_s, pressure_kpa: selectedCandidate.pressure_kpa }
            : null
        }
      />
    </div>
  );
}
