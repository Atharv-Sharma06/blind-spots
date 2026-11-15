"use client";

import { useHeadline } from "@/hooks/api";
import { Button } from "@/components/ui/button";
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

/** Placeholder text block: wraps exactly like the real text it stands in for, so nothing moves when data arrive. */
function Ghost({ children }: { children: string }) {
  return <span className="rounded-sm bg-subtle text-transparent [box-decoration-break:clone] motion-safe:animate-pulse">{children}</span>;
}

/**
 * Headline finding from GET /api/headline (never hard-coded): comparable observations for the ISS cabin
 * versus the NASA Exploration Atmosphere across all analysis groups, plus the integrated envelope.
 */
export function FindingStrip({ groups, profiles, onShowMap }: { groups: readonly GroupSummary[]; profiles: readonly AtmosphereProfile[]; onShowMap: () => void }) {
  const headline = useHeadline();
  const iss = profiles.find((p) => p.profile_id === ISS_PROFILE_ID) ?? null;
  const gap = profiles.find((p) => p.profile_id === BLIND_SPOT_PROFILE_ID) ?? null;
  const h = headline.data?.data;
  const issT = h?.profiles.find((p) => p.profile_id === ISS_PROFILE_ID) ?? null;
  const gapT = h?.profiles.find((p) => p.profile_id === BLIND_SPOT_PROFILE_ID) ?? null;
  const target = useExploreStore((s) => s.target);
  const plane = useExploreStore((s) => s.plane);
  const o2 = h?.envelope.oxygen_percent ?? null;
  const kpa = h?.envelope.pressure_kpa ?? null;
  const partlyAssumed = (h?.envelope.n_steps_pressure_assumed ?? 0) > 0;

  const loading = headline.isPending || groups.length === 0 || profiles.length === 0;
  // D1: hide the strip on error or when either profile is absent; never show placeholder numbers.
  if (headline.isError) return null;
  if (!loading && (!iss || !gap || !issT || !gapT)) return null;

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
          <div role="status" aria-label="Loading the key finding" className="flex-1">
            <dl aria-hidden className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
              {[iss, gap].map((p, k) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs text-muted">
                    <Ghost>{p ? `${p.name}${profileConditions(p) ? ` (${profileConditions(p)})` : ""}` : k === 0 ? "ISS cabin (nominal operating range)" : "NASA Exploration Atmosphere (8.2 psia / 34 % O2)"}</Ghost>
                  </dt>
                  <dd className="mt-0.5 text-[13px] text-fg">
                    <span className="num text-[17px] font-semibold"><Ghost>000</Ghost></span>
                    <Ghost>{" comparable observations, in 00 of 00 material groups"}</Ghost>
                  </dd>
                </div>
              ))}
              <div className="min-w-0">
                <dt className="text-xs text-muted">
                  <Ghost>All integrated ISS records</Ghost>
                </dt>
                <dd className="mt-0.5 text-[13px] text-fg">
                  <span className="num text-[17px] font-semibold"><Ghost>00.0–00.0</Ghost></span>
                  <Ghost>{" % O₂, "}</Ghost>
                  <span className="num text-[17px] font-semibold"><Ghost>00–000</Ghost></span>
                  <Ghost>{" kPa (pressure partly assumed)"}</Ghost>
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <dl className="grid flex-1 gap-x-6 gap-y-3 sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-xs text-muted">{iss.name}{profileConditions(iss) ? ` (${profileConditions(iss)})` : ""}</dt>
              <dd className="mt-0.5 text-[13px] text-fg">
                <span className="num text-[17px] font-semibold">{issT.comparable_observations}</span> comparable observations
                <span className="text-muted">, in {issT.groups_with_comparable} of {issT.n_groups} material groups</span>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted">{gap.name}{profileConditions(gap) ? ` (${profileConditions(gap)})` : ""}</dt>
              <dd className="mt-0.5 text-[13px] text-fg">
                <span className="num text-[17px] font-semibold">{gapT.comparable_observations}</span> comparable observations
                <span className="text-muted">{gapT.groups_with_comparable === 0 ? `, across all ${gapT.n_groups} material groups` : `, in ${gapT.groups_with_comparable} of ${gapT.n_groups} material groups`}</span>
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
