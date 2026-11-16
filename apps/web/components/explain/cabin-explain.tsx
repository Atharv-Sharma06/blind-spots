"use client";

import * as React from "react";
import { useAssessTarget, useGroups, useHeadline, useRankCandidates, useTargets } from "@/hooks/api";
import { CANDIDATE_FRAMING } from "@/lib/copy";
import type { GroupSummary } from "@/lib/types";
import { answerSentences, cabinAir, kpaText, lcFirst, trimNum, verdictTitle } from "@/components/home/answer-copy";
import { materialName, shortCabinName } from "@/components/home/cabins";
import { airflowText, oxygenText, pressureText, reductionParts } from "@/components/home/next-logic";
import { ExplainButton } from "./explain-button";

/** Same rule as the "what to test next" step: the chosen material, else the default, else the first modelled one. */
function nextTestsGroup(groups: readonly GroupSummary[], material: string | null): GroupSummary | null {
  return (
    (material ? groups.find((g) => g.group_id === material) : undefined) ??
    groups.find((g) => g.is_default) ??
    groups.find((g) => g.model_status === "modeled") ??
    null
  );
}

/**
 * The Cabins page context for "Explain with SI", built from the same queries (same cache keys) and the same sentence
 * builders the answer card and the next-tests list use, so the model sees exactly what the page shows.
 */
export function CabinExplain({ cabin, material, className }: { cabin: string; material: string | null; className?: string }) {
  const groupsQ = useGroups();
  const targetsQ = useTargets();
  const headlineQ = useHeadline();

  const groups = React.useMemo(() => groupsQ.data?.data ?? [], [groupsQ.data]);
  const profile = targetsQ.data?.data.profiles.find((p) => p.profile_id === cabin && p.kind !== "envelope") ?? null;
  const modelled = groups.filter((g) => g.model_status === "modeled");
  const group = modelled.find((g) => g.group_id === material) ?? modelled.find((g) => g.is_default) ?? modelled[0] ?? null;

  const assessQ = useAssessTarget(group && profile ? { group_id: group.group_id, target: { profile_id: cabin } } : null);
  const assess = assessQ.isPlaceholderData ? null : (assessQ.data?.data ?? null);

  const nextGroup = nextTestsGroup(groups, material);
  const rankable = nextGroup && nextGroup.model_status === "modeled" ? nextGroup : null;
  const rankQ = useRankCandidates(rankable ? { group_id: rankable.group_id, target: { profile_id: cabin }, k: 3 } : null);
  const fresh = rankQ.isPlaceholderData ? null : (rankQ.data?.data ?? null);
  const rank = fresh && rankable && fresh.group_id === rankable.group_id && fresh.target.profile_id === cabin ? fresh : null;

  const headlineProfile = headlineQ.data?.data.profiles.find((p) => p.profile_id === cabin) ?? null;
  const comparableAnyMaterial = headlineProfile ? headlineProfile.comparable_observations : null;
  const headlineSettled = !!headlineQ.data || headlineQ.isError;

  const context = React.useMemo<Record<string, unknown> | null>(() => {
    if (!profile || !group || !assess || !headlineSettled) return null;
    const air = cabinAir(profile);
    const materialLc = lcFirst(materialName(group.group_id, group.label));
    const cov = assess.coverage;
    const facts = {
      verdict: assess.verdict,
      comparable: cov.comparable_observations,
      comparableAnyMaterial,
      pointsWithComparable: cov.points_with_comparable,
      nTargetPoints: cov.n_target_points,
    };
    const top = rank?.candidates.find((c) => c.rank === 1) ?? rank?.candidates[0] ?? null;
    const cut = top ? reductionParts(top) : null;
    return {
      cabin: shortCabinName(profile.profile_id, profile.name),
      cabin_air: air ? `${air.o2UpTo ? "up to " : ""}${trimNum(air.o2, 1)} % oxygen at ${kpaText(air.kpa)} kPa` : "not documented",
      material: materialLc,
      verdict_headline: verdictTitle(facts),
      answer_sentences: answerSentences({ ...facts, assess, group, materialLc, air }),
      nearby_iss_test_results_this_material: cov.comparable_observations,
      nearby_iss_test_results_any_material: comparableAnyMaterial,
      cabin_air_points_with_nearby_iss_tests: `${cov.points_with_comparable} of ${cov.n_target_points}`,
      top_ranked_test:
        top && rank
          ? {
              material: lcFirst(materialName(rankable!.group_id, rankable!.label)),
              oxygen: oxygenText(top),
              pressure: pressureText(top),
              airflow: airflowText(top),
              uncertainty_cut: cut ? `${cut.lead} ${cut.value}` : null,
              framing: CANDIDATE_FRAMING,
            }
          : null,
    };
  }, [profile, group, assess, headlineSettled, comparableAnyMaterial, rank, rankable]);

  return <ExplainButton kind="cabin" context={context} className={className} />;
}
