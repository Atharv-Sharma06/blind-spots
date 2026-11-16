"use client";

import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Download, Printer, ArrowLeft, ChevronDown, Info } from "lucide-react";
import Link from "next/link";
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
    <article className="brief-root mx-auto w-full max-w-[880px] px-4 py-6 md:px-6 md:py-10" data-testid="brief">
      <style>{`
        /* v2: a surface-coloured document card on the canvas. Every colour is a theme token, so it reads right in light and dark. */
        .brief-doc{background:var(--surface);color:var(--fg);border:1px solid var(--border);border-radius:24px;padding:24px 20px 28px}
        @media (min-width:640px){.brief-doc{padding:44px 48px 40px}}
        .brief-pill{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 18px;border:1px solid var(--border-strong);border-radius:9999px;background:transparent;color:var(--fg);font-size:14px;line-height:20px;font-weight:500;white-space:nowrap;text-decoration:none;transition:background-color .15s,border-color .15s}
        .brief-pill:hover{background:color-mix(in srgb,var(--fg) 6%,transparent);border-color:var(--fg)}
        .brief-pill svg{width:18px;height:18px;flex-shrink:0}
        .brief-pill-ink{background:var(--ink-card);border-color:var(--ink-card);color:var(--on-ink);border-radius:14px;padding:0 22px;font-weight:500}
        .brief-pill-ink:hover{background:color-mix(in srgb,var(--ink-card) 88%,var(--on-ink));border-color:color-mix(in srgb,var(--ink-card) 88%,var(--on-ink))}
        .brief-pill:disabled{opacity:.45;pointer-events:none}
        .brief-pill:focus-visible,.brief-sec>summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
        .brief-sec>summary:focus-visible{border-radius:8px}
        .brief-sec>summary{list-style:none}
        .brief-sec>summary::-webkit-details-marker{display:none}
        .brief-sec>summary::before{display:none!important}
        .brief-sec{border-top:1px solid var(--border)}
        .brief-secs{border-bottom:1px solid var(--border)}
        .brief-sec[open] .brief-chev{transform:rotate(180deg)}
        .brief-note{display:flex;gap:12px;border:1px solid var(--border);border-radius:12px;padding:14px 16px;font-size:14px;line-height:20px;color:var(--fg)}
        .brief-verdict{border-radius:16px;padding:22px 20px;background:var(--subtle);border:1px solid var(--border);color:var(--fg)}
        @media (min-width:640px){.brief-verdict{padding:28px}}
        /* "Blind spot" verdict: the inverting ink card (dark card with light text in light mode, light card with dark text in dark mode). */
        .brief-verdict[data-verdict=insufficient_evidence]{--fg:var(--on-ink);--muted:color-mix(in srgb,var(--on-ink) 72%,var(--ink-card));--border:color-mix(in srgb,var(--on-ink) 16%,transparent);background:var(--ink-card);border-color:var(--ink-card);color:var(--on-ink)}
        .brief-verdict[data-verdict=insufficient_evidence] .brief-ink-muted{color:var(--muted)}
        .brief-verdict[data-verdict=insufficient_evidence] .brief-rule{border-color:var(--border)}
        .brief-dot{display:inline-block;width:12px;height:12px;border-radius:9999px;flex-shrink:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .brief-prose,.brief-prose *{overflow-wrap:anywhere;min-width:0}
        .brief-prose pre{overflow-x:auto}
        .brief-print-only{display:none}
        .brief-prose .brief-body{font-size:16px;line-height:1.6;color:var(--fg)}
        .brief-prose p,.brief-prose li{max-width:72ch}
        .brief-prose a{text-decoration-color:var(--border-strong)}
        .brief-prose a:hover{color:var(--accent)}
        @media print{
          /* Print is always a light document: re-pin the tokens on the brief itself so a dark theme never reaches the paper. */
          html{color-scheme:light!important}
          .brief-root{--bg:#fff;--band:#fff;--surface:#fff;--subtle:#f4f4f5;--border:#d4d4d8;--border-strong:#a1a1aa;--fg:#111;--muted:#52525b;--accent:#0b5f2c;--ink-card:#fff;--on-ink:#111}
          body>header,body>footer,body>a,.no-print{display:none!important}
          .brief-print-only{display:block!important}
          .brief-chev{display:none!important}
          html,body{background:#fff!important;background-image:none!important;color:#111!important}
          body::before,body::after{display:none!important}
          .brief-root .brief-doc{background:none!important;border:0!important;border-radius:0!important;padding:0!important;box-shadow:none!important;color:#111!important}
          .brief-root .brief-card{background:none!important;box-shadow:none!important;border:1px solid #d4d4d8!important;border-radius:8px!important;color:#111!important;filter:none!important}
          .brief-root .brief-card::before,.brief-root .brief-card::after{display:none!important}
          .brief-root .brief-card *{color:#111!important}
          .brief-root .brief-card .brief-ink-muted{color:#52525b!important}
          .brief-root .brief-card .brief-rule{border-color:#d4d4d8!important}
          .brief-root .brief-verdict[data-verdict=insufficient_evidence] .brief-dot{background:#111!important}
          .brief-secs{border-bottom:0!important}
          .brief-sec{margin-bottom:8px;border-color:#d4d4d8!important}
          .brief-sec>summary{min-height:0!important;padding:6px 10px!important}
          .brief-sec>div{padding:8px 10px!important;border-color:#d4d4d8!important}
          @page{size:A4;margin:18mm 16mm}
          .brief-root{max-width:none!important;padding:0!important}
          .brief-prose .brief-body{font-size:10pt;line-height:1.45;color:#111!important}
          .brief-prose h1,.brief-prose h2{break-after:avoid;page-break-after:avoid;color:#111!important}
          .brief-prose li:not(:has(ul,ol)){break-inside:avoid}
          .brief-prose p,.brief-prose li{orphans:3;widows:3}
          .brief-prose a{color:inherit;text-decoration:none}
        }
      `}</style>

      <div className="no-print brief-ui mb-4 flex flex-wrap items-center gap-2 sm:mb-6">
        <Link href={exploreHref} aria-label="Back to Explorer" className="brief-pill max-md:px-3.5"><ArrowLeft aria-hidden />Explorer</Link>
        {cabinsHref ? (
          <Link href={cabinsHref} className="brief-pill max-md:px-3.5"><ArrowLeft aria-hidden />Cabins</Link>
        ) : null}
        <div className="ml-auto flex gap-2 max-[359px]:ml-0">
          <button type="button" aria-label="Download .md" title="Save as a Markdown file" className="brief-pill max-sm:min-w-11 max-sm:px-0" disabled={!brief} onClick={() => brief && download(`blind-spots-brief-${slug(groupId ?? "group")}.md`, cleanBriefText(brief.markdown))}>
            <Download aria-hidden /><span className="max-sm:sr-only">Download</span>
          </button>
          <button type="button" aria-label="Print / Save as PDF" title="Print or save as PDF" className="brief-pill brief-pill-ink max-sm:px-4" disabled={!brief} onClick={() => { flushSync(() => setPrinting(true)); window.print(); setPrinting(false); }}>
            <Printer aria-hidden />Print
          </button>
        </div>
      </div>

      <div className="brief-doc">
      {(groupsQ.isError && !groups) || (targetsQ.isError && !profiles) ? (
        <QueryError error={groupsQ.error ?? targetsQ.error} onRetry={() => { void groupsQ.refetch(); void targetsQ.refetch(); }} />
      ) : briefQ.isError && !brief ? (
        <QueryError error={briefQ.error} onRetry={() => void briefQ.refetch()} />
      ) : !brief ? (
        <div role="status" aria-label="Generating research brief" className="min-h-[70svh] space-y-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : (
        <div className="brief-prose">
          <header className="pb-1">
            <p className="brief-ui text-xs font-medium uppercase tracking-[0.08em] text-muted">Research brief</p>
            <h1 className="mt-3 text-[30px] font-medium leading-[1.1] tracking-[-0.03em] text-balance sm:text-[40px] sm:leading-[44px]">{plainTitle ?? brief.title.replace(/^Research brief:\s*/, "")}</h1>
          </header>

          <InShort profileId={profileId} groupId={groupId} />

          <div role="note" className="brief-ui brief-card brief-note my-5">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
            <div className="min-w-0">
              <p className="font-medium">Computational research-planning output</p>
              <div className="mt-0.5 text-muted">Not a certified fire-safety assessment. Not endorsed by NASA. This brief contains no test procedures.</div>
            </div>
          </div>

          <div className="brief-secs mt-8">
            {SECTIONS.map(({ key, title }) => {
              const text = brief.sections[key];
              if (!text || text.trim() === "") return null;
              const open = printing || (openMap[key] ?? (!hasShort && (key === "coverage" || key === "candidate")));
              return (
                <details key={key} className="brief-sec" open={open}>
                  <summary
                    className="flex min-h-16 cursor-pointer items-center gap-3 py-3"
                    onClick={(e) => {
                      e.preventDefault();
                      setOpenMap((m) => ({ ...m, [key]: !open }));
                    }}
                  >
                    <h2 id={`brief-${key}`} className="text-[20px] font-medium leading-7 tracking-[-0.015em]">{title}</h2>
                    <ChevronDown aria-hidden className="brief-chev ml-auto size-5 shrink-0 text-muted transition-transform motion-reduce:transition-none" />
                  </summary>
                  <div className="brief-body border-t border-border py-4 pb-6">
                    <MarkdownLite markdown={text} />
                  </div>
                </details>
              );
            })}
          </div>

          <footer className="brief-ui mt-8 space-y-1 text-xs text-muted">
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
      </div>
    </article>
  );
}
