/**
 * The slice of GET /api/findings the landing teaser reads (full contract: .work/competitors/PLAN.md, F1).
 * Pure helpers only, so the teaser shows exactly the API's sentences and hides itself when they are absent.
 */

export type TeaserFinding = { id: string; kind: string; pillar: string; headline: string };

export type TeaserMaterial = { rank: number; group_id: string; label: string; findings: TeaserFinding[] };

export type TeaserFindingsResponse = {
  summary?: { n_observations?: number; n_groups?: number } | null;
  materials?: TeaserMaterial[] | null;
};

export type TeaserRow = { rank: number; groupId: string; label: string; pillar: string; headline: string };

const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/**
 * The top `n` ranked materials that have at least one finding, each with its first finding's headline
 * (the API orders findings with "lowest oxygen that kept burning" first when the data supports it).
 * Ranks are the API's own numbers; nothing is re-ranked or rewritten. Returns [] for missing or malformed data.
 */
export function topFindingRows(resp: TeaserFindingsResponse | null | undefined, n = 3): TeaserRow[] {
  const materials = Array.isArray(resp?.materials) ? resp.materials : [];
  const rows: TeaserRow[] = [];
  for (const m of [...materials].sort((a, b) => a.rank - b.rank)) {
    if (!Number.isFinite(m?.rank) || !isText(m?.label)) continue;
    const f = Array.isArray(m.findings) ? m.findings.find((x) => isText(x?.headline)) : undefined;
    if (!f) continue;
    rows.push({ rank: m.rank, groupId: m.group_id, label: m.label, pillar: f.pillar, headline: f.headline });
    if (rows.length === n) break;
  }
  return rows;
}

/** Whole-number count from the summary, or null when it is missing (never a made-up zero). */
export function countOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

/** "Prevention" / "Suppression" as a word; anything else (never expected) is not shown. */
export function pillarWord(p: string): string | null {
  if (p === "prevention") return "Prevention";
  if (p === "suppression") return "Suppression";
  return null;
}
