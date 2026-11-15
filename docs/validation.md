# Validation

Generated from `models/gp-laplace-v1+8783ff5a.adfbbd/validation.json` (dataset `8783ff5aa6a2`, model `gp-laplace-v1+8783ff5a.adfbbd`, validation generated 2026-11-15T18:00:31+00:00) and
`models/retrospective/8783ff5aa6a2.json`. Every number on this page is copied from those artifacts by a script; nothing is typed by hand.
Regenerate the page after any dataset rebuild or retrain. Plain factual reporting: the results describe the
integrated NASA records only and are not an experimental validation of fire safety.

## Protocol

- Unit of observation: one flow step of one test. Steps of one test are correlated, so everything is grouped by
  experiment (D-005).
- Repeated grouped K-fold by experiment: k = min(5, number of experiments), 5 repeats (seeds 0 to 4). GP hyperparameters are
  refit inside every training fold only. The GP pressure length scale is fixed at 0.3 (ln-pressure units) and is not learned.
- Headline metrics use the out-of-fold predictions of all repeats stacked. 95% CIs are percentile intervals from a group
  bootstrap (1000 draws, whole experiments resampled). Brier and log loss: lower is better. ECE uses 10 equal-width bins and is
  biased upward in small samples, so its bootstrap interval can exclude the point value.
- Baselines: majority class (Laplace-smoothed training prevalence), logistic on O2, logistic on O2 + flow + flow^2, bootstrap
  logistic ensemble (200 members). Majority-class AUC is 0.5 by definition.
- Mean function: `constant` only. This is the `mean_options` setting of this model version's training configuration; the grouped-CV selection between a constant and a linear-in-O2 mean (MS-002) exists in the code but is not used by this configuration. Every group therefore uses a constant GP mean fixed a priori; there is no mean-function selection.
- Groups below the modelability rule (D-007: at least 6 training experiments, at least 3 sustained and 3 not-sustained
  rows, not-sustained rows in at least 2 experiments) are not modelled; they appear in coverage only:

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

## Read this first

- Class imbalance is large. Across the 9 modelled groups the majority class is 69% to 90% of the rows, and the
  majority-class baseline is hard to beat on log loss. In 4 of 9 groups the GP log loss is better than the majority
  class with a CI that excludes 0 (`pmma_thin_film__opposed`, `pmma_sphere__wake`, `pmma_sphere__stagnation`, `pmma_sphere__unknown`); in 5 it is not distinguishable; in 0 it is worse.
- Sample sizes are small (12 to 25 experiments per group, 3 to 21 not-sustained rows per group). Intervals are
  wide and point estimates are unstable.
- Not-sustained rows of type `flow_off_transient` (flow turned off, ~0 cm/s) are not a physical quench boundary, and brief-flame rows
  (`no_sustained_propagation`) are not extinction events at a flow setting either. Share of each group's not-sustained rows (from the sensitivity rows below):

| group | not-sustained rows | of which flow_off_transient | share | of which no_sustained_propagation (brief flame) | share |
|---|---|---|---|---|---|
| `pmma_rod__opposed` | 21 | 2 | 10% | 3 | 14% |
| `pmma_slab__opposed` | 15 | 1 | 7% | 2 | 13% |
| `pmma_rod__stagnation` | 16 | 0 | 0% | 5 | 31% |
| `pmma_rod__unknown` | 6 | 0 | 0% | 0 | 0% |
| `pmma_thin_film__opposed` | 11 | 0 | 0% | 1 | 9% |
| `pmma_sphere__wake` | 10 | 9 | 90% | 1 | 10% |
| `sibal_fabric__concurrent` | 13 | 0 | 0% | 5 | 38% |
| `pmma_sphere__stagnation` | 10 | 8 | 80% | 1 | 10% |
| `pmma_sphere__unknown` | 3 | 3 | 100% | 0 | 0% |

  Groups where at least 80% of the not-sustained rows are flow-off transients: `pmma_sphere__wake` (9 of 10), `pmma_sphere__stagnation` (8 of 10), `pmma_sphere__unknown` (3 of 3). Any large gain over the majority class in those
  groups mostly reflects "flow near zero means label 0", not a learned flammability boundary. Grouped-CV AUC of the GP before and after dropping the flow-off rows
  (sensitivity rows below): `pmma_sphere__wake` 0.99 to 0.82; `pmma_sphere__stagnation` 0.96 to 0.67; `pmma_sphere__unknown` has no other negatives (CV AUC 1.00 with them; not evaluable without).
- Many near-quench negatives rely on the documented below-calibration flow interpolation (flow values below the calibrated range are extrapolated and flagged `below_calibration_range`). Dropping those rows leaves: `pmma_rod__opposed` (36 of 108 training rows and 4 of 21 negatives remain); `pmma_rod__stagnation` (33 of 67 training rows and 11 of 16 negatives remain); `pmma_rod__unknown` (35 of 52 training rows and 1 of 6 negatives remain); `pmma_thin_film__opposed` (37 of 48 training rows and 3 of 11 negatives remain). Groups not listed keep at least half of their rows and negatives.
- The GP clearly beats the majority-class baseline (CI of the paired log-loss difference excludes 0) only in: `pmma_thin_film__opposed`, `pmma_sphere__wake`, `pmma_sphere__stagnation`, `pmma_sphere__unknown`. In `pmma_rod__opposed`, `pmma_slab__opposed`, `pmma_rod__stagnation`, `pmma_rod__unknown`, `sibal_fabric__concurrent` it is roughly at the baseline (CI includes 0). Groups that beat the baseline without being dominated by flow-off negatives: `pmma_thin_film__opposed`.
- Pressure: all integrated observations lie at 98.3 to 102.2 kPa and the pressure length scale is fixed. At low pressure (for example 34 % O2 at 56.5 kPa) the posterior reverts to the prior: the model reports `insufficient_evidence` (latent std ratio about 1.0) and a probability near the prior mean level (about 0.6 in the groups checked), which is reversion and not a pressure effect. The API still returns `p_sustained` next to the verdict; the interface does not present it as an estimate for `insufficient_evidence` targets.
- Every integrated observation is near 1 atm (98.3 to 102.2 kPa; BASS measured, BASS-II assumed). The pressure length scale cannot be
  learned; the 0.15 / 0.3 / 0.6 sensitivity rows change the cross-validated log loss by at most 0.001 (absolute, any group), which is expected
  because pressure does not vary. Any pressure extrapolation is assumption-driven.
- The confidence subgroup rows are not a measure of curation quality: 62% to 100% of each group's not-sustained rows have confidence
  "high" (explicit outcome tokens), whereas most sustained rows are "medium" (implied by list order), so confidence is confounded with the label.

## Summary across groups

Value [95% CI]; log loss and Brier lower is better. "GP minus majority" is the group-bootstrap CI of the paired difference.

| group | exp. | sust./not sust. | GP log loss [95% CI] | majority log loss | GP minus majority log loss | GP Brier | majority Brier | GP AUC | log loss vs majority |
|---|---|---|---|---|---|---|---|---|---|
| `pmma_rod__opposed` | 24 | 87/21 | 0.492 [0.393, 0.629] | 0.497 [0.410, 0.622] | -0.005 [-0.041, 0.033] | 0.158 [0.118, 0.212] | 0.158 [0.120, 0.212] | 0.612 [0.522, 0.731] | not distinguishable (CI includes 0) |
| `pmma_slab__opposed` | 22 | 80/15 | 0.445 [0.365, 0.555] | 0.439 [0.362, 0.549] | 0.006 [-0.021, 0.033] | 0.134 [0.102, 0.180] | 0.134 [0.102, 0.179] | 0.481 [0.332, 0.652] | not distinguishable (CI includes 0) |
| `pmma_rod__stagnation` | 15 | 51/16 | 0.486 [0.416, 0.576] | 0.565 [0.458, 0.749] | -0.079 [-0.219, 0.018] | 0.151 [0.124, 0.185] | 0.187 [0.140, 0.268] | 0.747 [0.586, 0.875] | not distinguishable (CI includes 0) |
| `pmma_rod__unknown` | 12 | 46/6 | 0.387 [0.271, 0.537] | 0.380 [0.259, 0.525] | 0.007 [-0.033, 0.048] | 0.113 [0.070, 0.165] | 0.107 [0.061, 0.160] | 0.496 [0.312, 0.700] | not distinguishable (CI includes 0) |
| `pmma_thin_film__opposed` | 16 | 37/11 | 0.366 [0.290, 0.459] | 0.547 [0.461, 0.648] | -0.180 [-0.234, -0.128] | 0.116 [0.086, 0.152] | 0.180 [0.141, 0.225] | 0.892 [0.823, 0.955] | GP better (CI excludes 0) |
| `pmma_sphere__wake` | 24 | 32/10 | 0.143 [0.083, 0.234] | 0.561 [0.450, 0.673] | -0.418 [-0.531, -0.296] | 0.033 [0.009, 0.068] | 0.186 [0.136, 0.237] | 0.994 [0.972, 1.000] | GP better (CI excludes 0) |
| `sibal_fabric__concurrent` | 25 | 29/13 | 0.613 [0.511, 0.731] | 0.649 [0.559, 0.765] | -0.036 [-0.113, 0.032] | 0.214 [0.170, 0.266] | 0.227 [0.184, 0.282] | 0.597 [0.455, 0.748] | not distinguishable (CI includes 0) |
| `pmma_sphere__stagnation` | 18 | 23/10 | 0.268 [0.132, 0.458] | 0.635 [0.560, 0.714] | -0.367 [-0.504, -0.203] | 0.073 [0.024, 0.144] | 0.220 [0.185, 0.258] | 0.959 [0.859, 1.000] | GP better (CI excludes 0) |
| `pmma_sphere__unknown` | 18 | 26/3 | 0.160 [0.101, 0.216] | 0.363 [0.157, 0.575] | -0.203 [-0.358, -0.063] | 0.036 [0.013, 0.059] | 0.099 [0.021, 0.178] | 1.000 [1.000, 1.000] | GP better (CI excludes 0) |

