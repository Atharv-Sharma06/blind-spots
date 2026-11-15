"use client";

import Link from "next/link";
import { briefHref } from "@/components/brief/link";
import { useExploreStore } from "@/lib/explore-store";
import { useHealth } from "@/hooks/api";

/** `candidate`: the candidate being explored, so the brief describes what is on screen. */
export function FooterStrip({ candidate = null }: { candidate?: { oxygen_percent: number; airflow_cm_s: number; pressure_kpa: number } | null }) {
  const { health } = useHealth();
  const groupId = useExploreStore((s) => s.groupId);
  const target = useExploreStore((s) => s.target);
  const dataset = health?.dataset_version ?? null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-0 border-t border-border pt-3 text-xs text-muted" data-testid="footer-strip">
      <span>
        Sources: NASA Physical Sciences Informatics (BASS, BASS-II), NASA technical reports;{" "}
        <Link href="/methodology" className="inline-flex min-h-10 items-center text-fg underline underline-offset-2 sm:min-h-0">dataset sources</Link>
      </span>
      <span>Data version <span className="num">{dataset ? dataset.slice(0, 12) : "—"}</span></span>
      <Link href={briefHref(groupId, target, candidate)} className="inline-flex min-h-10 items-center text-fg underline underline-offset-2 sm:min-h-0" data-testid="brief-link">{candidate ? "Research brief for this candidate" : "Research brief"}</Link>
      <Link href="/methodology#trust" className="inline-flex min-h-10 items-center text-fg underline underline-offset-2 sm:min-h-0">How far to trust this</Link>
      <Link href="/methodology#limitations" className="inline-flex min-h-10 items-center text-fg underline underline-offset-2 sm:min-h-0">Limitations</Link>
    </div>
  );
}
