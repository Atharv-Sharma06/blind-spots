"use client";

import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Download, Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/explore/query-state";
import { useBrief, useGroups, useTargets } from "@/hooks/api";
import { pickDefaultGroup, pickDefaultProfile } from "@/lib/explore-store";
import { DATA_CREDIT, SI_NOTE } from "@/lib/copy";
import { shortVersion } from "@/lib/format";
import { materialName, shortCabinName } from "@/components/home/cabins";
import type { BriefResponse } from "@/lib/types";
import { MarkdownLite, cleanBriefText } from "./markdown-lite";
import { parseBriefQuery } from "./link";
import { InShort } from "./in-short";

/** Section order and headings follow the API's `sections` keys (UI constants; text comes from the API). */
const SECTIONS: { key: keyof BriefResponse["sections"]; title: string }[] = [
  { key: "target", title: "1. Target atmosphere" },
  { key: "coverage", title: "2. Do the ISS tests cover it?" },
  { key: "model", title: "3. How the model was checked" },
  { key: "candidate", title: "4. What to test next" },
  { key: "historical_investigations", title: "5. Nearby ISS tests and NASA work" },
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

  // Sections start closed behind the verdict; every section opens for print so the PDF is complete.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const on = () => flushSync(() => setPrinting(true));
    const off = () => setPrinting(false);
    window.addEventListener("beforeprint", on);
    window.addEventListener("afterprint", off);
    return () => {
      window.removeEventListener("beforeprint", on);
      window.removeEventListener("afterprint", off);
    };
  }, []);

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
    return `/cabins?${p.toString()}`;
  }, [profileId, groupId]);
  // Plain heading from the same names the Cabins page uses; the API's full title stays underneath as the exact name.
  // Without the "In short" box (custom target, or no model for this material) the two answer sections start open.
  const hasShort = !!profileId && (group ? group.model_status === "modeled" : !groups);
  const plainTitle = profile && group ? `${materialName(group.group_id, group.label)} in ${shortCabinName(profile.profile_id, profile.name)}` : null;

  return (
    <article className="brief-root mx-auto w-full max-w-[760px] px-4 py-8 md:py-12" data-testid="brief">
      <style>{`
        .brief-prose,.brief-prose *{overflow-wrap:anywhere;min-width:0}
        .brief-prose pre{overflow-x:auto}
        .brief-print-only{display:none}
        .brief-sec>summary:focus-visible{outline:2px solid var(--fg);outline-offset:2px;border-radius:4px}
        .brief-prose{font-size:15px;line-height:1.65;color:var(--fg)}
        .brief-prose p,.brief-prose li{max-width:72ch}
        @media print{
          body>header,body>footer,body>a,.no-print{display:none!important}
          .brief-print-only{display:block!important}
          .brief-sec>summary::before{display:none}
          html,body{background:#fff!important;background-image:none!important;color:#111!important}
          body::before,body::after{display:none!important}
          .brief-root .brief-card{background:none!important;box-shadow:none!important;border:1px solid #d4d4d8!important;border-radius:8px!important;color:#111!important;filter:none!important}
          .brief-root .brief-card::before,.brief-root .brief-card::after{display:none!important}
          .brief-root .brief-card *{color:#111!important}
          .brief-root .brief-card .brief-ink-muted{color:#52525b!important}
          .brief-sec>summary{min-height:0!important;padding:6px 10px!important}
          .brief-sec>div{padding:8px 10px!important;border-color:#d4d4d8!important}
          @page{size:A4;margin:18mm 16mm}
          .brief-root{max-width:none!important;padding:0!important}
          .brief-prose{font-size:10pt;line-height:1.45}
          .brief-prose h1,.brief-prose h2{break-after:avoid;page-break-after:avoid}
          .brief-prose li:not(:has(ul,ol)){break-inside:avoid}
          .brief-prose p,.brief-prose li{orphans:3;widows:3}
          .brief-prose a{color:inherit;text-decoration:none}
        }
      `}</style>

      <div className="no-print brief-ui mb-6 flex flex-wrap items-center gap-2 sm:mb-8">
        <Button asChild variant="secondary" size="sm" className="min-h-10 rounded-full max-md:px-3">
          <Link href={exploreHref} aria-label="Back to Explorer"><ArrowLeft aria-hidden />Explorer</Link>
        </Button>
        {cabinsHref ? (
          <Button asChild variant="secondary" size="sm" className="min-h-10 rounded-full max-md:px-3">
            <Link href={cabinsHref}><ArrowLeft aria-hidden />Cabins</Link>
          </Button>
        ) : null}
        <div className="ml-auto flex gap-2 max-[359px]:ml-0">
          <Button variant="secondary" aria-label="Download .md" title="Save as a Markdown file" className="min-h-10 rounded-full max-md:px-3 max-sm:min-w-10 max-sm:px-0" disabled={!brief} onClick={() => brief && download(`blind-spots-brief-${slug(groupId ?? "group")}.md`, cleanBriefText(brief.markdown))}>
            <Download aria-hidden /><span className="max-sm:sr-only">Download</span>
          </Button>
          <Button variant="primary" aria-label="Print / Save as PDF" title="Print or save as PDF" className="pill-yellow min-h-10 rounded-full border-transparent bg-[#F2D21B] font-semibold text-[#0B0B0C] hover:bg-[#F2D21B] hover:brightness-105 max-md:px-3" disabled={!brief} onClick={() => { flushSync(() => setPrinting(true)); window.print(); setPrinting(false); }}>
            <Printer aria-hidden />Print
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
          <header className="pb-1">
            <p className="brief-ui text-xs font-medium uppercase tracking-[0.12em] text-muted">Research brief</p>
            <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-balance sm:text-[34px] sm:leading-[40px]">{plainTitle ?? brief.title.replace(/^Research brief:\s*/, "")}</h1>
          </header>

          <InShort profileId={profileId} groupId={groupId} />

          <Callout variant="info" title="Computational research-planning output" className="brief-ui brief-card my-5">
            Not a certified fire-safety assessment. Not endorsed by NASA. This brief contains no test procedures.
          </Callout>

          <div className="mt-6 space-y-3">
            {SECTIONS.map(({ key, title }) => {
              const text = brief.sections[key];
              if (!text || text.trim() === "") return null;
              const open = printing || (openMap[key] ?? (!hasShort && (key === "coverage" || key === "candidate")));
              return (
                <details
                  key={key}
                  className="brief-sec brief-card card overflow-hidden"
                  open={open}
                >
                  <summary
                    className="flex min-h-14 cursor-pointer items-center gap-3 px-5 py-3 sm:px-6"
                    onClick={(e) => {
                      e.preventDefault();
                      setOpenMap((m) => ({ ...m, [key]: !open }));
                    }}
                  >
                    <h2 id={`brief-${key}`} className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
                  </summary>
                  <div className="border-t border-border px-5 py-4 sm:px-6">
                    <MarkdownLite markdown={text} />
                  </div>
                </details>
              );
            })}
          </div>

          <footer className="brief-ui mt-8 space-y-1 border-t border-border-strong pt-4 text-xs text-muted">
            <dl className="num flex flex-wrap gap-x-5 gap-y-1">
              <div className="flex gap-1.5"><dt>Generated</dt><dd className="text-fg">{fmtGenerated(brief.generated_at)}</dd></div>
              <div className="flex gap-1.5"><dt>Dataset</dt><dd className="text-fg">{shortVersion(brief.dataset_version)}</dd></div>
              <div className="flex gap-1.5"><dt>Model</dt><dd className="text-fg">{brief.model_version}</dd></div>
            </dl>
            <p>Numbers are model-based; uncertainty is in section 3.</p>
            <p className="brief-print-only">{DATA_CREDIT}. {SI_NOTE}</p>
          </footer>
        </div>
      )}
    </article>
  );
}
