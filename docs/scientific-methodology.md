# Scientific methodology

This page describes what the code in `services/analysis/src/blindspots` does. Numbers are from the current artifacts (dataset `4fe55f76142a`, model `gp-laplace-v1+4fe55f76.adfbbd`). Rationale for individual choices is in [decisions.md](decisions.md).

## 1. Question and scope

Blind Spots asks, for a documented or hypothetical cabin atmosphere (O2 fraction, total pressure, airflow band): *how much comparable experimental evidence exists in the integrated NASA records, what does an
uncertainty-aware model say there, and which additional condition would most reduce the model's uncertainty about that target?* It does not predict spacecraft fire behaviour, certify any material or atmosphere, or replace NASA-STD-6001-style qualification.
Findings apply to the integrated records only.

## 2. Observation, label and training filter

- **Unit**: one flow step of one test: the flame was sustained or not at a recorded airflow and O2 (D-005). Steps of a test are correlated, so resampling and cross-validation are always by experiment (and by campaign for leave-one-campaign-out).
- **Label rule** (`processing/labels.py`): `sustained` is label 1. `extinguished` with mode `quench_low_flow`, `blowoff_high_flow` or `at_constant_flow` is label 0. `extinguished` by `flow_turned_off` is label 0 at the recorded near-zero flow, flagged `flow_off_transient`.
  `brief_flame_no_sustain` is label 0 (flag `no_sustained_propagation`). `not_ignited` and `n2_suppression` are excluded from flammability training with the reason recorded.
- **Training filter**: label present, provenance verified, numeric airflow, material family, O2 present, and curated confidence high or medium. Low-confidence steps stay in the records and return only in a sensitivity analysis (D-008).
  Result: 565 training observations from 210 experiments (443 sustained, 122 not sustained; confidence high 232, medium 333). Not-sustained modes in training: quench_low_flow 40, brief_flame_no_sustain 26, flow_turned_off 24, at_constant_flow 20, blowoff_high_flow 12.
- **Airflow basis in training**: 332 of 565 training steps use a recorded airflow (duct reading or a value stated in the source); 233 are converted from fan or pot settings with the BASS-II calibration; none use a borrowed calibration. (air_display 257, pot_calibration 202, stated_cm_s 75, fan_calibration 31.) 139 training observations are below the calibrated range (linear extrapolation, flagged); 386 have linearly interpolated O2 (initial to final across the steps of a test); 179 use the initial O2 only.
- **Known label weakness**: most "sustained" labels come from list order in decreasing-flow schedules (no outcome token in the source); the final unrecorded setting is deliberately omitted, so the boundary is thinly observed. Of the not-sustained rows, 24 are flow-off transients.

## 3. Analysis groups and the modelability rule

A group is one material family plus one flame configuration (`models/groups.py`; for example `pmma_rod__stagnation`). Observations are compared, covered and modelled only within a group, because material, geometry and flow configuration change flammability.
A group is modelled only if it has at least 6 training experiments, at least 3 sustained and 3 not-sustained observations, and not-sustained observations in at least 2 experiments (D-007). Otherwise coverage is shown and predictions are not (`insufficient_data`).

Modelled groups in this build:

| group id | training experiments | training observations | sustained | not sustained | majority class | GP mean | campaigns |
|---|---|---|---|---|---|---|---|
| `pmma_rod__opposed` | 24 | 108 | 87 | 21 | 81% | constant | BASS-II/Fernandez-Pello |
| `pmma_slab__opposed` | 22 | 95 | 80 | 15 | 84% | constant | BASS-II/Miller, BASS/2013 |
| `pmma_rod__stagnation` | 15 | 66 | 48 | 18 | 73% | constant | BASS-II/Olson |
| `pmma_rod__unknown` | 12 | 52 | 45 | 7 | 87% | constant | BASS-II/Fernandez-Pello, BASS-II/Olson |
| `pmma_thin_film__opposed` | 16 | 48 | 37 | 11 | 77% | constant | BASS-II/Bhattacharjee |
| `pmma_sphere__wake` | 24 | 42 | 32 | 10 | 76% | constant | BASS/2012, BASS/2013 |
| `sibal_fabric__concurrent` | 25 | 42 | 29 | 13 | 69% | constant | BASS-II/T'ien |
| `pmma_sphere__stagnation` | 18 | 33 | 23 | 10 | 70% | constant | BASS-II/T'ien, BASS/2012, BASS/2013 |
| `pmma_sphere__unknown` | 18 | 29 | 26 | 3 | 90% | constant | BASS/2012, BASS/2013 |

