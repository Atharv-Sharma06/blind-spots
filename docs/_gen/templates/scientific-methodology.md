# Scientific methodology

This page describes what the code in `services/analysis/src/blindspots` does. Numbers are from the current artifacts (dataset `{{DV}}`, model `{{MV}}`). Rationale for individual choices is in [decisions.md](decisions.md).

## 1. Question and scope

Blind Spots asks, for a documented or hypothetical cabin atmosphere (O2 fraction, total pressure, airflow band): *how much comparable experimental evidence exists in the integrated NASA records, what does a
calibrated model say there, and which additional condition would most reduce the model's uncertainty about that target?* It does not predict spacecraft fire behaviour, certify any material or atmosphere, or replace NASA-STD-6001-style qualification.
Findings apply to the integrated records only.

## 2. Observation, label and training filter

- **Unit**: one flow step of one test: the flame was sustained or not at a recorded airflow and O2 (D-005). Steps of a test are correlated, so resampling and cross-validation are always by experiment (and by campaign for leave-one-campaign-out).
- **Label rule** (`processing/labels.py`): `sustained` is label 1. `extinguished` with mode `quench_low_flow`, `blowoff_high_flow` or `at_constant_flow` is label 0. `extinguished` by `flow_turned_off` is label 0 at the recorded near-zero flow, flagged `flow_off_transient`.
  `brief_flame_no_sustain` is label 0 (flag `no_sustained_propagation`). `not_ignited` and `n2_suppression` are excluded from flammability training with the reason recorded.
- **Training filter**: label present, provenance verified, numeric airflow, material family, O2 present, and curated confidence high or medium. Low-confidence steps stay in the records and return only in a sensitivity analysis (D-008).
  Result: {{N_TRAIN_OBS}} training observations from {{N_TRAIN_EXP}} experiments ({{POS}} sustained, {{NEG}} not sustained; confidence {{TRAIN_CONF}}). Not-sustained modes in training: {{NEG_MODES}}.
- **Airflow basis in training**: {{BASIS}}. {{T_BELOW_CAL}} training observations are below the calibrated range (linear extrapolation, flagged); {{T_O2_INTERP}} have linearly interpolated O2 (initial to final across the steps of a test); {{T_O2_INITIAL_ONLY}} use the initial O2 only.
- **Known label weakness**: most "sustained" labels come from list order in decreasing-flow schedules (no outcome token in the source); the final unrecorded setting is deliberately omitted, so the boundary is thinly observed. Of the not-sustained rows, {{FLOW_OFF}} are flow-off transients.

## 3. Analysis groups and the modelability rule

A group is one material family plus one flame configuration (`models/groups.py`; for example `pmma_rod__stagnation`). Observations are compared, covered and modelled only within a group, because material, geometry and flow configuration change flammability.
A group is modelled only if it has at least 6 training experiments, at least 3 sustained and 3 not-sustained observations, and not-sustained observations in at least 2 experiments (D-007). Otherwise coverage is shown and predictions are not (`insufficient_data`).

Modelled groups in this build:

{{GROUPS_TABLE}}

Not modelled (coverage only):

{{NOT_MODELLED_TABLE}}

Group ids and counts are read from the artifacts at run time; none are hard-coded in the app. The default group shown by the interface is data-driven (`is_default` on `/api/groups`): among modelled groups, the one with the most target points of the default target (ISS cabin, nominal operating range) that have at least one comparable observation, then the highest cross-validated GP AUC, then the most training rows (currently `{{DEFAULT_GROUP}}`). The context layer is on by default.

## 4. Coordinates and reference scales

`z_o2 = O2 %`, `z_flow = ln(1 + airflow cm/s)`, `z_p = ln(pressure kPa / 101.325)`. Coverage distances use reference scales s_o2 = 2.0, s_flow = 0.5, s_p = 0.1 (documented, model-independent):
d(a, b) = sqrt(sum_i ((a_i - b_i) / s_i)^2). A *comparable* observation is in the same group with d <= 1. A point gets the reason `sparse_observations` when it has fewer than 3 comparable observations; a nearest-neighbour distance above 1 marks a coverage gap.

## 5. Model: Gaussian-process classifier

`models/gp_laplace.py`: binary GP classifier with logit link and Laplace approximation (Rasmussen and Williams 2006, Algorithms 3.1, 3.2 and 5.1), ARD squared-exponential kernel and a constant mean (a linear-in-O2 mean is supported by the code).
Hyperparameters are fit by MAP-II (maximum marginal likelihood with log-normal priors) with {{N_RESTARTS}} restarts; the analytic gradient is checked against finite differences in tests.
Priors (mean, sd of the log-parameter): O2 length scale ({{PRIOR_L_O2}}), flow length scale ({{PRIOR_L_FLOW}}), signal variance ({{PRIOR_SIGNAL}}); mean parameters b0 ({{PRIOR_B0}}), b1 ({{PRIOR_B1}}).

