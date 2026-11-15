/**
 * Defensive accessors for the D2 / investigation-relevance fields the backend is adding
 * (points_supported, investigation_relevance). Absent fields stay absent: nothing here invents a value.
 */
import type { AssessResponse, Candidate, ResolvedTarget, Verdict } from "@/lib/types";

type Loose = Record<string, unknown>;
const asObj = (v: unknown): Loose => (typeof v === "object" && v !== null ? (v as Loose) : {});
const int = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** Target points individually supported (D2), when the API reports it; null otherwise. */
export function pointsSupported(a: AssessResponse): number | null {
  const srcs = [asObj(a), asObj(a.coverage), asObj(a.model)];
  for (const s of srcs) for (const k of ["points_supported", "n_points_supported"]) if (int(s[k]) !== null) return int(s[k]);
  const vc = asObj(asObj(a)["verdict_counts"] ?? asObj(a.coverage)["verdict_counts"]);
  return int(vc["supported"]);
}

/**
 * Whether a target-level P(sustained) may be shown (D2): only over supported points. With the D2 field
 * present, need >= 1 supported point and non-null P; without it (older API), only a `supported` verdict.
 */
export function targetPAllowed(a: AssessResponse): boolean {
  if (a.model.model_status !== "modeled") return false;
  if (a.model.p_sustained_min === null || a.model.p_sustained_max === null) return false;
  const s = pointsSupported(a);
  return s !== null ? s > 0 : a.verdict === "supported";
}

/** Point-level support threshold on the latent std ratio (CONTRACTS section 4 / decisions). */
export const SUPPORT_LATENT_RATIO = 0.6;

/** Candidate P only where the candidate point is supported: API non-null and latent std ratio < 0.6. */
export function candidatePAllowed(c: Pick<Candidate, "p_sustained" | "latent_std_ratio">): boolean {
  return c.p_sustained !== null && Number.isFinite(c.latent_std_ratio) && c.latent_std_ratio < SUPPORT_LATENT_RATIO;
}

/** One plain sentence explaining the verdict, derived from the numbers (never empty). */
export function verdictSentence(a: AssessResponse): string {
  const n = a.coverage.n_target_points;
  const k = a.coverage.points_with_comparable;
  const s = pointsSupported(a);
  const nn = a.coverage.nn_distance_min;
  const nnText = nn !== null ? ` The nearest integrated observation is ${nn.toFixed(1)} reference distances away.` : "";
  if (a.model.model_status !== "modeled") {
    return k === 0
      ? `This group has too few training observations for a model, and no target point has a comparable observation.${nnText}`
      : `This group has too few training observations for a model; ${k} of ${n} target points have comparable observations.`;
  }
  const v: Verdict = a.verdict;
  if (v === "supported") {
    return s !== null
      ? `${s} of ${n} target points have comparable observations close by and low knowledge uncertainty.`
      : `Comparable observations lie close to the target and the model's knowledge uncertainty is low there.`;
  }
  if (k === 0) return `No target point has a comparable observation.${nnText}`;
  if (v === "extrapolation") {
    return s !== null
      ? `Comparable observations reach ${k} of ${n} target points, but the model is confident at only ${s}; elsewhere estimates depend on model assumptions.`
      : `Comparable observations reach ${k} of ${n} target points, but the model is not confident across enough of the target; estimates there depend on model assumptions.`;
  }
  return `Comparable observations reach only ${k} of ${n} target points.`;
}

// ---- Distance from a candidate to the target region (reference distances, CONTRACTS section 4) -------------

const S_O2 = 2.0;
const S_FLOW = 0.5;
const S_P = 0.1;

function gap(x: number, lo: number | null, hi: number | null): number {
  if (lo !== null && x < lo) return lo - x;
  if (hi !== null && x > hi) return x - hi;
  return 0;
}

function bounds(r: { nominal: number | null; min: number | null; max: number | null }): [number | null, number | null] {
  const lo = r.min ?? r.nominal ?? r.max;
  const hi = r.max ?? r.nominal ?? r.min;
  return [lo, hi];
}

