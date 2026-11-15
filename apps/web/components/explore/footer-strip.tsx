"use client";

import Link from "next/link";
import { DataSourceBadge } from "@/components/data-source-badge";
import { briefHref } from "@/components/brief/link";
import { useExploreStore } from "@/lib/explore-store";
import { useDataMode, useHealth } from "@/hooks/api";
import { shortVersion } from "@/lib/format";

export function FooterStrip() {
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
      <span className="num">Dataset {shortVersion(dataset)} · Model {model ?? "—"}</span>
      <DataSourceBadge />
      <Link href={briefHref(groupId, target)} className="text-fg underline underline-offset-2" data-testid="brief-link">Research brief</Link>
      <Link href="/methodology#limitations" className="text-fg underline underline-offset-2">Limitations</Link>
    </div>
  );
}
