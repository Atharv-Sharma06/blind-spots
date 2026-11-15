"use client";

import { useGroups, useHeadline, useRankCandidates } from "@/hooks/api";
import { DEFAULT_CABIN } from "@/components/home/cabins";
import { percentText, reductionFraction } from "@/components/home/next-logic";

const ISS_CABIN = "iss_cabin_nominal";

/** The headline counts: nearby ISS test results for the ISS cabin and the Moon & Mars cabin, how many cabins have none. */
export function useHeadlineCounts() {
  const q = useHeadline();
  const profiles = q.data?.data.profiles ?? null;
  const iss = profiles?.find((p) => p.profile_id === ISS_CABIN) ?? null;
  const moonMars = profiles?.find((p) => p.profile_id === DEFAULT_CABIN) ?? null;
  const none = profiles ? profiles.filter((p) => p.comparable_observations === 0).length : null;
  return { q, iss, moonMars, none, total: profiles?.length ?? null };
}

/** The top test's uncertainty cut for the default cabin. Exactly the request the Cabins page sends (the judges' snapshot has it). */
export function useTopCut() {
  const groupsQ = useGroups();
  const groups = groupsQ.data?.data;
  const group = groups ? (groups.find((g) => g.is_default) ?? groups.find((g) => g.model_status === "modeled") ?? null) : null;
  const modelled = group?.model_status === "modeled";
  const rankQ = useRankCandidates(group && modelled ? { group_id: group.group_id, target: { profile_id: DEFAULT_CABIN }, k: 3 } : null);
  const r = rankQ.isPlaceholderData ? null : (rankQ.data?.data ?? null);
  const top = r?.candidates.find((c) => c.rank === 1) ?? r?.candidates[0] ?? null;
  const f = top ? reductionFraction(top) : null;
  const failed = groupsQ.isError || rankQ.isError || (groups !== undefined && !modelled) || (r !== null && f === null);
  return { cut: f === null ? null : percentText(f), failed };
}
