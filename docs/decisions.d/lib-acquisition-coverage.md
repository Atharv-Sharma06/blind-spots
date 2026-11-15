# lib-acquisition-coverage decisions

- Analysis coordinates are (n,3) `[z_o2, z_flow, z_p]`; `coverage.to_coords(o2, p_kpa, u_cm_s)` converts raw values. Candidate raw arrays are `[o2, pressure_kpa, airflow_cm_s]`.
- Target/EVR weights are always normalized to sum 1. EVR fraction = EVR / weighted current target latent variance.
- `inside_hull`: Delaunay on varying dims; degenerate dims checked |delta|/s <= 1; collinear/degenerate hulls return False (conservative).
- Demonstrated envelope = observed bounding box (degenerate dims padded by 1 scale) AND hull.
- Greedy batch: Gaussian surrogate rank-1 downdates; wbar recomputed from updated candidate variance with latent mean unchanged. Ties go to the lowest candidate index.
- Baselines (`random`, `uncertainty_sampling`, `nearest_gap`) take k and report sequential marginal EVR via the same downdates; empty/ineligible sets return `{"status": "no_eligible_candidates"}`.
- Explanation thresholds (documented defaults): sparse < 3 comparable; fold_spread threshold 0.15 (placeholder, not calibrated); outcome_variability aleatoric/total > 0.6 and ratio < 0.5.
- Feasibility strings: within = "Inside conditions already run in the integrated investigations (not an engineering feasibility assessment)."; outside = "Feasibility not verified; requires qualified review."
