"use client";

import { useMemo } from "react";
import { useAssessTarget, useGroups, useObservations, useTargets } from "@/hooks/api/queries";
import type { AssessRequest, AtmosphereProfile, GroupSummary } from "@/lib/types";

/** Documented cabins with a nominal oxygen and pressure point (the ones with precomputed assessments). */
export function cabinProfiles(profiles: AtmosphereProfile[] | undefined): AtmosphereProfile[] {
  return (profiles ?? []).filter(
    (p) => p.kind !== "envelope" && p.oxygen_percent.nominal != null && p.total_pressure_kpa.nominal != null,
  );
}

export function useAskData(groupId: string | null, assess: AssessRequest | null) {
  const targets = useTargets();
  const groups = useGroups();
  const observations = useObservations(groupId);
  const assessQ = useAssessTarget(assess);
  const cabins = useMemo(() => cabinProfiles(targets.data?.data.profiles), [targets.data]);
  const groupList: GroupSummary[] = useMemo(() => groups.data?.data ?? [], [groups.data]);
  return { targets, groups, observations, assessQ, cabins, groupList };
}