**Pressure length scale is fixed** at {{LP}} (ln-pressure units) and cannot be learned, because every integrated observation lies between {{P_MIN}} and {{P_MAX}} kPa (BASS measured; BASS-II assumed 101.353 kPa and flagged) (D-009).
Consequently any prediction at another pressure is assumption-driven: the correlation between a pressure and the data at 1 atm is set by this fixed number. The API reports sensitivity to 0.15 / 0.3 / 0.6 and flags candidates whose value depends mainly on it.
Cross-validated log loss changes by at most {{LP_MAX_DELTA}} across these settings (in-sample pressure does not vary, so this check cannot detect the real effect of pressure).

**Mean function**: {{MEAN_SENTENCE}} Training rows with missing coordinates are dropped and counted, never imputed.

**Baselines**: majority class (Laplace-smoothed prevalence), L2 logistic on O2, L2 logistic on [O2, flow, flow^2], bootstrap ensemble of the latter ({{ENSEMBLE}} members).

## 6. Predictions and uncertainty

For a query point the GP gives a latent mean and variance; the predictive probability is E[sigmoid(f)] by Gauss-Hermite quadrature. Uncertainty is decomposed in nats:

- total = H(E[p]); aleatoric = E[H(p)] (outcome variability the model expects at that condition); epistemic = total - aleatoric (mutual information between outcome and the latent function: lack of data).
- `latent_std_ratio` = posterior latent std / prior latent std (about 1 means the data have taught the model nothing there).

**Verdict** (`supported | extrapolation | insufficient_evidence`) is deterministic: *supported* if the point is inside the convex hull of the group's observations (or has at least 3 comparable observations) and `latent_std_ratio` < 0.6;
*insufficient_evidence* if there is no comparable observation and the ratio > 0.85; otherwise *extrapolation*. Reason codes (`sparse_observations`, `outside_hull`, `unobserved_pressure`, `outcome_variability`, `no_model`) carry the numbers behind the verdict.
For `insufficient_evidence` the interface shows exactly: "Insufficient experimental evidence for a reliable estimate." Target assessments aggregate per-point verdicts: supported if at least 75% of target points are supported; insufficient if at least 50% are; otherwise extrapolation.

## 7. Target region

A target is a documented profile (`/api/targets`) or a user-defined hypothetical (always labelled "User-selected hypothetical conditions"). The target region is a grid over O2 [min, max] (nominal if no range), pressure [min, max] and the airflow band, with uniform weights.

- `kind: envelope` profiles are context only, not analysis targets.
- Null O2 nominal with a documented maximum: analyse at the maximum and flag `documented_upper_bound_used` (higher O2 is the worse case for flammability). Null pressure nominal: use the documented bound and flag it. A nominal is never invented.
- Airflow band: the profile's own band if given; otherwise [0.5, {{VENT_MAX}}] cm/s with `airflow_band_source = ventilation_standard_with_near_quiescent_extension`. The documented ventilation band is {{VENT_MIN}} to {{VENT_MAX}} cm/s (NASA-STD-3001 Vol. 2 / HIDH);
  the extension below {{VENT_MIN}} cm/s down to 0.5 cm/s is an analysis choice for ventilation loss or dead zones, since microgravity flame extinction occurs at low flow. It is stated in `airflow_band_note` and is not a NASA requirement.
- Documented context: not-integrated investigations (section 2 of [data-sources.md](data-sources.md)) whose documented O2, pressure and flow ranges contain or overlap the target are listed in `documented_context`; the summary says the target conditions are
  "not represented in the integrated records" and names them. It never says NASA has not studied the condition.

## 8. Target-aware active learning

- **Candidate domain** (default, documented): O2 12 to 40 %, pressure grid 50, 56.5, 60, 70.3, 80, 90, 101.3 kPa (the target pressure is added when no grid pressure lies within 1 kPa), airflow 0.5 to 45 cm/s (12 log-spaced values), within the same analysis group.
- **Expected variance reduction**: EVR(c) = sum_t w_t Sigma(t,c)^2 * F_c, where Sigma is the GP posterior covariance of the latent function and F_c = sum_y p_y / (Sigma(c,c) + 1/W(f_y)) is the outcome-averaged Laplace update factor (p_y = current predictive probability of outcome y, f_y = latent mean at c after conditioning on y, W(f) = sigmoid(f)(1 - sigmoid(f)); docs/CONTRACTS.md section 6).
  `evr_fraction` divides by the current weighted target latent variance. A probability-scale view (mutual-information reduction) is also reported.
