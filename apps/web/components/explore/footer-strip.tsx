"use client";

import Link from "next/link";
import { briefHref } from "@/components/brief/link";
import { useExploreStore } from "@/lib/explore-store";
import { useDataMode, useHealth } from "@/hooks/api";
import { shortVersion } from "@/lib/format";

/** `candidate`: the candidate being explored, so the brief describes what is on screen. */
export function FooterStrip({ candidate = null }: { candidate?: { oxygen_percent: number; airflow_cm_s: number; pressure_kpa: number } | null }) {
  const { health } = useHealth();
  const dm = useDataMode();
  const groupId = useExploreStore((s) => s.groupId);
  const target = useExploreStore((s) => s.target);
  const model = health?.model_version ?? dm.modelVersion;
  const dataset = health?.dataset_version ?? null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted" data-testid="footer-strip">
      <span>
        Sources: NASA Physical Sciences Informatics (BASS, BASS-II), NASA technical reports;{" "}
        <Link href="/methodology" className="text-fg underline underline-offset-2">dataset sources</Link>
      </span>
      <span>Dataset <span className="num">{shortVersion(dataset)}</span> · Model <span className="num">{model ?? "—"}</span></span>
      <Link href={briefHref(groupId, target, candidate)} className="text-fg underline underline-offset-2" data-testid="brief-link">{candidate ? "Research brief for this candidate" : "Research brief"}</Link>
      <Link href="/methodology#trust" className="text-fg underline underline-offset-2">How far to trust this</Link>
      <Link href="/methodology#limitations" className="text-fg underline underline-offset-2">Limitations</Link>
    </div>
  );
}
