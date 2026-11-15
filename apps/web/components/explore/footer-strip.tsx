"use client";

import Link from "next/link";
import { briefHref } from "@/components/brief/link";
import { useExploreStore } from "@/lib/explore-store";

const LINK = "inline-flex min-h-10 items-center text-fg underline decoration-fg/30 underline-offset-4 hover:decoration-accent";

/** `candidate`: the candidate being explored, so the brief describes what is on screen. */
export function FooterStrip({ candidate = null }: { candidate?: { oxygen_percent: number; airflow_cm_s: number; pressure_kpa: number } | null }) {
  const groupId = useExploreStore((s) => s.groupId);
  const target = useExploreStore((s) => s.target);
  return (
    <div className="flex flex-wrap items-center gap-x-5 px-1 pt-1 text-xs text-muted" data-testid="footer-strip">
      <span>Data: NASA Physical Sciences Informatics</span>
      <Link href="/methodology" className={LINK}>Sources</Link>
      <Link href={briefHref(groupId, target, candidate)} className={LINK} data-testid="brief-link">Research brief</Link>
      <Link href="/methodology#trust" className={LINK}>How far to trust this</Link>
    </div>
  );
}
