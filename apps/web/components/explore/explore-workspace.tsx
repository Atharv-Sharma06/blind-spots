"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Map as MapIcon } from "lucide-react";
import ParameterMap from "@/components/visualization/parameter-map";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
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
import { encodeTarget, useExploreStore, useExploreUrlSync, type LayerName } from "@/lib/explore-store";
import type { Candidate, GridQuery, Plane } from "@/lib/types";
import { FooterStrip } from "./footer-strip";
import { LayerChips, MaterialSelect, PlaneSwitch, SliceControl } from "./map-controls";
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
  targetSliceFor,
  xDomainFor,
} from "./model";
import { PanelSkeleton } from "./query-state";
import { DemoLauncher, DemoOverlay } from "@/components/demo/guided-demo";

function useMapHeight(): number {
  const [h, setH] = useState(560);
  useEffect(() => {
    const f = () => setH(window.innerWidth < 640 ? 340 : window.innerWidth < 1024 ? 440 : 560);
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return h;
}

const Panel = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section aria-labelledby={id} className="rounded-lg border border-border bg-surface p-4">
    <SectionHeader as="h2" title={<span id={id}>{title}</span>} />
    <div className="mt-3">{children}</div>
  </section>
);

export function ExploreWorkspace() {
  useExploreUrlSync();
  const dm = useDataMode();
  const mapHeight = useMapHeight();

  const s = useExploreStore();
  const { groupId, plane, target, layers, viewDomain, selectedCandidateId, compareIds, counterfactualOpen, hypotheticalOutcome } = s;
  const slice = s.slice[plane];

  const groupsQ = useGroups();
  const targetsQ = useTargets();
  const groups = useMemo(() => groupsQ.data?.data ?? [], [groupsQ.data]);
  const profiles = useMemo(() => targetsQ.data?.data.profiles ?? [], [targetsQ.data]);
  useEffect(() => {
    s.initDefaults({ groups, profiles });
    // initDefaults only applies when the current choice is unset/invalid
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, profiles]);

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

  const cov = covQ.data?.data && covQ.data.data.group_id === groupId && covQ.data.data.plane === plane ? covQ.data.data : null;
  const surf = surfQ.data?.data && surfQ.data.data.group_id === groupId && surfQ.data.data.plane === plane ? surfQ.data.data : null;

  // ---- derived map data
  const obsResult = useMemo(
    () => observationsForMap(plane, obsQ.data?.data ?? [], cov ? new Set(cov.observations_in_slice) : null),
    [plane, obsQ.data, cov],
  );
  const mapTarget = useMemo(() => targetForMap(plane, assess?.target), [plane, assess?.target]);
  const ctx = useMemo(() => contextForMap(plane, ctxQ.data?.data, plane === "o2_flow" ? slice : undefined), [plane, ctxQ.data, slice]);
  const candidates = useMemo(
    () => (rank?.candidates ?? []).map((c) => ({ id: c.candidate_id, rank: c.rank, ...candidateXY(plane, c), title: `Candidate ${c.rank}` })),
    [rank, plane],
  );
  const selectedCandidate = rank?.candidates.find((c) => c.candidate_id === selectedCandidateId) ?? null;
  const exploring = counterfactualOpen && selectedCandidate !== null;
  const highlight = useMemo(() => (exploring ? nearestIds(assess?.coverage.nearest_observations) : []), [exploring, assess]);

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
  const hypothetical = hypotheticalOutcome ? cfQ.data?.data.scenarios.find((x) => x.outcome === hypotheticalOutcome)?.surface ?? null : null;

  // ---- sync the slice to the target when the target changes (once its analysis has loaded)
  const sliceTargetKey = useRef<string>("");
  const key = `${encodeTarget(target)}|${plane}`;
  useEffect(() => {
    if (!assess || sliceTargetKey.current === key) return;
    sliceTargetKey.current = key;
    const v = targetSliceFor(plane, assess.target);
    if (v === null) return;
    const snap = dm.slices?.[plane];
    const snapped = dm.isSnapshot && snap && snap.length > 0 ? snap.reduce((b, x) => (Math.abs(x - v) < Math.abs(b - v) ? x : b), snap[0] as number) : Math.round(v * 10) / 10;
    s.setSlice(snapped, plane);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assess, key]);

  const nearestPoints = (assess?.coverage.nearest_observations ?? []).flatMap((o) => {
    const x = o.oxygen_percent;
    const y = plane === "o2_flow" ? o.airflow_cm_s : o.pressure_kpa;
    return x !== null && y !== null && (plane !== "o2_flow" || y > 0) ? [{ x, y }] : [];
  });
  const exploreCandidate = (c: Candidate) => {
    s.selectCandidate(c.candidate_id);
    s.setCounterfactualOpen(true);
    s.setLayer("candidates", true);
    s.setLayer("target", true);
    s.setLayer("observations", true);
    setTimeout(() => document.getElementById("counterfactual-preview")?.scrollIntoView({ block: "nearest" }), 300);
    s.setViewDomain(frameDomain(plane, candidateXY(plane, c), mapTarget, { x: xDomain, y: yDomain }, nearestPoints));
  };

  const onLayer = (l: LayerName) => s.toggleLayer(l);
  const onOutcome = (o: typeof hypotheticalOutcome) => {
    s.setHypotheticalOutcome(o);
    if (o) {
      s.setLayer("uncertainty", true);
      s.setLayer("prediction", true);
    }
  };

  const cmpA = rank?.candidates.find((c) => c.candidate_id === compareIds[0]) ?? null;
  const cmpB = rank?.candidates.find((c) => c.candidate_id === compareIds[1]) ?? null;
  const [compareOpen, setCompareOpen] = useState(false);
  const demoActive = s.demo.active;
  const showEstimate = !!assess && assess.verdict !== "insufficient_evidence";

  const mapLayers = { ...layers, prediction: layers.prediction && !!modelled, uncertainty: layers.uncertainty && !!modelled };

  // ---- loading / error shells
  if (groupsQ.isError && !groupsQ.data) {
    const e = groupsQ.error;
    return <ErrorState code={isApiError(e) ? e.code : "backend_unavailable"} message={e.message} onRetry={() => void groupsQ.refetch()} />;
  }

  const mapNode = (() => {
    if (!group || !cov) {
      if (covQ.isError) {
        const e = covQ.error;
        return <ErrorState compact code={isApiError(e) ? e.code : "backend_unavailable"} message={e.message} onRetry={() => void covQ.refetch()} />;
      }
      return (
        <div role="status" aria-label="Loading coverage map" className="w-full">
          <Skeleton style={{ height: mapHeight }} className="w-full" />
        </div>
      );
    }
    return (
      <ParameterMap
        plane={plane}
        xDomain={xDomain}
        yDomain={yDomain}
        yScale={Y_SCALE[plane]}
        observations={obsResult.points}
        coverage={cov}
        surface={surf}
        hypotheticalSurface={hypothetical}
        layers={mapLayers}
        target={mapTarget}
        candidates={candidates}
        contextEnvelopes={ctx.envelopes}
        contextPoints={ctx.points}
        highlightObservationIds={highlight}
        selectedObservationId={s.selectedObservationId}
        selectedCandidateId={selectedCandidateId}
        viewDomain={viewDomain}
        onViewDomainChange={(d) => s.setViewDomain(d)}
        onSelectObservation={s.selectObservation}
        onSelectCandidate={s.selectCandidate}
        height={mapHeight}
        ariaLabel={`Coverage map for ${group.label}: ${plane === "o2_flow" ? "oxygen versus airflow" : "oxygen versus pressure"} at ${plane === "o2_flow" ? "pressure" : "airflow"} ${slice}`}
      />
    );
  })();

  return (
    <div className={`flex flex-col gap-4 ${demoActive ? "pb-[42vh] lg:pb-0" : ""}`}>
      <SectionHeader
        as="h1"
        title="Experimental coverage"
        description="Explore what NASA has measured — and what remains uncertain."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DemoLauncher />
            <TargetSelector />
          </div>
        }
        className="flex-col sm:flex-row"
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-labelledby="map-heading" data-testid="map-region" className={`rounded-lg border border-border bg-surface ${demoActive ? "lg:sticky lg:top-3 lg:z-10" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <SectionHeader as="h2" title={<span id="map-heading">Coverage map</span>} description={group ? group.label : undefined} />
              {viewDomain ? (
                <Button size="sm" variant="secondary" onClick={() => s.setViewDomain(null)}>Reset view</Button>
              ) : null}
            </div>
            <div className="p-2 sm:p-3" aria-busy={covQ.isFetching}>
              {!groupsQ.data && groupsQ.isPending ? (
                <Skeleton style={{ height: mapHeight }} className="w-full" />
              ) : groups.length === 0 ? (
                <EmptyState icon={<MapIcon aria-hidden />} title="No analysis groups available" description="The analysis service returned no groups." />
              ) : (
                mapNode
              )}
            </div>
            {mapLayers.context && ctx.envelopes.length > 0 ? (
              <details className="border-t border-border px-4 py-2 text-xs" data-testid="context-list">
                <summary className="cursor-pointer text-fg">Documented NASA work not integrated ({ctx.envelopes.length} boxes, C1 to C{ctx.envelopes.length})</summary>
                <ol className="mt-1 space-y-0.5 text-muted">
                  {ctx.envelopes.map((e, i) => (
                    <li key={e.id}>
                      <span className="num text-fg">C{i + 1}</span> {e.label}: documented test conditions, not integrated into the model
                    </li>
                  ))}
                </ol>
                <p className="mt-1 text-muted">Grey triangles are individual documented tests (Saffire, drop tower) that are not integrated either; hover one for its name.</p>
              </details>
            ) : null}
            {cov ? (
              <p className="num border-t border-border px-4 py-2 text-xs text-muted" data-testid="obs-note">
                {obsResult.points.length} of {obsResult.total} observations in this group are plotted: only those within one scale unit of the {plane === "o2_flow" ? "pressure" : "airflow"} slice
                {obsResult.points.length === 0
                  ? `. No integrated observation lies within this slice${assess?.coverage.nn_distance_min != null ? `; the nearest to the target is ${assess.coverage.nn_distance_min.toFixed(1)} reference distances away` : ""}`
                  : ""}
                {obsResult.hiddenZeroFlow > 0 ? `; ${obsResult.hiddenZeroFlow} zero-flow steps cannot be drawn on the log axis` : ""}.
              </p>
            ) : null}
          </section>

          <section aria-label="Map controls" className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <LayerChips layers={layers} onToggle={onLayer} modelled={!!modelled} />
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <div>
                <p className="mb-1 text-xs text-muted">Plane</p>
                <PlaneSwitch plane={plane} onChange={(p: Plane) => s.setPlane(p)} />
              </div>
              <SliceControl plane={plane} value={slice} onCommit={(v) => s.setSlice(v)} snapValues={dm.isSnapshot ? dm.slices?.[plane] ?? null : null} />
              <MaterialSelect groups={groups} value={groupId} onChange={s.setGroup} />
            </div>
            {group && !modelled ? (
              <Callout variant="info" title="Coverage only">
                {group.label} has too few training observations for a model ({group.model_reason ?? "insufficient data"}). Prediction, uncertainty and candidates are unavailable; the map shows observations and coverage.
              </Callout>
            ) : null}
            {dm.snapshotOnly ? (
              <p className="text-xs text-muted">Precomputed snapshot: slice values are limited to those exported; custom targets require the live analysis service.</p>
            ) : null}
          </section>

          {groups.length > 0 && ready ? (
            <Panel id="material-heading" title="Coverage by material">
              <p className="mb-2 text-xs text-muted">The selected target assessed in every analysis group. Select a row to switch the map.</p>
              <MaterialCoverage groups={groups} target={target} selectedGroupId={groupId} onSelect={s.setGroup} />
            </Panel>
          ) : null}
        </div>

        <aside aria-label="Analysis" className="flex min-w-0 flex-col gap-4">
          <DemoOverlay />
          <Panel id="target-heading" title="Target analysis">
            {!ready ? <PanelSkeleton /> : <TargetAnalysis query={assessQ} group={group} pending={assessQ.isPlaceholderData} />}
          </Panel>

          <Panel id="candidate-heading" title="Next research candidate">
            {!ready ? (
              <PanelSkeleton />
            ) : (
              <CandidatePanel
                query={rankQ}
                group={group}
                modelled={!!modelled}
                showEstimate={showEstimate}
                pending={rankQ.isPlaceholderData}
                selectedId={selectedCandidateId}
                compareIds={compareIds}
                onExplore={exploreCandidate}
                onToggleCompare={s.toggleCompare}
                onOpenCompare={() => setCompareOpen(true)}
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
                onClose={() => {
                  s.setCounterfactualOpen(false);
                  s.selectCandidate(null);
                }}
              />
            </Panel>
          ) : null}
        </aside>
      </div>

      <CompareSheet
        open={compareOpen && !!cmpA && !!cmpB}
        onOpenChange={setCompareOpen}
        groupId={groupId ?? ""}
        target={target}
        showEstimate={showEstimate}
        a={cmpA}
        b={cmpB}
      />
      <FooterStrip />
    </div>
  );
}