Not modelled (coverage only):

| group (coverage only) | reason it is not modelled |
|---|---|
| `nomex_fabric__concurrent` | 3 training experiments (needs ≥ 6); 0 sustained observations (needs ≥ 3) |
| `nomex_fabric__unknown` | 3 training experiments (needs ≥ 6); 1 sustained observations (needs ≥ 3); 2 not-sustained observations (needs ≥ 3) |
| `paraffin_slab__concurrent` | 1 training experiments (needs ≥ 6); 1 sustained observations (needs ≥ 3); 1 not-sustained observations (needs ≥ 3); not-sustained outcomes in 1 experiment(s) (needs ≥ 2) |
| `paraffin_slab__unknown` | 1 training experiments (needs ≥ 6); 0 sustained observations (needs ≥ 3); 1 not-sustained observations (needs ≥ 3); not-sustained outcomes in 1 experiment(s) (needs ≥ 2) |
| `pmma_slab__concurrent` | 2 training experiments (needs ≥ 6); 0 not-sustained observations (needs ≥ 3); not-sustained outcomes in 0 experiment(s) (needs ≥ 2) |
| `pmma_slab__unknown` | 3 training experiments (needs ≥ 6); 1 sustained observations (needs ≥ 3) |
| `sibal_fabric__opposed` | 2 training experiments (needs ≥ 6); 1 sustained observations (needs ≥ 3); 1 not-sustained observations (needs ≥ 3); not-sustained outcomes in 1 experiment(s) (needs ≥ 2) |
| `sibal_fabric__unknown` | 0 not-sustained observations (needs ≥ 3); not-sustained outcomes in 0 experiment(s) (needs ≥ 2) |
| `ultem_sheet__unknown` | 1 training experiments (needs ≥ 6); 0 sustained observations (needs ≥ 3); 1 not-sustained observations (needs ≥ 3); not-sustained outcomes in 1 experiment(s) (needs ≥ 2) |
| `wax_candle__unknown` | 1 not-sustained observations (needs ≥ 3); not-sustained outcomes in 1 experiment(s) (needs ≥ 2) |
| `wax_candle__wake` | 3 training experiments (needs ≥ 6); 2 sustained observations (needs ≥ 3); 1 not-sustained observations (needs ≥ 3); not-sustained outcomes in 1 experiment(s) (needs ≥ 2) |

Group ids and counts are read from the artifacts at run time; none are hard-coded in the app. The default group shown by the interface is data-driven (`is_default` on `/api/groups`): among modelled groups, the one with the most target points of the default target (ISS cabin, nominal operating range) that have at least one comparable observation, then the highest cross-validated GP AUC, then the most training rows (currently `pmma_thin_film__opposed`). The context layer is on by default.

## 4. Coordinates and reference scales

`z_o2 = O2 %`, `z_flow = ln(1 + airflow cm/s)`, `z_p = ln(pressure kPa / 101.325)`. Coverage distances use reference scales s_o2 = 2.0, s_flow = 0.5, s_p = 0.1 (documented, model-independent):
d(a, b) = sqrt(sum_i ((a_i - b_i) / s_i)^2). A *comparable* observation is in the same group with d <= 1. A point gets the reason `sparse_observations` when it has fewer than 3 comparable observations; a nearest-neighbour distance above 1 marks a coverage gap.

## 5. Model: Gaussian-process classifier

`models/gp_laplace.py`: binary GP classifier with logit link and Laplace approximation (Rasmussen and Williams 2006, Algorithms 3.1, 3.2 and 5.1), ARD squared-exponential kernel and a constant mean (a linear-in-O2 mean is supported by the code).
Hyperparameters are fit by MAP-II (maximum marginal likelihood with log-normal priors) with 8 restarts; the analytic gradient is checked against finite differences in tests.
Priors (mean, sd of the log-parameter): O2 length scale (ln-mean 1.099 (= 3.00), sd 0.75), flow length scale (ln-mean 0.000 (= 1.00), sd 0.75), signal variance (ln-mean 1.386 (= 4.00), sd 0.75); mean parameters b0 (normal, mean 0.0, sd 3.0), b1 (normal, mean 0.0, sd 1.0).