/** Standardized distance from a point to the target box (0 inside). null if the target has no bounds. */
export function distanceToTarget(c: Pick<Candidate, "oxygen_percent" | "airflow_cm_s" | "pressure_kpa">, t: ResolvedTarget): number | null {
  const [o2lo, o2hi] = bounds(t.oxygen_percent);
  const [plo, phi] = bounds(t.total_pressure_kpa);
  const [flo, fhi] = bounds(t.airflow_cm_s);
  if (o2lo === null && o2hi === null) return null;
  const dO2 = gap(c.oxygen_percent, o2lo, o2hi) / S_O2;
  const z = (u: number | null) => (u === null ? null : Math.log1p(Math.max(u, 0)));
  const dF = gap(Math.log1p(Math.max(c.airflow_cm_s, 0)), z(flo), z(fhi)) / S_FLOW;
  const zp = (p: number | null) => (p === null || p <= 0 ? null : Math.log(p / 101.325));
  const dP = c.pressure_kpa > 0 ? gap(Math.log(c.pressure_kpa / 101.325), zp(plo), zp(phi)) / S_P : 0;
  return Math.sqrt(dO2 * dO2 + dF * dF + dP * dP);
}

// ---- Investigation relevance (backend `investigation_relevance`) ------------------------------------------

export type RelevanceRole = "integrated" | "context" | "not_integrated";

export interface RelevanceRow {
  id: string;
  rank?: number;
  acronym: string;
  name: string;
  summary: string | null;
  role: RelevanceRole;
  comparable: number | null;
  /** Context records near the target in any material group (when the group count does not apply). */
  comparableAny?: number | null;
  overlap: string | null;
  url: string | null;
}

function roleOf(v: unknown): RelevanceRole {
  const s = String(v ?? "");
  if (s === "integrated_model" || s === "integrated" || s === "modelled" || s === "modeled") return "integrated";
  if (s === "integrated_context" || s === "context") return "context";
  return "not_integrated";
}

const OVERLAP_TEXT: Record<string, string> = {
  contains_target_nominal: "Documented envelope contains the target",
  overlaps_target_region: "Documented envelope overlaps the target",
  contains_target: "Documented envelope contains the target",
  overlaps_target: "Documented envelope overlaps the target",
  none: "No documented overlap with the target",
  outside_target_region: "Documented envelope does not reach the target",
};

/** Rows from the backend's investigation_relevance (any of its likely shapes), else from documented_context. */
export function relevanceRows(a: AssessResponse): { rows: RelevanceRow[]; fromBackend: boolean } {
  const raw = asObj(a)["investigation_relevance"];
  const list = Array.isArray(raw) ? raw : Array.isArray(asObj(raw)["investigations"]) ? (asObj(raw)["investigations"] as unknown[]) : null;
  if (list) {
    const rows = list
      .map((x, i) => {
        const o = asObj(x);
        const id = str(o.investigation_id) ?? str(o.id) ?? `inv-${i}`;
        const overlapRaw = str(o.envelope_overlap) ?? str(o.overlap);
        const name = str(o.title) ?? str(o.name) ?? "";
        const colon = name.indexOf(":");
        const paren = name.indexOf(" (");
        const head = colon > 0 && colon <= 60 ? name.slice(0, colon) : paren > 0 && paren <= 40 ? name.slice(0, paren) : null;
        const group = int(o.comparable_observations);
        const anyGroup = int(o.comparable_records_all_groups);
        return {
          id,
          acronym: str(o.acronym) ?? str(o.short_name) ?? head ?? (name || id),
          name,
          summary: str(o.summary) ?? str(o.reason) ?? str(o.relevance_reason) ?? null,
          role: roleOf(o.role),
          comparable: group,
          comparableAny: group === null ? anyGroup : null,
          overlap: overlapRaw ? OVERLAP_TEXT[overlapRaw] ?? overlapRaw.replace(/_/g, " ") : null,
          url: str(o.url) ?? str(o.landing_url) ?? str(o.source_url) ?? null,
          rank: num(o.relevance_rank) ?? num(o.rank) ?? i + 1,
        };
      })
      .sort((p, q) => p.rank - q.rank);
    return { rows, fromBackend: true };
  }
  const rows = a.documented_context.map((c) => ({
    id: c.id,
    acronym: c.name.split(/[\s(,]/)[0] ?? c.name,
    name: c.name,
    summary: null,
    role: "not_integrated" as const,
    comparable: null,
    overlap: OVERLAP_TEXT[c.overlap] ?? null,
    url: null,
  }));
  return { rows, fromBackend: false };
}
