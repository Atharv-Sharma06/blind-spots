/** TS copy of the GET /api/findings contract (.work/competitors/PLAN.md "Shared JSON contract"). */

export type PressureBasis = "measured" | "assumed" | "missing";
export type Pillar = "prevention" | "suppression";
export type FindingKind =
  "lowest_o2_burning" | "overlap" | "airflow" | "pressure_gap";

export interface FindingPoint {
  oxygen_percent: number;
  airflow_cm_s: number | null;
  pressure_kpa: number | null;
  pressure_basis: PressureBasis;
  o2_basis: "measured" | "interpolated";
  n_at_value: number;
  observation_ids: string[];
  experiment_ids: string[];
}

export interface Finding {
  id: string;
  kind: FindingKind;
  pillar: Pillar;
  headline: string;
  interpretation: string;
  k: number | null;
  n: number | null;
  basis: "measured" | "derived" | "assumed";
  observation_ids: string[];
  experiment_ids: string[];
}

export interface AirflowBin {
  lo: number;
  hi: number | null;
  n: number;
  n_sustained: number;
  lowest_o2_burning: number | null;
}

export interface FindingMaterial {
  rank: number;
  group_id: string;
  label: string;
  material_family: string;
  flame_configuration: string;
  n_experiments: number;
  n_observations: number;
  investigation_ids: string[];
  campaigns: string[];
  model_status: "modeled" | "insufficient_data";
  model_reason: string | null;
  lowest_o2_burning: FindingPoint | null;
  highest_o2_out: FindingPoint | null;
  overlap_o2: [number, number] | null;
  airflow_bins: AirflowBin[];
  n_airflow_missing: number;
  tested_ranges: {
    oxygen_percent: [number, number];
    airflow_cm_s: [number, number] | null;
    pressure_kpa: [number, number];
    pressure_basis: "measured" | "assumed" | "mixed";
  };
  findings: Finding[];
}

export interface FindingCabin {
  rank: number;
  profile_id: string;
  name: string;
  oxygen_percent: number | null;
  total_pressure_kpa: number | null;
  comparable_observations: number;
  groups_with_comparable: number;
  n_groups: number;
  sentence: string;
  pillar: "prevention";
}

export interface FindingsResponse {
  dataset_version: string;
  model_version: string;
  ranking_rule: string;
  pillar_rule: string;
  summary: {
    n_observations: number;
    n_experiments: number;
    n_groups: number;
    n_investigations: number;
    n_sustained: number;
    n_not_sustained: number;
  };
  materials: FindingMaterial[];
  cabins: FindingCabin[];
  notes: string[];
}

export type PillarFilter = "all" | "prevention" | "suppression" | "detection";
export type SortKey = "rank" | "tests" | "abstains";

/** Pure: materials that have at least one finding in the pillar ("all" keeps every material). Detection is never tagged. */
export function filterByPillar(
  materials: FindingMaterial[],
  pillar: PillarFilter,
): FindingMaterial[] {
  if (pillar === "all") return materials;
  if (pillar === "detection") return [];
  return materials.filter((m) => m.findings.some((f) => f.pillar === pillar));
}

/** Pure: API rank (default), most ISS test results first, or the materials where the model abstains first. Ties keep API rank. */
export function sortMaterials(
  materials: FindingMaterial[],
  key: SortKey,
): FindingMaterial[] {
  const out = [...materials];
  if (key === "tests")
    out.sort((a, b) => b.n_observations - a.n_observations || a.rank - b.rank);
  else if (key === "abstains")
    out.sort(
      (a, b) =>
        Number(b.model_status === "insufficient_data") -
          Number(a.model_status === "insufficient_data") || a.rank - b.rank,
    );
  else out.sort((a, b) => a.rank - b.rank);
  return out;
}