**Pressure length scale is fixed** at 0.3 (ln-pressure units) and cannot be learned, because every integrated observation lies between 98.3 and 102.2 kPa (BASS measured; BASS-II assumed 101.353 kPa and flagged) (D-009).
Consequently any prediction at another pressure is assumption-driven: the correlation between a pressure and the data at 1 atm is set by this fixed number. The API reports sensitivity to 0.15 / 0.3 / 0.6 and flags candidates whose value depends mainly on it.
Cross-validated log loss changes by at most 0.001 across these settings (in-sample pressure does not vary, so this check cannot detect the real effect of pressure).

**Mean function**: Mean function: `constant` only. This is the `mean_options` setting of this model version's training configuration; the grouped-CV selection between a constant and a linear-in-O2 mean (MS-002) exists in the code but is not used by this configuration. Every group therefore uses a constant GP mean fixed a priori; there is no mean-function selection. Training rows with missing coordinates are dropped and counted, never imputed.

**Baselines**: majority class (Laplace-smoothed prevalence), L2 logistic on O2, L2 logistic on [O2, flow, flow^2], bootstrap ensemble of the latter (200 members).

## 6. Predictions and uncertainty

For a query point the GP gives a latent mean and variance; the predictive probability is E[sigmoid(f)] by Gauss-Hermite quadrature. Uncertainty is decomposed in nats:

- total = H(E[p]); aleatoric = E[H(p)] (outcome variability the model expects at that condition); epistemic = total - aleatoric (mutual information between outcome and the latent function: lack of data).
- `latent_std_ratio` = posterior latent std / prior latent std (about 1 means the data have taught the model nothing there).

**Verdict** (`supported | extrapolation | insufficient_evidence`) is deterministic: *supported* if the point is inside the convex hull of the group's observations (or has at least 3 comparable observations) and `latent_std_ratio` < 0.6;
*insufficient_evidence* if there is no comparable observation and the ratio > 0.85; otherwise *extrapolation*. Reason codes (`sparse_observations`, `outside_hull`, `unobserved_pressure`, `outcome_variability`, `no_model`) carry the numbers behind the verdict.
For `insufficient_evidence` the interface shows exactly: "Insufficient experimental evidence for a reliable estimate." Target assessments aggregate per-point verdicts (lead decision D2): supported when at least 50 % of the target points are individually supported; insufficient evidence when no target point has any comparable observation; otherwise extrapolation. P(sustained) is reported only for supported points.

## 7. Target region

A target is a documented profile (`/api/targets`) or a user-defined hypothetical (always labelled "User-selected hypothetical conditions"). The target region is a grid over O2 [min, max] (nominal if no range), pressure [min, max] and the airflow band, with uniform weights.

- `kind: envelope` profiles are context only, not analysis targets.
- Null O2 nominal with a documented maximum: analyse at the maximum and flag `documented_upper_bound_used` (higher O2 is the worse case for flammability). Null pressure nominal: use the documented bound and flag it. A nominal is never invented.
- Airflow band: the profile's own band if given; otherwise [0.5, 60.96] cm/s with `airflow_band_source = ventilation_standard_with_near_quiescent_extension`. The documented ventilation band is 7.62 to 60.96 cm/s (NASA-STD-3001 Vol. 2 / HIDH);
  the extension below 7.62 cm/s down to 0.5 cm/s is an analysis choice for ventilation loss or dead zones, since microgravity flame extinction occurs at low flow. It is stated in `airflow_band_note` and is not a NASA requirement.
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

**Stationarity.** Kernel length scales learned near 1 atm and 13.5 to 22.7 % O2 are assumed to hold elsewhere (the correlation depends only on distance). Away from the data the EVR ranking reflects that assumption, which is why the most informative candidate for a far target often sits at the target conditions themselves.

## 9. Validation (summary)