## Blind-spot test (all groups)

Question: does the model flag, before the outcome is revealed, the regions where it is worse on withheld experiments?
Point level: Spearman rho between pre-reveal epistemic uncertainty (mutual information) and per-point log loss on out-of-fold
predictions (2000-permutation one-sided p; points are treated as exchangeable, so this p is optimistic). Experiment level: leave-one-experiment-out
refits (hyperparameters refit for each held-out experiment), mean epistemic uncertainty versus mean log loss per held-out experiment
(2000 permutations, one-sided). Verdict rule: supported if rho > 0 with p < 0.05 at both levels; not supported if rho <= 0 at both; otherwise inconclusive.
The smallest reportable p is 1/2001.

| group | point n | point rho | point p | AUROC (misclassified) | experiments | experiment rho | experiment p | rho aleatoric vs loss | partial rho (epistemic given aleatoric) | verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| `pmma_rod__opposed` | 108 | 0.42 | 0.0005 | 0.62 (of 21) | 24 | 0.38 | 0.0280 | 0.69 | 0.14 | **inconclusive** |
| `pmma_slab__opposed` | 95 | 0.37 | 0.0005 | 0.57 (of 15) | 22 | -0.10 | 0.6872 | 0.64 | 0.15 | **inconclusive** |
| `pmma_rod__stagnation` | 67 | 0.52 | 0.0005 | 0.62 (of 14) | 15 | 0.04 | 0.4503 | 0.72 | 0.24 | **inconclusive** |
| `pmma_rod__unknown` | 52 | 0.37 | 0.0030 | 0.47 (of 6) | 12 | -0.21 | 0.7736 | 0.81 | 0.08 | **inconclusive** |
| `pmma_thin_film__opposed` | 48 | 0.60 | 0.0005 | 0.62 (of 7) | 16 | 0.26 | 0.1714 | 0.91 | 0.46 | **inconclusive** |
| `pmma_sphere__wake` | 42 | 0.96 | 0.0005 | 0.98 (of 1) | 24 | 0.95 | 0.0005 | 0.95 | 0.80 | **supported** |
| `sibal_fabric__concurrent` | 42 | 0.39 | 0.0070 | 0.60 (of 13) | 25 | 0.19 | 0.1729 | 0.44 | 0.40 | **inconclusive** |
| `pmma_sphere__stagnation` | 33 | 0.87 | 0.0005 | 0.87 (of 2) | 18 | 0.82 | 0.0005 | 0.91 | 0.63 | **supported** |
| `pmma_sphere__unknown` | 29 | 0.95 | 0.0005 | n/a (of 0) | 18 | 0.84 | 0.0005 | 0.99 | 0.69 | **supported** |

Result as computed: 3 supported, 6 inconclusive, 0 not supported out of 9 groups.
Supported: `pmma_sphere__wake`, `pmma_sphere__stagnation`, `pmma_sphere__unknown`. Inconclusive: `pmma_rod__opposed`, `pmma_slab__opposed`, `pmma_rod__stagnation`, `pmma_rod__unknown`, `pmma_thin_film__opposed`, `sibal_fabric__concurrent`.

Reading: where the verdict is "supported", epistemic uncertainty and loss rise together. But aleatoric (predictive-entropy)
uncertainty tracks loss at least as strongly as epistemic uncertainty in 8 of 9 groups (point-level rho), and the partial correlation
of epistemic uncertainty given aleatoric uncertainty ranges from 0.08 to 0.80. The partial correlation is the better indicator of added value.
With 0 to 21 misclassified points per group, the AUROC rests on very few events. Treat the result as an association in small samples,
not proof that the model flags its own blind spots.

## Target-aware acquisition: retrospective evaluation

Design (copied from the artifact): per modelled group with at least 12 training experiments, target experiments (a lowest-O2 quartile, a
lowest-minimum-airflow quartile and one campaign) are held out of the pool. Each of 20 seeds draws 3 random pool experiments with both labels as the
initial training set; then up to 10 rounds, each strategy picking one whole experiment from the remaining pool. EVR = expected variance reduction of the
target latent function. Baselines: uncertainty sampling, nearest gap, random. Metric: log loss (and Brier) on the held-out target observations, which never enter
fitting. A constant majority-class prediction is reported for reference.

Summary over 18 pseudo-target scenarios (95% bootstrap CIs over seeds on the paired difference of the area under the target log-loss curve):

- EVR versus random: better in 10, indistinguishable in 3, worse in 5.
- EVR versus uncertainty sampling: better in 9, indistinguishable in 4, worse in 5.
- EVR versus nearest gap: better in 9, indistinguishable in 2, worse in 7.
- Final-round EVR target log loss was below the constant majority-class baseline in 13 of 18 scenarios (random: 12 of 18).
- In 10 of 18 scenarios all four strategies end within 0.0005 of the same final log loss. 10 of 18 scenarios have at most 10 experiments left in the pool after the 3 initial ones, so the strategies can acquire every pool experiment and only the path (area under the curve) differs.
- Scenarios skipped by the design: `pmma_slab__opposed` / campaign_holdout:BASS-II/Miller: pool would have < 6 experiments; `pmma_rod__unknown` / campaign_holdout:BASS-II/Olson: pool would have < 6 experiments; `pmma_sphere__stagnation` / campaign_holdout:BASS/2012: pool would have < 6 experiments; `pmma_sphere__unknown` / campaign_holdout:BASS/2013: pool would have < 6 experiments; `pmma_sphere__unknown` / low_airflow_frontier: no seed produced an initial set with both labels.

Limitations (from the artifact):

- Every observation is at ~1 atm, so pressure plays no role in this evaluation.
- Targets are real experiments of the same groups and may be easy or hard for reasons unrelated to acquisition; classes are imbalanced (mostly sustained).
- Scenarios in one group share experiments and are not independent; seeds are not independent samples of the world, only of initial sets.
- Experiments are the acquisition unit; the real candidate set (single points) differs.

Honest reading: the artifact's own interpretation is "Across 18 pseudo-target scenarios, EVR had a lower target log-loss area than random selection in 10, was indistinguishable in 3 and was worse in 5; versus uncertainty sampling: better in 9, indistinguishable in 4, worse in 5 (95% bootstrap CIs over seeds). The advantage is small-sample evidence only. Scenarios share the same groups and are not independent." EVR is not shown to be reliably better than the baselines; it is a principled
target-aware score whose retrospective advantage, where present, is small-sample evidence only.

Per scenario (AUC difference of the target log-loss curve; negative favours EVR; tag from the CI):

