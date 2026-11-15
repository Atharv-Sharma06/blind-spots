import type { AcquisitionCurvePoint, AcquisitionScenario, BlindspotTest, GroupValidation, LogoFold, ValidationResponse } from "@/lib/types";

/**
 * Fields the validation artifact carries beyond the shapes pinned in docs/API.md. All are optional:
 * the page shows them when present and never assumes them.
 */
export interface GpVsMajority {
  comparison?: string;
  brier?: { value: number | null; ci95: [number, number] | null };
  log_loss?: { value: number | null; ci95: [number, number] | null };
}

export interface ExtSensitivityRow {
  variant: string;
  n_training: number;
  brier: number | null;
  log_loss: number | null;
  auc: number | null;
  delta_vs_primary: number | null;
  n_experiments?: number;
  n_not_sustained?: number;
  majority_log_loss?: number | null;
  note?: string;
}

export interface ExtSubgroup {
  name: string;
  n: number;
  brier: number | null;
  log_loss: number | null;
  n_not_sustained?: number;
}

export interface ExtBlindspot extends Omit<BlindspotTest, "point_level" | "group_level"> {
  /** Full verdict rule, including the partial-correlation criterion. */
  rule?: string;
  criteria?: { point_level?: boolean; experiment_level?: boolean; partial?: boolean };
  point_level: BlindspotTest["point_level"] & { n_misclassified?: number; p_value_note?: string };
  group_level: Omit<BlindspotTest["group_level"], "pairs"> & {
    pairs: { experiment_id: string; pre_reveal_uncertainty: number; error: number; n_points?: number }[];
    p_value_note?: string;
    hyperparameters_refit_per_experiment?: boolean;
  };
  diagnostics?: {
    partial_rho_epistemic_given_aleatoric?: number | null;
    rho_aleatoric_point?: number | null;
    share_misclassified_flow_off_transient?: number | null;
  };
}

export interface ExtGroupValidation extends Omit<GroupValidation, "cv" | "logo" | "blindspot_test" | "sensitivity" | "subgroups"> {
  cv: GroupValidation["cv"] & {
    ci_method?: string;
    gp_mean_function?: string;
    gp_vs_majority?: GpVsMajority;
    k?: number;
    repeats?: number;
    n_pooled_predictions?: number;
    seeds?: number[];
  };
  logo: { applicable: boolean; folds: (LogoFold & { n_not_sustained?: number; majority_log_loss?: number | null })[]; reason?: string };
  blindspot_test: ExtBlindspot;
  sensitivity: ExtSensitivityRow[];
  subgroups: ExtSubgroup[];
  /** Per-group calibration verdict (science team); "calibrated" is claimed only when claim_calibrated is true. */
  calibration?: {
    claim_calibrated: boolean;
    verdict: "calibrated" | "not_established" | "worse_than_baseline";
    ece: number | null;
    ece_ci95: [number, number] | null;
    majority_class_ece: number | null;
    rule: string;
    text: string;
  } | null;
}

export interface ExtScenario extends Omit<AcquisitionScenario, "curves"> {
  curves: Record<string, AcquisitionCurvePoint[]>;
  n_target_experiments?: number;
  n_target_observations?: number;
  target_class_balance?: { sustained: number; not_sustained: number };
  n_pool_experiments?: number;
  majority_class_baseline?: { constant_probability?: number; target_log_loss?: number; target_brier?: number; note?: string };
  paired_differences?: Record<string, { mean_auc_difference: number; ci95: [number, number] | null; fraction_seeds_evr_better?: number; n_seeds?: number; metric?: string }>;
}

export interface ExtValidation extends Omit<ValidationResponse, "groups" | "acquisition_retrospective"> {
  groups: ExtGroupValidation[];
  acquisition_retrospective: { scenarios: ExtScenario[] };
  not_modelled?: Record<string, string>;
}
