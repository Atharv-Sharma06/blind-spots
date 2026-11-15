"use client";

import { CircleAlert, CircleCheck, EyeOff, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import type { Verdict } from "@/lib/types";
import { useAssessTarget, useGroups, useHeadline, useRankCandidates } from "@/hooks/api";
import { materialName } from "@/components/home/cabins";
import { verdictTitle } from "@/components/home/answer-copy";
import { CANDIDATE_FRAMING } from "@/lib/copy";
import { airflowText, atTargetSentence, isAtTarget, lowerFirst, oxygenText, pressurePsiaText, pressureText, reductionSentence } from "@/components/home/next-logic";

/** Same hue per meaning as the Cabins answer: blind spot = magenta, partly = yellow, covered = periwinkle. Icon + words carry it too. */
const TONE: Record<Verdict, { Icon: LucideIcon; card: string; icon: string; title?: string }> = {
  insufficient_evidence: { Icon: EyeOff, card: "card-magenta", icon: "text-white" },
  extrapolation: { Icon: CircleAlert, card: "card ring-1 ring-accent/40", icon: "text-accent", title: "text-accent" },
  supported: { Icon: CircleCheck, card: "card-indigo", icon: "text-periwinkle" },
};

/**
 * "In short": the verdict and the best next test, first thing in the brief. It sends the same two requests the Cabins page makes for a
 * named cabin (assess and rank, k = 3), so the snapshot already has them; every figure comes from those responses.
 * Shown only for a named cabin on a modelled material; otherwise it renders nothing and the full brief below stands alone.
 */
export function InShort({ profileId, groupId }: { profileId: string | null; groupId: string | null }) {
  const groupsQ = useGroups();
  const headlineQ = useHeadline();
  const group = groupId ? (groupsQ.data?.data.find((g) => g.group_id === groupId) ?? null) : null;
  const modelled = group?.model_status === "modeled";
  const assessQ = useAssessTarget(profileId && group && modelled ? { group_id: group.group_id, target: { profile_id: profileId } } : null);
  const rankQ = useRankCandidates(profileId && group && modelled ? { group_id: group.group_id, target: { profile_id: profileId }, k: 3 } : null);

  if (!profileId || !groupId) return null;
  if (groupsQ.data && (!group || !modelled)) return null;

  const assess = assessQ.isPlaceholderData ? null : (assessQ.data?.data ?? null);
  const fresh = rankQ.isPlaceholderData ? null : (rankQ.data?.data ?? null);
  const rank = fresh && group && fresh.group_id === group.group_id && fresh.target.profile_id === profileId ? fresh : null;
  const settled = (assessQ.isError || assess) && (rankQ.isError || rank || rankQ.isFetched);

  if (!settled || !group) {
    return (
      <div role="status" aria-label="Loading the short answer" className="brief-ui brief-card card my-5 min-h-[120px] p-5 sm:p-7">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mt-3 h-6 w-4/5" />
        <Skeleton className="mt-3 h-4 w-full" />
      </div>
    );
  }
  if (!assess) return null;

  const headlineProfile = headlineQ.data?.data.profiles.find((p) => p.profile_id === profileId) ?? null;
  const title = verdictTitle({ verdict: assess.verdict, comparable: assess.coverage.comparable_observations, comparableAnyMaterial: headlineProfile ? headlineProfile.comparable_observations : null });
  const c = rank?.candidates[0];
  const material = lowerFirst(materialName(group.group_id, group.label));
  const reduction = c ? reductionSentence(c) : null;

  const tone = TONE[assess.verdict] ?? TONE.extrapolation;

  return (
    <section aria-labelledby="brief-in-short-h" className={cn("brief-ui brief-card brief-in-short my-5 p-5 sm:p-7", tone.card)} data-testid="brief-in-short" data-verdict={assess.verdict}>
      <h2 id="brief-in-short-h" className="brief-ink-muted inline-block rounded-full bg-black/35 px-2.5 py-0.5 text-xs font-medium uppercase tracking-[0.12em] text-white print:bg-transparent print:px-0">
        In short
      </h2>
      <p className="mt-3 flex items-start gap-3 text-[22px] leading-[28px] font-semibold tracking-[-0.01em] text-balance sm:text-[26px] sm:leading-[32px]" data-testid="brief-in-short-verdict">
        <tone.Icon aria-hidden className={cn("mt-0.5 size-6 shrink-0 sm:mt-1 sm:size-7", tone.icon)} />
        <span className={tone.title}>{title}</span>
      </p>
      {c && rank ? (
        <p className="mt-4 text-[15px] leading-relaxed" data-testid="brief-in-short-next">
          <span className="font-semibold">Best next test:</span> {material}, {oxygenText(c)} oxygen, {pressureText(c)} ({pressurePsiaText(c)}), {airflowText(c)} airflow.
          {reduction ? ` ${reduction}` : ""}
          {isAtTarget(c, rank.target) ? ` ${atTargetSentence(c, rank.target)}` : ""}
        </p>
      ) : null}
      {c && rank ? <p className="brief-ink-muted mt-3 text-xs leading-relaxed">{CANDIDATE_FRAMING}</p> : null}
    </section>
  );
}