| group | target scenario | pool/target experiments | target sust./not sust. | AUC diff EVR - random [95% CI] | EVR - uncertainty sampling | EVR - nearest gap | majority-class log loss (target) | EVR final log loss | random final log loss |
|---|---|---|---|---|---|---|---|---|---|
| `pmma_rod__opposed` | lowest_o2_quartile | 18/6 | 23/7 | +0.092 [+0.047, +0.133] EVR worse | -0.039 [-0.064, -0.017] EVR better | -0.025 [-0.047, -0.004] EVR better | 0.555 | 0.566 | 0.557 |
| `pmma_rod__opposed` | low_airflow_frontier | 18/6 | 25/6 | -0.404 [-0.678, -0.162] EVR better | -1.087 [-1.242, -0.930] EVR better | -0.717 [-0.903, -0.535] EVR better | 0.493 | 0.503 | 0.507 |
| `pmma_slab__opposed` | lowest_o2_quartile | 16/6 | 28/5 | +0.089 [-0.006, +0.181] indist. | +0.136 [+0.016, +0.240] EVR worse | +0.106 [+0.013, +0.188] EVR worse | 0.431 | 0.425 | 0.421 |
| `pmma_slab__opposed` | low_airflow_frontier | 16/6 | 29/2 | -0.655 [-0.974, -0.359] EVR better | -0.105 [-0.197, -0.014] EVR better | -0.330 [-0.394, -0.266] EVR better | 0.342 | 0.338 | 0.364 |
| `pmma_rod__stagnation` | lowest_o2_quartile | 11/4 | 11/7 | +0.148 [+0.049, +0.241] EVR worse | +0.297 [+0.222, +0.370] EVR worse | -0.020 [-0.084, +0.051] indist. | 0.745 | 0.570 | 0.570 |
| `pmma_rod__stagnation` | low_airflow_frontier | 11/4 | 23/4 | +0.427 [+0.312, +0.545] EVR worse | +0.282 [+0.147, +0.410] EVR worse | +0.173 [+0.038, +0.307] EVR worse | 0.469 | 0.531 | 0.531 |
| `pmma_rod__unknown` | lowest_o2_quartile | 9/3 | 12/2 | -0.079 [-0.139, -0.022] EVR better | -0.011 [-0.026, +0.002] indist. | -0.098 [-0.137, -0.066] EVR better | 0.411 | 0.418 | 0.418 |
| `pmma_rod__unknown` | low_airflow_frontier | 8/4 | 21/3 | -0.052 [-0.094, -0.013] EVR better | -0.009 [-0.030, +0.011] indist. | -0.001 [-0.015, +0.013] indist. | 0.377 | 0.364 | 0.364 |
| `pmma_thin_film__opposed` | lowest_o2_quartile | 11/5 | 7/4 | +0.131 [+0.057, +0.210] EVR worse | +0.033 [+0.014, +0.054] EVR worse | +0.155 [+0.132, +0.177] EVR worse | 0.728 | 0.685 | 0.685 |
| `pmma_thin_film__opposed` | low_airflow_frontier | 12/4 | 16/4 | -0.209 [-0.316, -0.108] EVR better | -0.318 [-0.433, -0.211] EVR better | -0.213 [-0.272, -0.156] EVR better | 0.513 | 0.373 | 0.373 |
| `pmma_sphere__wake` | lowest_o2_quartile | 17/7 | 9/2 | -0.165 [-0.181, -0.147] EVR better | -0.046 [-0.063, -0.030] EVR better | -0.227 [-0.251, -0.203] EVR better | 0.521 | 0.250 | 0.257 |
| `pmma_sphere__wake` | low_airflow_frontier | 15/9 | 12/9 | +0.516 [+0.306, +0.717] EVR worse | -0.164 [-0.275, -0.054] EVR better | +0.321 [+0.222, +0.422] EVR worse | 0.730 | 0.801 | 0.805 |
| `pmma_sphere__wake` | campaign_holdout:BASS/2012 | 7/17 | 23/8 | -0.123 [-0.221, -0.039] EVR better | +0.005 [-0.028, +0.038] indist. | +0.043 [+0.017, +0.070] EVR worse | 0.577 | 0.288 | 0.288 |
| `sibal_fabric__concurrent` | lowest_o2_quartile | 18/7 | 5/5 | -0.321 [-0.696, +0.063] indist. | -0.930 [-1.284, -0.584] EVR better | +0.320 [+0.043, +0.564] EVR worse | 0.786 | 0.707 | 0.779 |
| `sibal_fabric__concurrent` | low_airflow_frontier | 18/7 | 13/4 | -0.857 [-1.280, -0.439] EVR better | +0.089 [-0.150, +0.296] indist. | -0.195 [-0.318, -0.068] EVR better | 0.631 | 0.554 | 0.605 |
| `pmma_sphere__stagnation` | lowest_o2_quartile | 11/7 | 9/4 | -0.115 [-0.141, -0.087] EVR better | -0.020 [-0.029, -0.012] EVR better | -0.091 [-0.106, -0.074] EVR better | 0.617 | 0.332 | 0.332 |
| `pmma_sphere__stagnation` | low_airflow_frontier | 10/8 | 10/8 | +0.077 [-0.076, +0.240] indist. | +0.359 [+0.198, +0.557] EVR worse | +0.275 [+0.132, +0.445] EVR worse | 0.797 | 0.510 | 0.510 |
| `pmma_sphere__unknown` | lowest_o2_quartile | 13/5 | 7/1 | -0.152 [-0.186, -0.119] EVR better | -0.062 [-0.078, -0.046] EVR better | -0.177 [-0.214, -0.137] EVR better | 0.386 | 0.161 | 0.161 |


## Per-group results

### `pmma_rod__opposed`

PMMA rods · opposed flow. Campaigns: BASS-II/Fernandez-Pello. **24 experiments, 108 observations: 87 sustained / 21 not sustained (majority class = 81%).**
GP mean function: `constant`. Small sample: 24 experiments. Intervals are wide and metrics are unstable.

Cross-validation (grouped 5-fold by experiment x 5 repeats), value [95% CI]:

| model | Brier | log loss | AUC | ECE |
|---|---|---|---|---|
| gp | 0.158 [0.118, 0.212] | 0.492 [0.393, 0.629] | 0.612 [0.522, 0.731] | 0.077 [0.047, 0.171] |
| logistic_o2_flow | 0.164 [0.117, 0.231] | 0.546 [0.394, 0.799] | 0.554 [0.411, 0.711] | 0.062 [0.030, 0.157] |
| logistic_o2 | 0.161 [0.122, 0.217] | 0.507 [0.415, 0.641] | 0.407 [0.310, 0.509] | 0.072 [0.021, 0.151] |
| majority_class | 0.158 [0.120, 0.212] | 0.497 [0.410, 0.622] | 0.500 [0.500, 0.500] | 0.048 [0.011, 0.111] |
| bootstrap_logistic_ensemble | 0.160 [0.115, 0.224] | 0.520 [0.387, 0.735] | 0.570 [0.420, 0.731] | 0.085 [0.046, 0.172] |

GP minus majority class: log loss -0.005 [-0.041, 0.033], Brier -0.000 [-0.012, 0.011]: not distinguishable (CI includes 0).

Calibration (GP, pooled predictions; non-empty bins: count, mean predicted, observed frequency): [0.2,0.3) n=1 pred 0.30 obs 1.00; [0.3,0.4) n=4 pred 0.32 obs 1.00; [0.4,0.5) n=3 pred 0.47 obs 0.00; [0.5,0.6) n=20 pred 0.57 obs 0.75; [0.6,0.7) n=109 pred 0.65 obs 0.80; [0.7,0.8) n=97 pred 0.75 obs 0.63; [0.8,0.9) n=230 pred 0.86 obs 0.87; [0.9,1.0) n=76 pred 0.92 obs 0.88. Counts pool the 5 repeats, so they are 5 times the row counts.

Leave-one-campaign-out: not applicable (group spans a single campaign).

