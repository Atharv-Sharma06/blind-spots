# api-model decisions (2026-11-15)

- D-api-model-1: Model-backed endpoints live in `api/routes_model.py` with helpers in `api/services/`
  (targets, modeling, context, assess, ranking, brief). Responses are memoised by endpoint, canonical request and
  dataset/model versions; they are deterministic (the random baseline is seeded by a hash of the request).
- D-api-model-2: Target airflow band: profile band if both bounds exist; else `[0.5, ventilation.max_cm_s]` with
  `airflow_band_source = ventilation_standard_with_near_quiescent_extension` (the extension below 7.62 cm/s is an
  analysis choice and is stated in `airflow_band_note`); else the default band flagged `default_band`. Custom
  targets with an airflow range report `airflow_band_source = "custom"` (added to the API enum).
  Null O2 nominal uses the documented max (flag `documented_upper_bound_used`); null pressure nominal uses the
  documented bound (flag `documented_bound_used`). Envelope profiles are context only (422).
- D-api-model-3: Model-based quantities (hull, verdict, nn distance, candidate envelope) use the fitted model's own
  training coordinates, so they are consistent with the posterior even when the dataset was rebuilt after training
  (a version note is added to the assumptions list in that case). Target coverage (nearest observations, ids) uses the
  current normalized dataset.
- D-api-model-4: Target verdict aggregates per-point verdicts: supported if >= 75 % of target points are supported;
  insufficient_evidence if >= 50 % are; otherwise extrapolation. A reason is reported when it applies to >= 50 % of
  points (value = that fraction).
- D-api-model-5: Candidate grid = `acquisition.candidates` grid; the target pressure joins it only when no grid
  pressure lies within 1 kPa (otherwise greedy batches pick near-duplicate points). EVR fraction = standalone EVR
  over the current weighted target latent variance; `marginal_evr_fraction` is the greedy marginal gain.
  Reason thresholds: high_target_covariance = weighted mean |posterior correlation| >= 0.5;
  high_candidate_uncertainty = latent std ratio >= 0.85; near_decision_boundary = 0.3 <= P <= 0.7;
  fills_coverage_gap = nn distance > 1; assumption_dependent = EVR fraction spread across pressure length scales
  {0.15, 0.3, 0.6} > 50 % of its maximum.
- D-api-model-6: Compare is `indistinguishable` when the relative EVR difference < 15 % or the preference flips under
  any pressure length-scale setting. Unmodelled groups: rank returns `model_unavailable`; compare, counterfactual
  return 422; predict returns null numbers with reason `no_model`; brief and assess still work (coverage only).
- D-api-model-7: Snapshot: keys follow docs/API.md; counterfactual entries use plane `o2_flow` with slice = the
  profile's nominal pressure and plane `o2_pressure` with slice 10 cm/s, for each of the 3 ranked candidates (candidate
  values are the rounded numbers from the rank response). Brief entries are written for `candidate: <top candidate>`
  and `candidate: null`. Rank has aliases without `assumptions` / `k`. Coverage/surface grids are rounded to 4
  decimals (counterfactual grids to 3). Envelope profiles are listed under `skipped_profiles`.
- D-api-model-8: The brief test denylist omits the bare word "procedure" because the mandated disclaimer contains
  "established safety procedures"; operational phrases ("ignite the", "step 1", "test procedure", ...) are denied.