Repeated grouped K-fold by experiment (k = min(5, experiments), 5 repeats), hyperparameters refit inside each training fold, headline metrics from stacked out-of-fold predictions, group-bootstrap 95% CIs (1000 draws), leave-one-campaign-out where a group spans more than one campaign,
calibration bins, error distributions, subgroup breakdowns, sensitivity analyses (add low-confidence rows, O2 initial value only, drop below-calibration rows, drop flow-off transients, drop brief-flame rows, pressure length scale 0.15 / 0.6) and a **blind-spot test**:
does pre-reveal epistemic uncertainty rank the larger errors on withheld experiments? (Spearman rho at point and experiment level with 2000-permutation one-sided p-values; verdict rule in [validation.md](validation.md).)
Results, including where the GP does not beat the majority class, are in [validation.md](validation.md) and [evidence-report.md](evidence-report.md).

## 10. Retrospective test of the acquisition rule

On held-out real experiments of the same groups (lowest-O2 quartile, lowest-minimum-airflow quartile, one campaign), starting from 3 random experiments, each strategy acquires whole experiments for up to 10 rounds; target log loss is the outcome (20 seeds).
It is an indicative check of the rule on historical data, not proof that EVR choices would be best for a real future experiment. Results and limitations: [validation.md](validation.md).

## 11. Reproducibility

Dataset version = first 12 hex characters of the sha256 of the normalized content; model version = `gp-laplace-v1+<dataset_version[:8]>.<config hash[:6]>`; manifests store a sha256 per group file. Seeds are fixed (CV seeds 0 to 4, model seed 0).
Rebuilding the committed inputs (`build-dataset`, `train`, `retrospective`) was checked to reproduce the committed dataset, model and retrospective JSON exactly (ignoring timestamps and runtimes).

## 12. Caveats that bound every metric

1. **Flow-off negatives.** In the sphere groups most negatives are flow-turned-off steps ("flow near zero means no flame"). Grouped-CV AUC of the GP before and after dropping them: PMMA spheres, wake ignition: 0.99 with all 10 not-sustained observations; 0.82 without them, but only 1 not-sustained observation remains, so that AUC is not interpretable; PMMA spheres, axial stagnation flow: 0.96 with all 10 not-sustained observations; 0.67 without them, but only 2 not-sustained observations remain, so that AUC is not interpretable; PMMA spheres, configuration not recorded: 1.00 with all 3 not-sustained observations; none remain without them, so not evaluable.
2. **Below-calibration flow extrapolation.** Many near-quench negatives depend on flow values extrapolated below the calibrated range. Rows remaining when those are dropped: PMMA rods, opposed flow (36 of 108 training rows and 4 of 21 negatives remain); PMMA rods, axial stagnation flow (32 of 66 training rows and 13 of 18 negatives remain); PMMA rods, configuration not recorded (35 of 52 training rows and 2 of 7 negatives remain); Thin PMMA films, opposed flow (37 of 48 training rows and 3 of 11 negatives remain).
3. **Where the GP beats the majority-class baseline** (CI excludes 0): PMMA rods, axial stagnation flow; PMMA rods, configuration not recorded; Thin PMMA films, opposed flow; PMMA spheres, wake ignition; PMMA spheres, axial stagnation flow; PMMA spheres, configuration not recorded. Roughly at baseline: PMMA rods, opposed flow; PMMA slabs, opposed flow; SIBAL cotton/fiberglass fabric, concurrent flow.
4. **Pressure.** All integrated observations lie at 98.3 to 102.2 kPa and the pressure length scale is fixed (0.3, ln units). At low pressure predictions revert to the prior: a value near 0.6 at 34 % O2 and 56.5 kPa is reversion (latent std ratio about 1), not a pressure effect. For `insufficient_evidence` targets the interface shows no p(sustained).
5. **Blind-spot test** (strict rule including partial correlation given aleatoric uncertainty): supported in 4 groups, inconclusive in 5.
6. **Retrospective acquisition test**: EVR beat random in 11 of 18 scenarios (indistinguishable 5, worse 2) and uncertainty sampling in 13 (2, 3): modest small-sample evidence.
7. **Mean function.** Every group uses a constant GP mean fixed a priori; no mean function is selected from the data.