Sensitivity (GP, same CV, evaluated on each variant's own rows; delta = variant log loss minus primary, not like-for-like when the rows differ):

| variant | n rows | not sustained | Brier | log loss | AUC | delta log loss |
|---|---|---|---|---|---|---|
| add low-confidence rows | 108 | 21 | 0.158 | 0.492 | 0.612 | 0.000 |
| O2 initial value only | 108 | 21 | 0.162 | 0.501 | 0.606 | 0.009 |
| drop below_calibration_range rows | 36 | 4 | 0.107 | 0.363 | 0.658 | -0.128 |
| drop flow_off_transient rows | 106 | 19 | 0.153 | 0.484 | 0.550 | -0.007 |
| drop no_sustained_propagation rows | 105 | 18 | 0.134 | 0.435 | 0.660 | -0.057 |
| pressure length scale 0.15 (ln units) | 108 | 21 | 0.158 | 0.492 | 0.612 | 0.000 |
| pressure length scale 0.6 (ln units) | 108 | 21 | 0.158 | 0.492 | 0.612 | 0.000 |

Subgroups (GP out-of-fold):

| subgroup | n | not sustained | Brier | log loss |
|---|---|---|---|---|
| O2 < 17 % | 20 | 7 | 0.269 | 0.759 |
| O2 17-20 % | 71 | 11 | 0.127 | 0.419 |
| O2 > 20 % | 17 | 3 | 0.155 | 0.478 |
| airflow < 3 cm/s | 81 | 17 | 0.165 | 0.514 |
| airflow 3-10 cm/s | 24 | 2 | 0.074 | 0.274 |
| airflow > 10 cm/s | 3 | 2 | 0.630 | 1.623 |
| confidence high | 49 | 20 | 0.272 | 0.759 |
| confidence medium | 59 | 1 | 0.062 | 0.270 |

Blind-spot test: **inconclusive**. Point level (n=108): Spearman rho=0.42 (one-sided p=<0.001) between pre-reveal epistemic uncertainty and log loss; AUROC for flagging 21 misclassified points = 0.62. Experiment level (n=24 held-out experiments): rho=0.38 (p=0.028). The two levels do not agree, or the evidence is below the 0.05 threshold; treat as inconclusive. Controlling for aleatoric uncertainty, the point-level association is 0.14 (p=0.074). Possible reasons: aleatoric (outcome-variability) uncertainty tracks log loss more strongly (rho=0.69), so errors concentrate where the model already expects mixed outcomes rather than where data are sparse; 5% of misclassified points are flow-turned-off transient labels, which are not a physical quench boundary.

### `pmma_slab__opposed`

PMMA slabs · opposed flow. Campaigns: BASS-II/Miller, BASS/2013. **22 experiments, 95 observations: 80 sustained / 15 not sustained (majority class = 84%).**
GP mean function: `constant`. Small sample: 22 experiments; only 15 not-sustained observations. Intervals are wide and metrics are unstable.

Cross-validation (grouped 5-fold by experiment x 5 repeats), value [95% CI]:

| model | Brier | log loss | AUC | ECE |
|---|---|---|---|---|
| gp | 0.134 [0.102, 0.180] | 0.445 [0.365, 0.555] | 0.481 [0.332, 0.652] | 0.040 [0.023, 0.110] |
| logistic_o2_flow | 0.132 [0.099, 0.178] | 0.438 [0.352, 0.562] | 0.558 [0.429, 0.704] | 0.050 [0.025, 0.117] |
| logistic_o2 | 0.131 [0.098, 0.178] | 0.434 [0.350, 0.558] | 0.582 [0.457, 0.728] | 0.064 [0.031, 0.122] |
| majority_class | 0.134 [0.102, 0.179] | 0.439 [0.362, 0.549] | 0.500 [0.500, 0.500] | 0.009 [0.001, 0.065] |
| bootstrap_logistic_ensemble | 0.132 [0.100, 0.177] | 0.438 [0.355, 0.557] | 0.548 [0.417, 0.696] | 0.047 [0.019, 0.106] |

GP minus majority class: log loss 0.006 [-0.021, 0.033], Brier 0.001 [-0.007, 0.008]: not distinguishable (CI includes 0).

Calibration (GP, pooled predictions; non-empty bins: count, mean predicted, observed frequency): [0.5,0.6) n=8 pred 0.57 obs 0.38; [0.6,0.7) n=14 pred 0.66 obs 0.71; [0.7,0.8) n=115 pred 0.77 obs 0.87; [0.8,0.9) n=316 pred 0.85 obs 0.85; [0.9,1.0) n=22 pred 0.91 obs 0.77. Counts pool the 5 repeats, so they are 5 times the row counts.

Leave-one-campaign-out (GP vs majority log loss; n rows and not-sustained rows in the held-out campaign):

| held-out campaign | n | not sustained | GP Brier | GP log loss | GP AUC | majority log loss |
|---|---|---|---|---|---|---|
| BASS-II/Miller | 93 | 13 | 0.613 | 1.613 | 0.386 | 1.233 |
| BASS/2013 | 2 | 2 | 0.808 | 2.296 | n/a | 1.915 |

Sensitivity (GP, same CV, evaluated on each variant's own rows; delta = variant log loss minus primary, not like-for-like when the rows differ):

| variant | n rows | not sustained | Brier | log loss | AUC | delta log loss |
|---|---|---|---|---|---|---|
| add low-confidence rows | 97 | 15 | 0.135 | 0.451 | 0.429 | 0.007 |
| O2 initial value only | 95 | 15 | 0.137 | 0.452 | 0.426 | 0.007 |
| drop below_calibration_range rows | 92 | 13 | 0.128 | 0.430 | 0.413 | -0.015 |
| drop flow_off_transient rows | 94 | 14 | 0.131 | 0.438 | 0.414 | -0.007 |
| drop no_sustained_propagation rows | 93 | 13 | 0.118 | 0.401 | 0.571 | -0.043 |
| pressure length scale 0.15 (ln units) | 95 | 15 | 0.134 | 0.444 | 0.490 | -0.001 |
| pressure length scale 0.6 (ln units) | 95 | 15 | 0.135 | 0.445 | 0.479 | 0.000 |

Subgroups (GP out-of-fold):

| subgroup | n | not sustained | Brier | log loss |
|---|---|---|---|---|
| O2 < 17 % | 1 | 1 | 0.466 | 1.156 |
| O2 17-20 % | 59 | 10 | 0.145 | 0.473 |
| O2 > 20 % | 35 | 4 | 0.108 | 0.376 |
| airflow < 3 cm/s | 11 | 2 | 0.127 | 0.409 |
| airflow 3-10 cm/s | 36 | 7 | 0.158 | 0.507 |
| airflow > 10 cm/s | 48 | 6 | 0.119 | 0.406 |
| confidence high | 38 | 15 | 0.286 | 0.823 |
| confidence medium | 57 | 0 | 0.034 | 0.192 |

Blind-spot test: **inconclusive**. Point level (n=95): Spearman rho=0.37 (one-sided p=<0.001) between pre-reveal epistemic uncertainty and log loss; AUROC for flagging 15 misclassified points = 0.57. Experiment level (n=22 held-out experiments): rho=-0.10 (p=0.687). The two levels do not agree, or the evidence is below the 0.05 threshold; treat as inconclusive. Controlling for aleatoric uncertainty, the point-level association is 0.15 (p=0.073). Possible reasons: aleatoric (outcome-variability) uncertainty tracks log loss more strongly (rho=0.64), so errors concentrate where the model already expects mixed outcomes rather than where data are sparse; 7% of misclassified points are flow-turned-off transient labels, which are not a physical quench boundary.

### `pmma_rod__stagnation`

PMMA rods · axial stagnation flow. Campaigns: BASS-II/Olson. **15 experiments, 67 observations: 51 sustained / 16 not sustained (majority class = 76%).**
GP mean function: `constant`. Small sample: 15 experiments; only 16 not-sustained observations. Intervals are wide and metrics are unstable.

Cross-validation (grouped 5-fold by experiment x 5 repeats), value [95% CI]:

| model | Brier | log loss | AUC | ECE |
|---|---|---|---|---|
| gp | 0.151 [0.124, 0.185] | 0.486 [0.416, 0.576] | 0.747 [0.586, 0.875] | 0.114 [0.083, 0.198] |
| logistic_o2_flow | 0.142 [0.113, 0.176] | 0.483 [0.386, 0.609] | 0.773 [0.633, 0.891] | 0.107 [0.084, 0.203] |
| logistic_o2 | 0.154 [0.121, 0.194] | 0.488 [0.394, 0.595] | 0.741 [0.618, 0.878] | 0.051 [0.037, 0.161] |
| majority_class | 0.187 [0.140, 0.268] | 0.565 [0.458, 0.749] | 0.500 [0.500, 0.500] | 0.072 [0.016, 0.141] |
| bootstrap_logistic_ensemble | 0.141 [0.113, 0.175] | 0.477 [0.382, 0.590] | 0.776 [0.633, 0.898] | 0.101 [0.089, 0.204] |

GP minus majority class: log loss -0.079 [-0.219, 0.018], Brier -0.036 [-0.096, 0.004]: not distinguishable (CI includes 0).

Calibration (GP, pooled predictions; non-empty bins: count, mean predicted, observed frequency): [0.2,0.3) n=3 pred 0.29 obs 0.00; [0.3,0.4) n=11 pred 0.38 obs 0.18; [0.4,0.5) n=22 pred 0.46 obs 0.59; [0.5,0.6) n=34 pred 0.56 obs 0.41; [0.6,0.7) n=39 pred 0.65 obs 0.59; [0.7,0.8) n=101 pred 0.76 obs 0.92; [0.8,0.9) n=72 pred 0.85 obs 0.90; [0.9,1.0) n=53 pred 0.94 obs 0.85. Counts pool the 5 repeats, so they are 5 times the row counts.

Leave-one-campaign-out: not applicable (group spans a single campaign).

Sensitivity (GP, same CV, evaluated on each variant's own rows; delta = variant log loss minus primary, not like-for-like when the rows differ):

| variant | n rows | not sustained | Brier | log loss | AUC | delta log loss |
|---|---|---|---|---|---|---|
| add low-confidence rows | 72 | 16 | 0.129 | 0.429 | 0.785 | -0.057 |
| O2 initial value only | 67 | 16 | 0.162 | 0.511 | 0.705 | 0.025 |
| drop below_calibration_range rows | 33 | 11 | 0.173 | 0.514 | 0.802 | 0.029 |
| drop flow_off_transient rows | 67 | 16 | 0.151 | 0.486 | 0.747 | 0.000 |
| drop no_sustained_propagation rows | 62 | 11 | 0.145 | 0.467 | 0.610 | -0.019 |
| pressure length scale 0.15 (ln units) | 67 | 16 | 0.151 | 0.486 | 0.747 | 0.000 |
| pressure length scale 0.6 (ln units) | 67 | 16 | 0.151 | 0.486 | 0.747 | 0.000 |

Subgroups (GP out-of-fold):

| subgroup | n | not sustained | Brier | log loss |
|---|---|---|---|---|
| O2 < 17 % | 65 | 16 | 0.155 | 0.497 |
| O2 17-20 % | 2 | 0 | 0.012 | 0.112 |
| O2 > 20 % | 0 | 0 | n/a | n/a |
| airflow < 3 cm/s | 41 | 7 | 0.142 | 0.476 |
| airflow 3-10 cm/s | 15 | 4 | 0.154 | 0.470 |
| airflow > 10 cm/s | 11 | 5 | 0.180 | 0.544 |
| confidence high | 22 | 10 | 0.220 | 0.656 |
| confidence medium | 45 | 6 | 0.118 | 0.402 |

Blind-spot test: **inconclusive**. Point level (n=67): Spearman rho=0.52 (one-sided p=<0.001) between pre-reveal epistemic uncertainty and log loss; AUROC for flagging 14 misclassified points = 0.62. Experiment level (n=15 held-out experiments): rho=0.04 (p=0.450). The two levels do not agree, or the evidence is below the 0.05 threshold; treat as inconclusive. Controlling for aleatoric uncertainty, the point-level association is 0.24 (p=0.029). Possible reasons: aleatoric (outcome-variability) uncertainty tracks log loss more strongly (rho=0.72), so errors concentrate where the model already expects mixed outcomes rather than where data are sparse.

### `pmma_rod__unknown`

PMMA rods · configuration not recorded. Campaigns: BASS-II/Fernandez-Pello, BASS-II/Olson. **12 experiments, 52 observations: 46 sustained / 6 not sustained (majority class = 88%).**
GP mean function: `constant`. Small sample: 12 experiments; only 6 not-sustained observations. Intervals are wide and metrics are unstable.

Cross-validation (grouped 5-fold by experiment x 5 repeats), value [95% CI]:

| model | Brier | log loss | AUC | ECE |
|---|---|---|---|---|
| gp | 0.113 [0.070, 0.165] | 0.387 [0.271, 0.537] | 0.496 [0.312, 0.700] | 0.079 [0.038, 0.175] |
| logistic_o2_flow | 0.114 [0.067, 0.169] | 0.416 [0.253, 0.602] | 0.527 [0.294, 0.791] | 0.098 [0.052, 0.170] |
| logistic_o2 | 0.107 [0.063, 0.158] | 0.367 [0.240, 0.509] | 0.576 [0.398, 0.806] | 0.060 [0.028, 0.146] |
| majority_class | 0.107 [0.061, 0.160] | 0.380 [0.259, 0.525] | 0.500 [0.500, 0.500] | 0.093 [0.040, 0.165] |
| bootstrap_logistic_ensemble | 0.116 [0.069, 0.171] | 0.408 [0.253, 0.586] | 0.558 [0.318, 0.807] | 0.137 [0.073, 0.206] |

GP minus majority class: log loss 0.007 [-0.033, 0.048], Brier 0.006 [-0.006, 0.017]: not distinguishable (CI includes 0).

Calibration (GP, pooled predictions; non-empty bins: count, mean predicted, observed frequency): [0.6,0.7) n=19 pred 0.68 obs 1.00; [0.7,0.8) n=52 pred 0.76 obs 0.90; [0.8,0.9) n=70 pred 0.85 obs 0.86; [0.9,1.0) n=119 pred 0.93 obs 0.87. Counts pool the 5 repeats, so they are 5 times the row counts.

Leave-one-campaign-out (GP vs majority log loss; n rows and not-sustained rows in the held-out campaign):

| held-out campaign | n | not sustained | GP Brier | GP log loss | GP AUC | majority log loss |
|---|---|---|---|---|---|---|
| BASS-II/Fernandez-Pello | 13 | 2 | 0.129 | 0.415 | 0.818 | 0.434 |
| BASS-II/Olson | 39 | 4 | 0.098 | 0.348 | 0.707 | 0.365 |

Sensitivity (GP, same CV, evaluated on each variant's own rows; delta = variant log loss minus primary, not like-for-like when the rows differ):

| variant | n rows | not sustained | Brier | log loss | AUC | delta log loss |
|---|---|---|---|---|---|---|
| add low-confidence rows | 53 | 6 | 0.110 | 0.380 | 0.516 | -0.007 |
| O2 initial value only | 52 | 6 | 0.112 | 0.388 | 0.480 | 0.001 |
| drop below_calibration_range rows | 35 | 1 | 0.032 | 0.157 | 0.196 | -0.231 |
| drop flow_off_transient rows | 52 | 6 | 0.113 | 0.387 | 0.496 | 0.000 |
| drop no_sustained_propagation rows | 52 | 6 | 0.113 | 0.387 | 0.496 | 0.000 |
| pressure length scale 0.15 (ln units) | 52 | 6 | 0.113 | 0.387 | 0.496 | 0.000 |
| pressure length scale 0.6 (ln units) | 52 | 6 | 0.113 | 0.387 | 0.496 | 0.000 |

Subgroups (GP out-of-fold):

| subgroup | n | not sustained | Brier | log loss |
|---|---|---|---|---|
| O2 < 17 % | 30 | 5 | 0.164 | 0.538 |
| O2 17-20 % | 15 | 1 | 0.057 | 0.214 |
| O2 > 20 % | 7 | 0 | 0.012 | 0.112 |
| airflow < 3 cm/s | 29 | 5 | 0.164 | 0.531 |
| airflow 3-10 cm/s | 17 | 0 | 0.006 | 0.075 |
| airflow > 10 cm/s | 6 | 1 | 0.167 | 0.575 |
| confidence high | 12 | 6 | 0.384 | 1.102 |
| confidence medium | 40 | 0 | 0.031 | 0.173 |

Blind-spot test: **inconclusive**. Point level (n=52): Spearman rho=0.37 (one-sided p=0.003) between pre-reveal epistemic uncertainty and log loss; AUROC for flagging 6 misclassified points = 0.47. Experiment level (n=12 held-out experiments): rho=-0.21 (p=0.774). The two levels do not agree, or the evidence is below the 0.05 threshold; treat as inconclusive. Controlling for aleatoric uncertainty, the point-level association is 0.08 (p=0.267). Possible reasons: aleatoric (outcome-variability) uncertainty tracks log loss more strongly (rho=0.81), so errors concentrate where the model already expects mixed outcomes rather than where data are sparse.

### `pmma_thin_film__opposed`

Thin PMMA films · opposed flow. Campaigns: BASS-II/Bhattacharjee. **16 experiments, 48 observations: 37 sustained / 11 not sustained (majority class = 77%).**
GP mean function: `constant`. Small sample: 16 experiments; only 11 not-sustained observations. Intervals are wide and metrics are unstable.

Cross-validation (grouped 5-fold by experiment x 5 repeats), value [95% CI]:

| model | Brier | log loss | AUC | ECE |
|---|---|---|---|---|
| gp | 0.116 [0.086, 0.152] | 0.366 [0.290, 0.459] | 0.892 [0.823, 0.955] | 0.081 [0.065, 0.189] |
| logistic_o2_flow | 0.162 [0.117, 0.219] | 0.491 [0.377, 0.636] | 0.731 [0.572, 0.878] | 0.058 [0.047, 0.177] |
| logistic_o2 | 0.171 [0.133, 0.216] | 0.524 [0.432, 0.633] | 0.594 [0.438, 0.720] | 0.030 [0.021, 0.124] |
| majority_class | 0.180 [0.141, 0.225] | 0.547 [0.461, 0.648] | 0.500 [0.500, 0.500] | 0.013 [0.001, 0.105] |
| bootstrap_logistic_ensemble | 0.156 [0.113, 0.213] | 0.471 [0.366, 0.607] | 0.764 [0.615, 0.893] | 0.090 [0.060, 0.169] |

GP minus majority class: log loss -0.180 [-0.234, -0.128], Brier -0.064 [-0.088, -0.041]: GP better (CI excludes 0).

Calibration (GP, pooled predictions; non-empty bins: count, mean predicted, observed frequency): [0.3,0.4) n=10 pred 0.37 obs 0.30; [0.4,0.5) n=32 pred 0.46 obs 0.25; [0.5,0.6) n=13 pred 0.56 obs 0.62; [0.6,0.7) n=32 pred 0.66 obs 0.72; [0.7,0.8) n=32 pred 0.76 obs 0.75; [0.8,0.9) n=46 pred 0.85 obs 0.96; [0.9,1.0) n=75 pred 0.95 obs 1.00. Counts pool the 5 repeats, so they are 5 times the row counts.

Leave-one-campaign-out: not applicable (group spans a single campaign).

Sensitivity (GP, same CV, evaluated on each variant's own rows; delta = variant log loss minus primary, not like-for-like when the rows differ):

| variant | n rows | not sustained | Brier | log loss | AUC | delta log loss |
|---|---|---|---|---|---|---|
| add low-confidence rows | 48 | 11 | 0.116 | 0.366 | 0.892 | 0.000 |
| O2 initial value only | 48 | 11 | 0.116 | 0.366 | 0.895 | -0.001 |
| drop below_calibration_range rows | 37 | 3 | 0.050 | 0.192 | 0.920 | -0.174 |
| drop flow_off_transient rows | 48 | 11 | 0.116 | 0.366 | 0.892 | 0.000 |
| drop no_sustained_propagation rows | 47 | 10 | 0.115 | 0.359 | 0.883 | -0.008 |
| pressure length scale 0.15 (ln units) | 48 | 11 | 0.116 | 0.366 | 0.892 | 0.000 |
| pressure length scale 0.6 (ln units) | 48 | 11 | 0.116 | 0.366 | 0.892 | 0.000 |

Subgroups (GP out-of-fold):

| subgroup | n | not sustained | Brier | log loss |
|---|---|---|---|---|
| O2 < 17 % | 1 | 1 | 0.660 | 1.684 |
| O2 17-20 % | 13 | 4 | 0.132 | 0.426 |
| O2 > 20 % | 34 | 6 | 0.094 | 0.305 |
| airflow < 3 cm/s | 19 | 8 | 0.205 | 0.591 |
| airflow 3-10 cm/s | 20 | 1 | 0.044 | 0.173 |
| airflow > 10 cm/s | 9 | 2 | 0.087 | 0.322 |
| confidence high | 20 | 9 | 0.148 | 0.451 |
| confidence medium | 28 | 2 | 0.093 | 0.306 |

Blind-spot test: **inconclusive**. Point level (n=48): Spearman rho=0.60 (one-sided p=<0.001) between pre-reveal epistemic uncertainty and log loss; AUROC for flagging 7 misclassified points = 0.62. Experiment level (n=16 held-out experiments): rho=0.26 (p=0.171). The two levels do not agree, or the evidence is below the 0.05 threshold; treat as inconclusive. Controlling for aleatoric uncertainty, the point-level association is 0.46 (p=<0.001). Possible reasons: aleatoric (outcome-variability) uncertainty tracks log loss more strongly (rho=0.91), so errors concentrate where the model already expects mixed outcomes rather than where data are sparse.

### `pmma_sphere__wake`

PMMA spheres · wake ignition. Campaigns: BASS/2012, BASS/2013. **24 experiments, 42 observations: 32 sustained / 10 not sustained (majority class = 76%).**
GP mean function: `constant`. Small sample: 24 experiments; only 10 not-sustained observations. Intervals are wide and metrics are unstable.

Cross-validation (grouped 5-fold by experiment x 5 repeats), value [95% CI]:

| model | Brier | log loss | AUC | ECE |
|---|---|---|---|---|
| gp | 0.033 [0.009, 0.068] | 0.143 [0.083, 0.234] | 0.994 [0.972, 1.000] | 0.088 [0.070, 0.122] |
| logistic_o2_flow | 0.054 [0.019, 0.108] | 0.354 [0.100, 0.864] | 0.901 [0.676, 1.000] | 0.086 [0.066, 0.151] |
| logistic_o2 | 0.198 [0.139, 0.265] | 0.711 [0.459, 1.132] | 0.344 [0.229, 0.436] | 0.083 [0.039, 0.177] |
| majority_class | 0.186 [0.136, 0.237] | 0.561 [0.450, 0.673] | 0.500 [0.500, 0.500] | 0.015 [0.002, 0.127] |
| bootstrap_logistic_ensemble | 0.051 [0.018, 0.105] | 0.289 [0.099, 0.659] | 0.906 [0.687, 1.000] | 0.094 [0.072, 0.152] |

GP minus majority class: log loss -0.418 [-0.531, -0.296], Brier -0.153 [-0.205, -0.097]: GP better (CI excludes 0).

Calibration (GP, pooled predictions; non-empty bins: count, mean predicted, observed frequency): [0.1,0.2) n=44 pred 0.14 obs 0.00; [0.2,0.3) n=1 pred 0.20 obs 0.00; [0.4,0.5) n=3 pred 0.46 obs 1.00; [0.5,0.6) n=5 pred 0.55 obs 1.00; [0.7,0.8) n=2 pred 0.77 obs 0.00; [0.8,0.9) n=30 pred 0.85 obs 0.90; [0.9,1.0) n=125 pred 0.96 obs 1.00. Counts pool the 5 repeats, so they are 5 times the row counts.

Leave-one-campaign-out (GP vs majority log loss; n rows and not-sustained rows in the held-out campaign):

| held-out campaign | n | not sustained | GP Brier | GP log loss | GP AUC | majority log loss |
|---|---|---|---|---|---|---|
| BASS/2012 | 31 | 8 | 0.080 | 0.288 | 1.000 | 0.573 |
| BASS/2013 | 11 | 2 | 0.075 | 0.247 | 0.944 | 0.497 |

Sensitivity (GP, same CV, evaluated on each variant's own rows; delta = variant log loss minus primary, not like-for-like when the rows differ):

| variant | n rows | not sustained | Brier | log loss | AUC | delta log loss |
|---|---|---|---|---|---|---|
| add low-confidence rows | 74 | 15 | 0.112 | 0.359 | 0.867 | 0.216 |
| O2 initial value only | 42 | 10 | 0.033 | 0.143 | 0.994 | 0.000 |
| drop below_calibration_range rows | 42 | 10 | 0.033 | 0.143 | 0.994 | 0.000 |
| drop flow_off_transient rows | 33 | 1 | 0.034 | 0.146 | 0.819 | 0.003 |
| drop no_sustained_propagation rows | 41 | 9 | 0.013 | 0.095 | 1.000 | -0.048 |
| pressure length scale 0.15 (ln units) | 42 | 10 | 0.033 | 0.143 | 0.994 | 0.000 |
| pressure length scale 0.6 (ln units) | 42 | 10 | 0.033 | 0.143 | 0.994 | -0.000 |

Subgroups (GP out-of-fold):

| subgroup | n | not sustained | Brier | log loss |
|---|---|---|---|---|
| O2 < 17 % | 1 | 1 | 0.645 | 1.632 |
| O2 17-20 % | 1 | 0 | 0.185 | 0.538 |
| O2 > 20 % | 40 | 9 | 0.014 | 0.096 |
| airflow < 3 cm/s | 13 | 9 | 0.034 | 0.186 |
| airflow 3-10 cm/s | 22 | 1 | 0.039 | 0.133 |
| airflow > 10 cm/s | 7 | 0 | 0.010 | 0.093 |
| confidence high | 22 | 10 | 0.051 | 0.201 |
| confidence medium | 20 | 0 | 0.013 | 0.079 |

Blind-spot test: **supported**. Point level (n=42): Spearman rho=0.96 (one-sided p=<0.001) between pre-reveal epistemic uncertainty and log loss; AUROC for flagging 1 misclassified points = 0.98. Experiment level (n=24 held-out experiments): rho=0.95 (p=<0.001). Withheld experiments with higher pre-reveal epistemic uncertainty tended to be predicted worse at both levels; this is an association in a small, imbalanced sample, not a guarantee. Controlling for aleatoric uncertainty, the point-level association is 0.80 (p=<0.001).

### `sibal_fabric__concurrent`

SIBAL cotton/fiberglass fabric · concurrent flow. Campaigns: BASS-II/T'ien. **25 experiments, 42 observations: 29 sustained / 13 not sustained (majority class = 69%).**
GP mean function: `constant`. Small sample: 25 experiments; only 13 not-sustained observations. Intervals are wide and metrics are unstable.

Cross-validation (grouped 5-fold by experiment x 5 repeats), value [95% CI]:

| model | Brier | log loss | AUC | ECE |
|---|---|---|---|---|
| gp | 0.214 [0.170, 0.266] | 0.613 [0.511, 0.731] | 0.597 [0.455, 0.748] | 0.099 [0.055, 0.220] |
| logistic_o2_flow | 0.242 [0.189, 0.311] | 0.732 [0.575, 0.931] | 0.466 [0.304, 0.662] | 0.180 [0.108, 0.282] |
| logistic_o2 | 0.232 [0.182, 0.303] | 0.682 [0.562, 0.860] | 0.476 [0.324, 0.634] | 0.119 [0.074, 0.253] |
| majority_class | 0.227 [0.184, 0.282] | 0.649 [0.559, 0.765] | 0.500 [0.500, 0.500] | 0.126 [0.068, 0.216] |
| bootstrap_logistic_ensemble | 0.237 [0.185, 0.300] | 0.704 [0.560, 0.886] | 0.494 [0.327, 0.698] | 0.163 [0.093, 0.266] |

GP minus majority class: log loss -0.036 [-0.113, 0.032], Brier -0.013 [-0.048, 0.019]: not distinguishable (CI includes 0).

Calibration (GP, pooled predictions; non-empty bins: count, mean predicted, observed frequency): [0.3,0.4) n=16 pred 0.38 obs 0.56; [0.4,0.5) n=15 pred 0.46 obs 0.67; [0.5,0.6) n=45 pred 0.55 obs 0.67; [0.6,0.7) n=41 pred 0.66 obs 0.68; [0.7,0.8) n=51 pred 0.75 obs 0.65; [0.8,0.9) n=32 pred 0.86 obs 0.78; [0.9,1.0) n=10 pred 0.91 obs 1.00. Counts pool the 5 repeats, so they are 5 times the row counts.

Leave-one-campaign-out: not applicable (group spans a single campaign).

Sensitivity (GP, same CV, evaluated on each variant's own rows; delta = variant log loss minus primary, not like-for-like when the rows differ):

| variant | n rows | not sustained | Brier | log loss | AUC | delta log loss |
|---|---|---|---|---|---|---|
| add low-confidence rows | 42 | 13 | 0.214 | 0.613 | 0.597 | 0.000 |
| O2 initial value only | 42 | 13 | 0.212 | 0.609 | 0.607 | -0.004 |
| drop below_calibration_range rows | 42 | 13 | 0.214 | 0.613 | 0.597 | 0.000 |
| drop flow_off_transient rows | 42 | 13 | 0.214 | 0.613 | 0.597 | 0.000 |
| drop no_sustained_propagation rows | 37 | 8 | 0.180 | 0.538 | 0.597 | -0.074 |
| pressure length scale 0.15 (ln units) | 42 | 13 | 0.214 | 0.613 | 0.597 | 0.000 |
| pressure length scale 0.6 (ln units) | 42 | 13 | 0.214 | 0.613 | 0.597 | 0.000 |

Subgroups (GP out-of-fold):

| subgroup | n | not sustained | Brier | log loss |
|---|---|---|---|---|
| O2 < 17 % | 7 | 4 | 0.264 | 0.724 |
| O2 17-20 % | 27 | 6 | 0.170 | 0.512 |
| O2 > 20 % | 8 | 3 | 0.320 | 0.857 |
| airflow < 3 cm/s | 9 | 3 | 0.271 | 0.753 |
| airflow 3-10 cm/s | 23 | 8 | 0.211 | 0.602 |
| airflow > 10 cm/s | 10 | 2 | 0.170 | 0.511 |
| confidence high | 22 | 12 | 0.274 | 0.748 |
| confidence medium | 20 | 1 | 0.149 | 0.464 |

Blind-spot test: **inconclusive**. Point level (n=42): Spearman rho=0.39 (one-sided p=0.007) between pre-reveal epistemic uncertainty and log loss; AUROC for flagging 13 misclassified points = 0.60. Experiment level (n=25 held-out experiments): rho=0.19 (p=0.173). The two levels do not agree, or the evidence is below the 0.05 threshold; treat as inconclusive. Controlling for aleatoric uncertainty, the point-level association is 0.40 (p=0.007). Possible reasons: aleatoric (outcome-variability) uncertainty tracks log loss more strongly (rho=0.44), so errors concentrate where the model already expects mixed outcomes rather than where data are sparse.

### `pmma_sphere__stagnation`

PMMA spheres · axial stagnation flow. Campaigns: BASS-II/T'ien, BASS/2012, BASS/2013. **18 experiments, 33 observations: 23 sustained / 10 not sustained (majority class = 70%).**
GP mean function: `constant`. Small sample: 18 experiments; only 10 not-sustained observations. Intervals are wide and metrics are unstable.

Cross-validation (grouped 5-fold by experiment x 5 repeats), value [95% CI]:

| model | Brier | log loss | AUC | ECE |
|---|---|---|---|---|
| gp | 0.073 [0.024, 0.144] | 0.268 [0.132, 0.458] | 0.959 [0.859, 1.000] | 0.117 [0.075, 0.207] |
| logistic_o2_flow | 0.099 [0.032, 0.183] | 0.403 [0.148, 0.801] | 0.874 [0.646, 1.000] | 0.145 [0.097, 0.236] |
| logistic_o2 | 0.240 [0.200, 0.283] | 0.682 [0.595, 0.780] | 0.278 [0.163, 0.383] | 0.168 [0.092, 0.264] |
| majority_class | 0.220 [0.185, 0.258] | 0.635 [0.560, 0.714] | 0.500 [0.500, 0.500] | 0.137 [0.080, 0.209] |
| bootstrap_logistic_ensemble | 0.092 [0.031, 0.172] | 0.340 [0.141, 0.649] | 0.910 [0.710, 1.000] | 0.131 [0.095, 0.229] |

GP minus majority class: log loss -0.367 [-0.504, -0.203], Brier -0.147 [-0.201, -0.087]: GP better (CI excludes 0).

Calibration (GP, pooled predictions; non-empty bins: count, mean predicted, observed frequency): [0.1,0.2) n=40 pred 0.14 obs 0.00; [0.3,0.4) n=8 pred 0.36 obs 1.00; [0.4,0.5) n=7 pred 0.46 obs 0.29; [0.5,0.6) n=4 pred 0.58 obs 1.00; [0.7,0.8) n=13 pred 0.75 obs 1.00; [0.8,0.9) n=7 pred 0.84 obs 1.00; [0.9,1.0) n=86 pred 0.93 obs 0.94. Counts pool the 5 repeats, so they are 5 times the row counts.

Leave-one-campaign-out (GP vs majority log loss; n rows and not-sustained rows in the held-out campaign):

| held-out campaign | n | not sustained | GP Brier | GP log loss | GP AUC | majority log loss |
|---|---|---|---|---|---|---|
| BASS-II/T'ien | 5 | 2 | 0.203 | 0.614 | 0.833 | 0.696 |
| BASS/2012 | 26 | 8 | 0.188 | 0.567 | 1.000 | 0.619 |
| BASS/2013 | 2 | 0 | 0.053 | 0.256 | n/a | 0.405 |

Sensitivity (GP, same CV, evaluated on each variant's own rows; delta = variant log loss minus primary, not like-for-like when the rows differ):

| variant | n rows | not sustained | Brier | log loss | AUC | delta log loss |
|---|---|---|---|---|---|---|
| add low-confidence rows | 62 | 12 | 0.056 | 0.219 | 0.925 | -0.049 |
| O2 initial value only | 33 | 10 | 0.073 | 0.266 | 0.960 | -0.001 |
| drop below_calibration_range rows | 32 | 9 | 0.075 | 0.268 | 0.969 | 0.000 |
| drop flow_off_transient rows | 25 | 2 | 0.079 | 0.290 | 0.670 | 0.022 |
| drop no_sustained_propagation rows | 32 | 9 | 0.030 | 0.145 | 0.995 | -0.122 |
| pressure length scale 0.15 (ln units) | 33 | 10 | 0.074 | 0.268 | 0.959 | 0.000 |
| pressure length scale 0.6 (ln units) | 33 | 10 | 0.073 | 0.268 | 0.959 | -0.000 |

Subgroups (GP out-of-fold):

| subgroup | n | not sustained | Brier | log loss |
|---|---|---|---|---|
| O2 < 17 % | 0 | 0 | n/a | n/a |
| O2 17-20 % | 7 | 2 | 0.249 | 0.751 |
| O2 > 20 % | 26 | 8 | 0.026 | 0.138 |
| airflow < 3 cm/s | 10 | 9 | 0.080 | 0.289 |
| airflow 3-10 cm/s | 14 | 0 | 0.038 | 0.170 |
| airflow > 10 cm/s | 9 | 1 | 0.121 | 0.395 |
| confidence high | 13 | 8 | 0.124 | 0.406 |
| confidence medium | 20 | 2 | 0.041 | 0.178 |

Blind-spot test: **supported**. Point level (n=33): Spearman rho=0.87 (one-sided p=<0.001) between pre-reveal epistemic uncertainty and log loss; AUROC for flagging 2 misclassified points = 0.87. Experiment level (n=18 held-out experiments): rho=0.82 (p=<0.001). Withheld experiments with higher pre-reveal epistemic uncertainty tended to be predicted worse at both levels; this is an association in a small, imbalanced sample, not a guarantee. Caveat: aleatoric (predictive-entropy) uncertainty tracks log loss at least as strongly (rho=0.91), and the epistemic-loss association controlling for it is 0.63; so this does not show that epistemic uncertainty adds information beyond the model's overall predictive uncertainty. Controlling for aleatoric uncertainty, the point-level association is 0.63 (p=<0.001).

### `pmma_sphere__unknown`

PMMA spheres · configuration not recorded. Campaigns: BASS/2012, BASS/2013. **18 experiments, 29 observations: 26 sustained / 3 not sustained (majority class = 90%).**
GP mean function: `constant`. Small sample: 18 experiments; only 3 not-sustained observations. Intervals are wide and metrics are unstable.

Cross-validation (grouped 5-fold by experiment x 5 repeats), value [95% CI]:

| model | Brier | log loss | AUC | ECE |
|---|---|---|---|---|
| gp | 0.036 [0.013, 0.059] | 0.160 [0.101, 0.216] | 1.000 [1.000, 1.000] | 0.133 [0.091, 0.172] |
| logistic_o2_flow | 0.039 [0.010, 0.068] | 0.134 [0.051, 0.212] | 0.996 [0.983, 1.000] | 0.085 [0.036, 0.152] |
| logistic_o2 | 0.097 [0.017, 0.177] | 0.346 [0.126, 0.571] | 0.483 [0.284, 0.657] | 0.015 [0.012, 0.122] |
| majority_class | 0.099 [0.021, 0.178] | 0.363 [0.157, 0.575] | 0.500 [0.500, 0.500] | 0.073 [0.032, 0.142] |
| bootstrap_logistic_ensemble | 0.041 [0.010, 0.073] | 0.142 [0.054, 0.224] | 0.994 [0.983, 1.000] | 0.070 [0.038, 0.134] |

GP minus majority class: log loss -0.203 [-0.358, -0.063], Brier -0.064 [-0.119, -0.011]: GP better (CI excludes 0).

Calibration (GP, pooled predictions; non-empty bins: count, mean predicted, observed frequency): [0.3,0.4) n=1 pred 0.39 obs 0.00; [0.4,0.5) n=10 pred 0.41 obs 0.00; [0.6,0.7) n=4 pred 0.65 obs 0.00; [0.7,0.8) n=19 pred 0.76 obs 1.00; [0.8,0.9) n=11 pred 0.89 obs 1.00; [0.9,1.0) n=100 pred 0.93 obs 1.00. Counts pool the 5 repeats, so they are 5 times the row counts.

Leave-one-campaign-out (GP vs majority log loss; n rows and not-sustained rows in the held-out campaign):

| held-out campaign | n | not sustained | GP Brier | GP log loss | GP AUC | majority log loss |
|---|---|---|---|---|---|---|
| BASS/2012 | 6 | 0 | 0.025 | 0.167 | n/a | 0.174 |
| BASS/2013 | 23 | 3 | 0.111 | 0.374 | 1.000 | 0.387 |

Sensitivity (GP, same CV, evaluated on each variant's own rows; delta = variant log loss minus primary, not like-for-like when the rows differ):

| variant | n rows | not sustained | Brier | log loss | AUC | delta log loss |
|---|---|---|---|---|---|---|
| add low-confidence rows | 64 | 8 | 0.078 | 0.269 | 0.874 | 0.109 |
| O2 initial value only | 29 | 3 | 0.036 | 0.160 | 1.000 | 0.000 |
| drop below_calibration_range rows | 29 | 3 | 0.036 | 0.160 | 1.000 | 0.000 |
| drop flow_off_transient rows | 26 | 0 | n/a | n/a | n/a | n/a |
| drop no_sustained_propagation rows | 29 | 3 | 0.036 | 0.160 | 1.000 | 0.000 |
| pressure length scale 0.15 (ln units) | 29 | 3 | 0.036 | 0.161 | 1.000 | 0.001 |
| pressure length scale 0.6 (ln units) | 29 | 3 | 0.036 | 0.160 | 1.000 | -0.000 |

Subgroups (GP out-of-fold):

| subgroup | n | not sustained | Brier | log loss |
|---|---|---|---|---|
| O2 < 17 % | 0 | 0 | n/a | n/a |
| O2 17-20 % | 19 | 3 | 0.047 | 0.184 |
| O2 > 20 % | 10 | 0 | 0.015 | 0.115 |
| airflow < 3 cm/s | 8 | 3 | 0.111 | 0.374 |
| airflow 3-10 cm/s | 13 | 0 | 0.004 | 0.060 |
| airflow > 10 cm/s | 8 | 0 | 0.013 | 0.108 |
| confidence high | 10 | 3 | 0.085 | 0.291 |
| confidence medium | 19 | 0 | 0.010 | 0.091 |

Blind-spot test: **supported**. Point level (n=29): Spearman rho=0.95 (one-sided p=<0.001) between pre-reveal epistemic uncertainty and log loss; AUROC for flagging 0 misclassified points = n/a. Experiment level (n=18 held-out experiments): rho=0.84 (p=<0.001). Withheld experiments with higher pre-reveal epistemic uncertainty tended to be predicted worse at both levels; this is an association in a small, imbalanced sample, not a guarantee. Caveat: aleatoric (predictive-entropy) uncertainty tracks log loss at least as strongly (rho=0.99), and the epistemic-loss association controlling for it is 0.69; so this does not show that epistemic uncertainty adds information beyond the model's overall predictive uncertainty. Controlling for aleatoric uncertainty, the point-level association is 0.69 (p=<0.001).

## Limitations of this validation

- Observations are ordered flow schedules; most "sustained" rows are sustained by list order and the final unrecorded setting is omitted, so the
  boundary is thinly observed.
- Flow values are mostly derived (borrowed calibration, linear extrapolation below the calibrated range); the "drop below_calibration_range rows"
  sensitivity rows show the dependence.
- O2 is partly confounded with campaign; leave-one-campaign-out folds are small (see n).
- Results describe the integrated records only. They say nothing about conditions covered by investigations that are not integrated (for example
  SoFIE-GEL, Saffire-V/VI): those conditions are not represented in the integrated records.
- Pressure is effectively constant; no pressure effect can be validated.
