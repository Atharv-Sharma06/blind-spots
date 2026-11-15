"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { fmtFixed } from "@/lib/format";
import { useExploreStore } from "@/lib/explore-store";
import type { AtmosphereProfile, GroupSummary } from "@/lib/types";

/** Profiles compared by the finding strip (ids from data/manifests/atmosphere_profiles.json; hidden when absent). */
export const ISS_PROFILE_ID = "iss_cabin_nominal";
export const BLIND_SPOT_PROFILE_ID = "exploration_atmosphere_8p2_34";

const KPA_PER_PSI = 6.894757293168361;

function profileConditions(p: AtmosphereProfile): string | null {
  if (/psia|kPa/i.test(p.name)) return null; // the name already states its conditions
  const o2 = p.oxygen_percent.nominal ?? p.oxygen_percent.max;
  const kpa = p.total_pressure_kpa.nominal ?? p.total_pressure_kpa.max;
  if (o2 === null || kpa === null) return null;
  return `${fmtFixed(kpa / KPA_PER_PSI, 1)} psia / ${fmtFixed(o2, 0)} % O₂`;
}

const range = (vals: Array<[number, number] | null>): [number, number] | null => {
  const flat = vals.flatMap((v) => (v ? v : []));
  return flat.length ? [Math.min(...flat), Math.max(...flat)] : null;
};

/** Sums comparable observations over every analysis group for one profile (from /api/target/assess). */
function useProfileTotals(groups: readonly GroupSummary[], profileId: string | null) {
  return useQueries({
    queries: groups.map((g) => {
      const body = { group_id: g.group_id, target: { profile_id: profileId ?? "" } };
      return {
        queryKey: queryKeys.assess(body),
        queryFn: ({ signal }: { signal: AbortSignal }) => api.assessTarget(body, signal),
        enabled: !!profileId,
        staleTime: 60_000,
        retry: false,
      };
    }),
    combine: (rs) => {
      if (!profileId || rs.length === 0 || rs.some((r) => !r.data)) return null;
      let total = 0;
      let groupsWith = 0;
      for (const r of rs) {
        const n = r.data?.data.coverage.comparable_observations ?? 0;
        total += n;
        if (n > 0) groupsWith += 1;
      }
      return { total, groupsWith, groups: rs.length };
    },
  });
}

/**
 * Headline finding, computed from the API (never hard-coded): comparable observations for the ISS cabin
 * versus the NASA Exploration Atmosphere across all analysis groups, plus the integrated envelope.
 */
export function FindingStrip({ groups, profiles, onShowMap }: { groups: readonly GroupSummary[]; profiles: readonly AtmosphereProfile[]; onShowMap: () => void }) {
  const iss = profiles.find((p) => p.profile_id === ISS_PROFILE_ID) ?? null;
  const gap = profiles.find((p) => p.profile_id === BLIND_SPOT_PROFILE_ID) ?? null;
  const issT = useProfileTotals(groups, iss ? iss.profile_id : null);
  const gapT = useProfileTotals(groups, gap ? gap.profile_id : null);
  const target = useExploreStore((s) => s.target);
  const plane = useExploreStore((s) => s.plane);
  const o2 = useMemo(() => range(groups.map((g) => g.oxygen_percent_range)), [groups]);
  const kpa = useMemo(() => range(groups.map((g) => g.pressure_kpa_range)), [groups]);
  const partlyAssumed = groups.some((g) => !g.pressure_measured);

  const loading = groups.length === 0 || profiles.length === 0 || (iss && !issT) || (gap && !gapT);
  if (!loading && (!iss || !gap)) return null;

  const current = "profile_id" in target ? target.profile_id : null;
  const go = (profileId: string, p: "o2_flow" | "o2_pressure") => {
    const st = useExploreStore.getState();
    if (current !== profileId) st.setTarget({ profile_id: profileId });
    st.setPlane(p);
    st.setViewDomain(null);
    st.setLayer("observations", true);
    st.setLayer("target", true);
    onShowMap();
  };
  const issActive = current === ISS_PROFILE_ID && plane === "o2_flow";
  const gapActive = current === BLIND_SPOT_PROFILE_ID && plane === "o2_pressure";

  return (
    <section aria-label="Key finding" data-testid="finding-strip" className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        {loading || !iss || !gap || !issT || !gapT ? (
          <div role="status" aria-label="Loading the key finding" className="grid flex-1 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((k) => (
              <div key={k} className="space-y-1.5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <dl className="grid flex-1 gap-x-6 gap-y-3 sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-xs text-muted">{iss.name}{profileConditions(iss) ? ` (${profileConditions(iss)})` : ""}</dt>
              <dd className="mt-0.5 text-[13px] text-fg">
                <span className="num text-[17px] font-semibold">{issT.total}</span> comparable observations
                <span className="text-muted">, in {issT.groupsWith} of {issT.groups} material groups</span>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted">{gap.name}{profileConditions(gap) ? ` (${profileConditions(gap)})` : ""}</dt>
              <dd className="mt-0.5 text-[13px] text-fg">
                <span className="num text-[17px] font-semibold">{gapT.total}</span> comparable observations
                <span className="text-muted">{gapT.groupsWith === 0 ? `, in all ${gapT.groups} material groups` : `, in ${gapT.groupsWith} of ${gapT.groups} material groups`}</span>
              </dd>
            </div>
            {o2 && kpa ? (
              <div className="min-w-0">
                <dt className="text-xs text-muted">All integrated ISS records</dt>
                <dd className="mt-0.5 text-[13px] text-fg">
                  <span className="num text-[17px] font-semibold">{fmtFixed(o2[0], 1)}–{fmtFixed(o2[1], 1)}</span> % O₂,{" "}
                  <span className="num text-[17px] font-semibold">{fmtFixed(kpa[0], 0)}–{fmtFixed(kpa[1], 0)}</span> kPa
                  {partlyAssumed ? <span className="text-muted"> (pressure partly assumed)</span> : null}
                </dd>
              </div>
            ) : null}
          </dl>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="md"
            variant={issActive ? "primary" : "secondary"}
            aria-pressed={issActive}
            disabled={!iss}
            onClick={() => go(ISS_PROFILE_ID, "o2_flow")}
            className={cn(!iss && "invisible")}
          >
            See the ISS evidence
          </Button>
          <Button
            size="md"
            variant={gapActive ? "primary" : "secondary"}
            aria-pressed={gapActive}
            disabled={!gap}
            onClick={() => go(BLIND_SPOT_PROFILE_ID, "o2_pressure")}
            className={cn(!gap && "invisible")}
          >
            See the blind spot
          </Button>
        </div>
      </div>
    </section>
  );
}
