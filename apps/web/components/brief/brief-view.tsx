"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/explore/query-state";
import { useBrief, useGroups, useTargets } from "@/hooks/api";
import { pickDefaultGroup, pickDefaultProfile } from "@/lib/explore-store";
import { DISCLAIMER } from "@/lib/copy";
import { shortVersion } from "@/lib/format";
import { materialName, shortCabinName } from "@/components/home/cabins";
import type { BriefResponse } from "@/lib/types";
import { MarkdownLite, cleanBriefText } from "./markdown-lite";
import { parseBriefQuery } from "./link";
import { InShort } from "./in-short";

/** Section order and headings follow the API's `sections` keys (UI constants; text comes from the API). */
const SECTIONS: { key: keyof BriefResponse["sections"]; title: string }[] = [
  { key: "target", title: "1. Target atmosphere (the cabin's air)" },
  { key: "coverage", title: "2. Do the ISS tests cover it?" },
  { key: "model", title: "3. The model and how it was checked" },
  { key: "candidate", title: "4. What to test next (research candidate)" },
  { key: "historical_investigations", title: "5. Nearby ISS results and related NASA work" },
  { key: "citations", title: "6. Citations" },
  { key: "limitations", title: "7. Limitations" },
];

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking synchronously can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "2026-11-15T18:44:59Z" -> "15 Nov 2026, 18:44 UTC" (unparseable values are shown as given). */
function fmtGenerated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} UTC`;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export function BriefView() {
  const params = useSearchParams();
  const q = useMemo(() => parseBriefQuery(new URLSearchParams(params.toString())), [params]);
  const groupsQ = useGroups();
  const targetsQ = useTargets();
  const groups = groupsQ.data?.data;
  const profiles = targetsQ.data?.data.profiles;

  const groupId = q.group ?? (groups ? pickDefaultGroup(groups)?.group_id ?? null : null);
  const target = q.target ?? (profiles ? (() => { const p = pickDefaultProfile(profiles); return p ? { profile_id: p.profile_id } : null; })() : null);
  const briefQ = useBrief(groupId && target ? { group_id: groupId, target, candidate: q.candidate } : null);
  const brief = briefQ.isPlaceholderData ? null : briefQ.data?.data ?? null;

  const exploreHref = useMemo(() => {
    const p = new URLSearchParams();
    if (groupId) p.set("group", groupId);
    if (params.get("target")) p.set("target", params.get("target") as string);
    const s = p.toString();
    return s ? `/explore?${s}` : "/explore";
  }, [groupId, params]);

  // Named cabins also link back to the Cabins page; a custom target only exists in the Explorer.
  const profileId = target && "profile_id" in target ? target.profile_id : null;
  const profile = profileId ? profiles?.find((p) => p.profile_id === profileId) ?? null : null;
  const group = groupId ? groups?.find((g) => g.group_id === groupId) ?? null : null;
  const cabinsHref = useMemo(() => {
    if (!profileId) return null;
    const p = new URLSearchParams({ cabin: profileId });
    if (groupId) p.set("material", groupId);
    return `/?${p.toString()}`;
  }, [profileId, groupId]);
  // Plain heading from the same names the Cabins page uses; the API's full title stays underneath as the exact name.
  const plainTitle = profile && group ? `${materialName(group.group_id, group.label)} in ${shortCabinName(profile.profile_id, profile.name)}` : null;

  return (
    <article className="brief-root mx-auto w-full max-w-[760px] px-4 py-8 md:py-12" data-testid="brief">
      <style>{`
        .brief-prose,.brief-prose *{overflow-wrap:anywhere;min-width:0}
        .brief-prose pre{overflow-x:auto}
        .brief-prose{font-size:15px;line-height:1.65;color:var(--fg)}
        .brief-prose p,.brief-prose li{max-width:72ch}
        @media print{
          body>header,body>footer,body>a,.no-print{display:none!important}
          html,body{background:#fff!important}
          @page{size:A4;margin:18mm 16mm}
          .brief-root{max-width:none!important;padding:0!important}
          .brief-prose{font-size:10pt;line-height:1.45}
          .brief-prose h1,.brief-prose h2{break-after:avoid;page-break-after:avoid}
          .brief-prose li:not(:has(ul,ol)){break-inside:avoid}
          .brief-prose p,.brief-prose li{orphans:3;widows:3}
          .brief-prose a{color:inherit;text-decoration:none}
        }
      `}</style>

      <div className="no-print brief-ui mb-4 flex flex-nowrap items-center gap-1.5 sm:mb-6 sm:flex-wrap sm:gap-2">
        <Button asChild variant="ghost" size="sm" className="max-md:px-2">
          <Link href={exploreHref} aria-label="Back to Explorer"><ArrowLeft aria-hidden />Back<span className="hidden sm:inline">&nbsp;to Explorer</span></Link>
        </Button>
        {cabinsHref ? (
          <Button asChild variant="ghost" size="sm" className="max-md:px-2">
            <Link href={cabinsHref}><ArrowLeft aria-hidden />Cabins</Link>
          </Button>
        ) : null}
        <div className="ml-auto flex gap-1.5 sm:flex-wrap sm:gap-2">
          <Button variant="secondary" aria-label="Download .md" className="max-md:px-2.5" disabled={!brief} onClick={() => brief && download(`blind-spots-brief-${slug(groupId ?? "group")}.md`, cleanBriefText(brief.markdown))}>
            <Download aria-hidden />Download<span className="hidden sm:inline">&nbsp;.md</span>
          </Button>
          <Button variant="primary" aria-label="Print / Save as PDF" className="max-md:px-2.5" disabled={!brief} onClick={() => window.print()}>
            <Printer aria-hidden />Print<span className="hidden sm:inline">&nbsp;/ Save as PDF</span>
          </Button>
        </div>
      </div>

      {(groupsQ.isError && !groups) || (targetsQ.isError && !profiles) ? (
        <QueryError error={groupsQ.error ?? targetsQ.error} onRetry={() => { void groupsQ.refetch(); void targetsQ.refetch(); }} />
      ) : briefQ.isError && !brief ? (
        <QueryError error={briefQ.error} onRetry={() => void briefQ.refetch()} />
      ) : !brief ? (
        <div role="status" aria-label="Generating research brief" className="min-h-[100svh] space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : (
        <div className="brief-prose">
          <header className="border-b border-border-strong pb-5">
            <p className="brief-ui text-xs font-medium uppercase tracking-[0.08em] text-muted">Blind Spots · Research brief</p>
            <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em]">{plainTitle ?? brief.title.replace(/^Research brief:\s*/, "")}</h1>
            {plainTitle ? <p className="brief-ui mt-1 text-[13px] text-muted">{brief.title.replace(/^Research brief:\s*/, "")}</p> : null}
            <p className="brief-ui mt-2 max-w-[62ch] text-[15px] leading-relaxed sm:mt-3">
              Do NASA&apos;s ISS flame tests cover this cabin&apos;s air, and which research candidate would teach the model the most?
              <span className="hidden sm:inline"> The sections below keep the exact technical terms; see{" "}
              <Link href="/methodology#nearby" className="text-accent underline underline-offset-2">How it works</Link> for what &quot;nearby&quot; means.</span>
            </p>
          </header>

          <InShort profileId={profileId} groupId={groupId} />

          <dl className="brief-ui num mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
            <div className="flex gap-1.5"><dt>Generated</dt><dd className="text-fg">{fmtGenerated(brief.generated_at)}</dd></div>
            <div className="flex gap-1.5"><dt>Dataset</dt><dd className="text-fg">{shortVersion(brief.dataset_version)}</dd></div>
            <div className="flex gap-1.5"><dt>Model</dt><dd className="text-fg">{brief.model_version}</dd></div>
          </dl>

          <Callout variant="info" title="Computational research-planning output" className="brief-ui my-5">
            {DISCLAIMER} Candidate conditions are computational research candidates requiring qualified scientific review, established safety procedures and formal feasibility assessment. This brief contains no test procedures.
          </Callout>

          {SECTIONS.map(({ key, title }) => {
            const text = brief.sections[key];
            if (!text || text.trim() === "") return null;
            return (
              <section key={key} className="mt-7" aria-labelledby={`brief-${key}`}>
                <h2 id={`brief-${key}`} className="mb-2 border-b border-border pb-1 text-[18px] font-semibold tracking-[-0.01em]">{title}</h2>
                <MarkdownLite markdown={text} />
              </section>
            );
          })}

          <footer className="mt-10 border-t border-border-strong pt-4 text-[13px] text-muted">
            <p>{DISCLAIMER}</p>
            <p className="mt-1">Data: NASA Physical Sciences Informatics (CC0). Generated by the Blind Spots analysis service from the integrated records listed above; numbers are model-based and carry the uncertainty stated in section 3.</p>
            <p className="mt-1">
              Code and text were written with SI assistance (Claude, by Anthropic); every number comes from NASA data processed by that code.{" "}
              <Link href="/methodology#si" className="no-print text-accent underline underline-offset-2">How it works</Link>
            </p>
          </footer>
        </div>
      )}
    </article>
  );
}
