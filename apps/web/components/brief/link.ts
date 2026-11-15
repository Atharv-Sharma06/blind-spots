import { decodeTarget, encodeTarget } from "@/lib/explore-store";
import type { Point, Target } from "@/lib/types";

/** `/brief?group=&target=[&candidate=o2,airflow,pressure]` (candidate order: O2 %, airflow cm/s, pressure kPa). */
export function briefHref(groupId: string | null, target: Target, candidate?: Point | null): string {
  const p = new URLSearchParams();
  if (groupId) p.set("group", groupId);
  p.set("target", encodeTarget(target));
  if (candidate) p.set("candidate", [candidate.oxygen_percent, candidate.airflow_cm_s, candidate.pressure_kpa].join(","));
  return `/brief?${p.toString()}`;
}

export interface ParsedBriefQuery {
  group: string | null;
  target: Target | null;
  candidate: Point | null;
}

export function parseBriefQuery(p: URLSearchParams): ParsedBriefQuery {
  const t = p.get("target");
  const c = p.get("candidate");
  let candidate: Point | null = null;
  if (c) {
    const segments = c.split(",").map((x) => x.trim());
    if (segments.length === 3 && segments.every((x) => x !== "")) {
      const [o, f, k] = segments.map((x) => Number(x)) as [number, number, number];
      // Same ranges the API accepts: O2 in (0, 100] %, pressure > 0 kPa, airflow >= 0 cm/s.
      if ([o, f, k].every(Number.isFinite) && o > 0 && o <= 100 && k > 0 && f >= 0) {
        candidate = { oxygen_percent: o, airflow_cm_s: f, pressure_kpa: k };
      }
    }
  }
  return { group: p.get("group"), target: t ? decodeTarget(t) : null, candidate };
}
