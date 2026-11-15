"use client";

import { Map as MapIcon, Crosshair, Diamond } from "lucide-react";
import { BackendGate } from "@/components/backend-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/ui/section-header";
import { CANDIDATE_FRAMING } from "@/lib/copy";

function PanelSkeleton() {
  return (
    <div className="space-y-2 py-1" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}

/** Layout skeleton for the Explore workspace: map region on the left, analysis panel on the right. */
export function ExploreWorkspace() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
      <section
        aria-labelledby="map-heading"
        data-testid="map-region"
        className="flex min-h-[360px] flex-col rounded-lg border border-border bg-surface md:min-h-[480px] lg:min-h-[calc(100dvh-15rem)]"
      >
        <div className="border-b border-border px-4 py-3">
          <SectionHeader as="h2" title={<span id="map-heading">Coverage map</span>} description="Observed experiments, sparse regions and model uncertainty in one view." />
        </div>
        <div className="flex flex-1 items-center justify-center px-4">
          <BackendGate
            align="center"
            loading={
              <div className="w-full" role="status" aria-label="Loading coverage map">
                <Skeleton className="h-[240px] w-full" />
              </div>
            }
          >
            <EmptyState
              align="center"
              icon={<MapIcon aria-hidden />}
              title="Coverage map not available yet"
              description="This region is reserved for the coverage map. It will show only values computed from the integrated NASA records."
            />
          </BackendGate>
        </div>
      </section>

      <aside aria-label="Analysis" className="flex flex-col gap-4">
        <section aria-labelledby="target-heading" className="rounded-lg border border-border bg-surface p-4">
          <SectionHeader as="h2" title={<span id="target-heading">Target analysis</span>} />
          <div className="mt-3">
            <BackendGate loading={<PanelSkeleton />} compact>
              <EmptyState
                compact
                icon={<Crosshair aria-hidden />}
                title="No target selected"
                description="Choose a cabin atmosphere to see how much experimental evidence surrounds it."
              />
            </BackendGate>
          </div>
        </section>

        <section aria-labelledby="candidate-heading" className="rounded-lg border border-border bg-surface p-4">
          <SectionHeader as="h2" title={<span id="candidate-heading">Next research candidate</span>} />
          <div className="mt-3">
            <BackendGate loading={<PanelSkeleton />} compact>
              <EmptyState
                compact
                icon={<Diamond aria-hidden />}
                title="No candidate yet"
                description="Candidates are ranked after a target is analysed."
              />
            </BackendGate>
          </div>
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted">{CANDIDATE_FRAMING}</p>
        </section>
      </aside>
    </div>
  );
}