- **Greedy batch**: top-k by sequential rank-one downdates of the joint target plus candidate covariance (`marginal_evr_fraction` is the greedy gain).
- **Baselines** shown beside the ranking: random (seeded by a hash of the request), uncertainty sampling (maximum epistemic uncertainty at the candidate), nearest gap (closest-to-target candidate that is sparse, nearest-neighbour distance above 1).
- **Reason codes** with thresholds: `high_target_covariance` (weighted mean absolute posterior correlation >= 0.5), `high_candidate_uncertainty` (latent std ratio >= 0.85), `near_decision_boundary` (0.3 <= P <= 0.7),
  `fills_coverage_gap` (nearest-neighbour distance > 1), `assumption_dependent` (EVR fraction varies by more than 50% of its maximum across pressure length scales 0.15 / 0.3 / 0.6).
- **Feasibility status** is never a feasibility claim: `within_demonstrated_envelope` (inside the box and convex hull of conditions already run in the integrated investigations; "not an engineering feasibility assessment") or
  `outside_demonstrated_envelope` ("Feasibility not verified; requires qualified review.").
- **Compare** two candidates: `indistinguishable` if the relative EVR difference is below 15% or the preference flips under any pressure length scale setting.
- **Counterfactual**: for a candidate, refits the model with a hypothetical outcome (sustained / not sustained) and fixed hyperparameters and reports the change in target mean, latent variance and epistemic uncertainty. Hypothetical outcomes are labelled as such, not experimental results.
- Every candidate carries the disclaimer: "Computational research candidate requiring qualified scientific review, established safety procedures and formal feasibility assessment." No operational instructions are produced.

## 9. Validation (summary)

Repeated grouped K-fold by experiment (k = min({{CV_K}}, experiments), {{CV_REPEATS}} repeats), hyperparameters refit inside each training fold, headline metrics from stacked out-of-fold predictions, group-bootstrap 95% CIs ({{N_BOOT}} draws), leave-one-campaign-out where a group spans more than one campaign,
calibration bins, error distributions, subgroup breakdowns, sensitivity analyses (add low-confidence rows, O2 initial value only, drop below-calibration rows, drop flow-off transients, drop brief-flame rows, pressure length scale 0.15 / 0.6) and a **blind-spot test**:
does pre-reveal epistemic uncertainty rank the larger errors on withheld experiments? (Spearman rho at point and experiment level with {{N_PERM}}-permutation one-sided p-values; verdict rule in [validation.md](validation.md).)
Results, including where the GP does not beat the majority class, are in [validation.md](validation.md) and [evidence-report.md](evidence-report.md).

## 10. Retrospective test of the acquisition rule

On held-out real experiments of the same groups (lowest-O2 quartile, lowest-minimum-airflow quartile, one campaign), starting from 3 random experiments, each strategy acquires whole experiments for up to {{R_ROUNDS}} rounds; target log loss is the outcome ({{R_SEEDS}} seeds).
It is an indicative check of the rule on historical data, not proof that EVR choices would be best for a real future experiment. Results and limitations: [validation.md](validation.md).

## 11. Reproducibility

Dataset version = first 12 hex characters of the sha256 of the normalized content; model version = `gp-laplace-v1+<dataset_version[:8]>.<config hash[:6]>`; manifests store a sha256 per group file. Seeds are fixed (CV seeds 0 to 4, model seed {{SEED}}).
Rebuilding the committed inputs (`build-dataset`, `train`, `retrospective`) was checked to reproduce the committed dataset, model and retrospective JSON exactly (ignoring timestamps and runtimes).

## 12. Caveats that bound every metric

1. **Flow-off negatives.** In the sphere groups most negatives are flow-turned-off steps ("flow near zero means no flame"). Grouped-CV AUC of the GP before and after dropping them: {{FLOWOFF_AUC}}.
2. **Below-calibration flow interpolation.** Many near-quench negatives depend on flow values extrapolated below the calibrated range. Rows remaining when those are dropped: {{BELOWCAL_RELIANT}}.
3. **Where the GP beats the majority-class baseline** (CI excludes 0): {{GP_BETTER_GROUPS}}. Roughly at baseline: {{GP_INDIST_GROUPS}}.
4. **Pressure.** All integrated observations lie at {{P_MIN}} to {{P_MAX}} kPa and the pressure length scale is fixed ({{LP}}, ln units). At low pressure predictions revert to the prior: a value near 0.6 at 34 % O2 and 56.5 kPa is reversion (latent std ratio about 1), not a pressure effect. For `insufficient_evidence` targets the interface shows no p(sustained).
5. **Blind-spot test** (strict rule including partial correlation given aleatoric uncertainty): supported in {{BS_SUPPORTED}} groups, inconclusive in {{BS_INCONCLUSIVE}}.
6. **Retrospective acquisition test**: EVR beat random in {{R_RAND_B}} of {{R_N}} scenarios (indistinguishable {{R_RAND_I}}, worse {{R_RAND_W}}) and uncertainty sampling in {{R_UNC_B}} ({{R_UNC_I}}, {{R_UNC_W}}): modest small-sample evidence.
7. **Mean function.** Every group uses a constant GP mean fixed a priori; no mean function is selected from the data.
