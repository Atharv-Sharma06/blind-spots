"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Map as MapIcon } from "lucide-react";
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
import { materialName } from "@/components/home/cabins";
import { snapSlice } from "@/lib/snapshot";
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
import { ControlLabel, GroupFacts, LayerChips, MaterialSelect, PlaneSwitch, SliceControl } from "./map-controls";
import {
  DEFAULT_X,
  DEFAULT_Y,
  Y_SCALE,
  candidateXY,
  contextForMap,
  frameDomain,
  nearestIds,
  targetSliceFor,
  observationsForMap,
  targetForMap,
  xDomainFor,
} from "./model";
import { PanelSkeleton } from "./query-state";

// Plot height set by CSS (phones 340, tablets 440, lg+: fits the sticky map card in the viewport), so the server
// render already has the final height and phones do not jump at load (a04-02).
const MAP_PLOT_CLASS = "h-[340px] sm:h-[440px] lg:h-[clamp(300px,calc(100vh-620px),640px)]";

const Panel = ({ id, title, children, busy = false, lead }: { id: string; title: string; children: React.ReactNode; busy?: boolean; lead?: React.ReactNode }) => (
  <section aria-labelledby={id} aria-busy={busy} className="card p-6 sm:p-7">
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} tabIndex={-1} className="text-[20px] font-medium leading-7 tracking-[-0.01em] text-fg outline-none">{title}</h2>
      {busy ? <span className="rounded-full bg-subtle px-2.5 py-0.5 text-xs text-muted motion-safe:animate-[fade-in_120ms_ease-out_150ms_both]">Updating…</span> : null}
    </div>
    {lead ? <div className="mt-4">{lead}</div> : null}
    {/* Previous content stays (dimmed, inert) while the new answer loads: no collapse, no stale clicks. */}
    <div className={busy ? "mt-4 opacity-50 transition-opacity delay-150 duration-200" : "mt-4 transition-opacity duration-150"} inert={busy}>
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
    // Live: put the explored candidate on the drawn slice. Snapshot: the exporter stored every candidate's
    // counterfactual at the target's slice on each plane (snapped to the manifest slices), so go there instead;
    // otherwise a slice the user moved earlier would show "Not in this precomputed version".
    if (dm.isSnapshot) {
      const t = targetSliceFor(plane, assess?.target);
      const v = t === null ? null : snapSlice(plane, t, dm.slices);
      if (v !== null) a.setSlice(v, plane);
    } else {
      const v = plane === "o2_pressure" ? c.airflow_cm_s : c.pressure_kpa;
      if (v != null) a.setSlice(v, plane);
    }
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
  const onOpenCompare = useCallback(() => setCompareOpen(true), [setCompareOpen]);
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
    ? `Coverage chart for ${materialName(group.group_id, group.label)}: ${plane === "o2_flow" ? "oxygen versus airflow" : "oxygen versus pressure"} at ${plane === "o2_flow" ? "pressure" : "airflow"} ${slice}`
    : "Coverage chart (loading)";

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
      <EmptyState icon={<MapIcon aria-hidden />} title="No materials available" description="Try again later." />
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
            <span className="rounded-full bg-subtle px-3 py-1 text-xs text-muted shadow-popover motion-safe:animate-[fade-in_120ms_ease-out_150ms_both]">
              {heldView ? "Updating map…" : "Loading map…"}
            </span>
          </div>
        ) : null}
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2 px-1">
        <div className="flex flex-wrap items-center justify-between gap-x-4">
          <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em] text-fg md:text-[40px] md:leading-[44px]">Explorer</h1>
          <Link
            href="/cabins"
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-[14px] text-fg transition-colors hover:bg-subtle"
            data-testid="back-to-cabins"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Cabins
          </Link>
        </div>
        <p className="max-w-[760px] text-[16px] leading-6 text-muted">ISS tests for one material, with the model&apos;s estimate and next tests.</p>
      </header>

      {/* Phones read top to bottom: the answer first, then the chart, then what to test next. At lg the map spans both rows of the left column. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <section
          id="explorer-map"
          aria-labelledby="map-heading"
          data-testid="map-region"
          className="card order-2 min-w-0 scroll-mt-20 lg:sticky lg:top-6 lg:order-none lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto"
        >
          <div className="space-y-4 border-b border-border px-5 pt-5 pb-4 sm:px-6">
            <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
              <h2 id="map-heading" className="sr-only">Coverage chart</h2>
              <MaterialSelect groups={groups} value={groupId} onChange={onGroup} />
              <PlaneSwitch plane={plane} onChange={onPlane} />
            </div>
            <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
              <SliceControl plane={plane} value={slice} onCommit={onSlice} snapValues={dm.isSnapshot ? dm.slices?.[plane] ?? null : null} />
              <LayerChips layers={layers} onToggle={onLayer} modelled={!!modelled} />
            </div>
          </div>
          <p className="px-5 pt-4 text-[13px] text-muted sm:px-6" data-testid="chart-caption">
            Dots are ISS tests. The dashed box is this cabin. Numbers are next tests.
          </p>
          <div className="px-2 pt-2 pb-3 sm:px-4 sm:pb-4" aria-busy={mapBusy}>
            {mapNode}
          </div>
          {group && !modelled ? (
            <p className="border-t border-border px-5 py-3 text-xs text-muted sm:px-6">
              <span className="font-medium text-fg">No estimate for this material.</span> Too few test results. Try another material.
            </p>
          ) : null}
          <div className="space-y-1.5 border-t border-border px-5 py-3 sm:px-6">
            {group ? <GroupFacts group={group} /> : <p className="text-xs text-muted">&nbsp;</p>}
            {cov ? (
              <p className="text-xs text-muted" data-testid="obs-note">
                Showing <span className="num">{obsResult.points.length}</span> of <span className="num">{obsResult.total}</span> test results near the held {plane === "o2_flow" ? "pressure" : "airflow"}.
                {obsResult.hiddenZeroFlow > 0 ? ` ${obsResult.hiddenZeroFlow} with zero airflow are not drawn.` : ""}
              </p>
            ) : null}
            {dm.snapshotOnly ? <p className="text-xs text-muted">Precomputed version: preset values only. Your own cabin needs the full version.</p> : null}
          </div>
          {mapLayers.context && ctx.envelopes.length > 0 ? (
            <details className="group mx-3 mb-3 rounded-[var(--radius-lg)] bg-subtle px-4 py-2.5 text-xs ring-1 ring-border sm:mx-4 sm:mb-4" data-testid="context-list">
              <summary className="block cursor-pointer list-none py-1.5 text-muted hover:text-fg [&::-webkit-details-marker]:hidden [&::marker]:content-none">
                Related NASA work ({ctx.envelopes.length}): dotted boxes the model does not use
              </summary>
              <ul className="mt-2 space-y-1 text-muted">
                {ctx.envelopes.map((e) => (
                  <li key={e.id}>
                    {/* The map tag in bold; the full name once (no "SSCE: SSCE (...)" repetition). */}
                    <span className="font-medium text-fg">{e.short}</span>
                    {e.label.startsWith(e.short) ? e.label.slice(e.short.length) : `: ${e.label}`}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-muted">Grey triangles are single NASA tests, also not used by the model.</p>
            </details>
          ) : null}
        </section>

        <div className="order-1 min-w-0 lg:order-none lg:col-start-2 lg:row-start-1">
          <Panel
            id="target-heading"
            title="Is this cabin covered?"
            busy={ready && assessQ.isPlaceholderData}
            lead={
              <div>
                <ControlLabel id="cabin-label" label="Cabin" />
                <TargetSelector className="w-full" />
              </div>
            }
          >
            {!ready ? <PanelSkeleton /> : <TargetAnalysis query={assessQ} group={group} pending={false} />}
          </Panel>
        </div>

        <aside aria-label="What to test next" className="order-3 flex min-w-0 flex-col gap-5 lg:order-none lg:col-start-2 lg:row-start-2">

          <Panel id="candidate-heading" title="What to test next" busy={ready && !!modelled && rankQ.isPlaceholderData}>
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
            <Panel id="cf-heading" title="What would we learn?">
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
          <p className="mb-3 text-xs text-muted">Pick a row to switch the chart.</p>
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
