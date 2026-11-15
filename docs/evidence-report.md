# Evidence report

What the data support, what the model learned from them, how well it performs against simple baselines, whether its uncertainty was useful, how the recommendation rule was evaluated, and what remains unsupported.
All numbers are copied from the artifacts by script (dataset `8783ff5aa6a2`, model `gp-laplace-v1+8783ff5a.adfbbd`, validation generated 2026-11-15T18:00:31+00:00); full tables are in [validation.md](validation.md). Plain reporting; no claim of experimental validation beyond the integrated records.

## 1. Which data were used and which were excluded

- 28 investigations are catalogued; the model uses PSI-25 (BASS-II) and PSI-26 (BASS). Context-only records (Saffire, DARTFire, drop tower) never enter a model (26 experiments across context investigations in this build).
- 276 experiments and 749 flow-step observations were integrated; 210 experiments and 566 observations were used for training (447 sustained, 119 not sustained: 79% sustained).
  Observation labels over all rows: label 1 (sustained) 587, label 0 (not sustained) 147, no label 15.
- Training observations by campaign: BASS-II/Fernandez-Pello 121, BASS-II/Olson 106, BASS/2012 99, BASS-II/Miller 93, BASS-II/Bhattacharjee 48, BASS-II/T'ien 47, BASS/2013 47, BASS-II/Ferkul 5.

Excluded observations (count by reason; 183 of 749):

| reason (observations) | count |
|---|---|
| low_confidence | 164 |
| not_ignited | 13 |
| no_numeric_airflow | 4 |
| n2_suppression | 2 |

Excluded experiments (count by reason; 66 of 276):

| reason (experiments) | count |
|---|---|
| context only: different apparatus or test duration | 22 |
| low_confidence | 19 |
| not_ignited | 12 |
| no_curated_flow_steps | 9 |
| different apparatus and scale: context only | 4 |

The largest exclusion is low curation confidence (164 observations); those rows are kept in the records and tested in a sensitivity analysis ("add low-confidence rows" in [validation.md](validation.md)).
Of the modelled groups, 9 met the modelability rule; 11 groups have coverage only (`nomex_fabric__concurrent`, `nomex_fabric__unknown`, `paraffin_slab__concurrent`, `paraffin_slab__unknown`, `pmma_slab__concurrent`, `pmma_slab__unknown`, `sibal_fabric__opposed`, `sibal_fabric__unknown`, `ultem_sheet__unknown`, `wax_candle__unknown`, `wax_candle__wake`).

Modelled groups (training rows):

| group | training experiments | training observations | sustained | not sustained | majority class | GP mean | campaigns |
|---|---|---|---|---|---|---|---|
| `pmma_rod__opposed` | 24 | 108 | 87 | 21 | 81% | constant | BASS-II/Fernandez-Pello |
| `pmma_slab__opposed` | 22 | 95 | 80 | 15 | 84% | constant | BASS-II/Miller, BASS/2013 |
| `pmma_rod__stagnation` | 15 | 67 | 51 | 16 | 76% | constant | BASS-II/Olson |
| `pmma_rod__unknown` | 12 | 52 | 46 | 6 | 88% | constant | BASS-II/Fernandez-Pello, BASS-II/Olson |
| `pmma_thin_film__opposed` | 16 | 48 | 37 | 11 | 77% | constant | BASS-II/Bhattacharjee |
| `pmma_sphere__wake` | 24 | 42 | 32 | 10 | 76% | constant | BASS/2012, BASS/2013 |
| `sibal_fabric__concurrent` | 25 | 42 | 29 | 13 | 69% | constant | BASS-II/T'ien |
| `pmma_sphere__stagnation` | 18 | 33 | 23 | 10 | 70% | constant | BASS-II/T'ien, BASS/2012, BASS/2013 |
| `pmma_sphere__unknown` | 18 | 29 | 26 | 3 | 90% | constant | BASS/2012, BASS/2013 |

## 2. What the data look like (and why that limits the claims)

- 79% of training rows are "sustained"; the majority-class baseline is therefore strong. Not-sustained modes: quench_low_flow 40, brief_flame_no_sustain 26, flow_turned_off 24, at_constant_flow 20, blowoff_high_flow 9.
- 24 not-sustained rows are flow-off transients (flow turned off, ~0 cm/s). In 3 groups at least 80% of the not-sustained rows are such transients: `pmma_sphere__wake` (9 of 10), `pmma_sphere__stagnation` (8 of 10), `pmma_sphere__unknown` (3 of 3).
- Operating conditions covered by the training rows: O2 13.5 to 22.7 %, airflow 0.00 to 53.3 cm/s, pressure 98.3 to 102.2 kPa (that is, about 1 atm; BASS-II pressure is an assumed value).
- 139 of 566 training rows have airflow below the calibrated range (linear extrapolation); 387 have interpolated O2.

## 3. What the model learned

Per-group GP classifiers. The table shows the learned length scales (how far O2 or flow must change before the latent function changes appreciably) and the predicted probability of a sustained flame at 1 atm at the 10th and 90th percentile
of each group's training O2 and flow.

| group | learned O2 length scale (%) | learned flow length scale (ln units) | training 10th to 90th percentile | P(sustained): low O2, low flow | high O2, low flow | low O2, high flow | high O2, high flow |
|---|---|---|---|---|---|---|---|
| `pmma_rod__opposed` | 2.86 | 0.99 | O2 16.7 to 20.4 %, flow 0.31 to 5.0 cm/s | 0.66 | 0.67 | 0.74 | 0.93 |
| `pmma_rod__stagnation` | 1.81 | 1.50 | O2 14.4 to 16.6 %, flow 0.33 to 12.6 cm/s | 0.69 | 0.83 | 0.27 | 0.87 |
| `pmma_rod__unknown` | 3.74 | 0.72 | O2 14.6 to 21.9 %, flow 0.36 to 9.8 cm/s | 0.75 | 0.85 | 0.85 | 0.92 |
| `pmma_slab__opposed` | 2.60 | 1.40 | O2 17.6 to 21.6 %, flow 2.71 to 17.7 cm/s | 0.75 | 0.89 | 0.74 | 0.80 |
| `pmma_sphere__stagnation` | 4.13 | 0.73 | O2 17.2 to 22.1 %, flow 0.00 to 10.1 cm/s | 0.20 | 0.13 | 0.71 | 0.94 |
| `pmma_sphere__unknown` | 3.82 | 0.73 | O2 17.1 to 22.6 %, flow 0.74 to 10.4 cm/s | 0.71 | 0.81 | 0.94 | 0.92 |
| `pmma_sphere__wake` | 2.67 | 0.86 | O2 21.1 to 22.3 %, flow 0.00 to 10.0 cm/s | 0.14 | 0.12 | 0.96 | 0.95 |
| `pmma_thin_film__opposed` | 2.73 | 0.82 | O2 17.3 to 21.0 %, flow 0.81 to 12.1 cm/s | 0.32 | 0.46 | 0.76 | 0.92 |
| `sibal_fabric__concurrent` | 1.52 | 1.22 | O2 16.9 to 20.7 %, flow 1.09 to 11.1 cm/s | 0.27 | 0.59 | 0.67 | 0.66 |

Qualitative reading of the table (commentary written for dataset `8783ff5aa6a2`; re-read it if the model is retrained):

- In most groups P(sustained) is highest at high O2 and high flow and lower in the low-flow corners (for example `pmma_thin_film__opposed` and `sibal_fabric__concurrent`).
- Visible exceptions: in `pmma_rod__stagnation` the low-O2, high-flow corner is the lowest (blow-off rows at high flow and brief-flame rows, all at low O2 in the training data); in `pmma_sphere__wake` and `pmma_sphere__stagnation` raising O2 at low flow does not raise P(sustained), because their not-sustained rows are mostly flow-off transients at ~0 cm/s, so the model has mostly learned "flow near zero means no flame", which is not a physical quench boundary.
- O2 effects are weakly identified where the training O2 range is narrow (see the percentile column) and O2 is partly confounded with campaign.
- Pressure was not learned: the pressure length scale is fixed at 0.3 ln units because every observation is at about 1 atm. Predictions at other pressures are assumption-driven.

## 4. Performance against baselines (grouped cross-validation, with CIs)

Grouped 5-fold by experiment x 5 repeats; log loss, lower is better; 95% group-bootstrap CIs (1000 draws). The majority-class baseline predicts the training prevalence everywhere.

| group | gp log loss | logistic_o2_flow log loss | logistic_o2 log loss | bootstrap_logistic_ensemble log loss | majority_class log loss |
|---|---|---|---|---|---|
| `pmma_rod__opposed` | 0.492 [0.393, 0.629] | 0.546 [0.394, 0.799] | 0.507 [0.415, 0.641] | 0.520 [0.387, 0.735] | 0.497 [0.410, 0.622] |
| `pmma_slab__opposed` | 0.445 [0.365, 0.555] | 0.438 [0.352, 0.562] | 0.434 [0.350, 0.558] | 0.438 [0.355, 0.557] | 0.439 [0.362, 0.549] |
| `pmma_rod__stagnation` | 0.486 [0.416, 0.576] | 0.483 [0.386, 0.609] | 0.488 [0.394, 0.595] | 0.477 [0.382, 0.590] | 0.565 [0.458, 0.749] |
| `pmma_rod__unknown` | 0.387 [0.271, 0.537] | 0.416 [0.253, 0.602] | 0.367 [0.240, 0.509] | 0.408 [0.253, 0.586] | 0.380 [0.259, 0.525] |
| `pmma_thin_film__opposed` | 0.366 [0.290, 0.459] | 0.491 [0.377, 0.636] | 0.524 [0.432, 0.633] | 0.471 [0.366, 0.607] | 0.547 [0.461, 0.648] |
| `pmma_sphere__wake` | 0.143 [0.083, 0.234] | 0.354 [0.100, 0.864] | 0.711 [0.459, 1.132] | 0.289 [0.099, 0.659] | 0.561 [0.450, 0.673] |
| `sibal_fabric__concurrent` | 0.613 [0.511, 0.731] | 0.732 [0.575, 0.931] | 0.682 [0.562, 0.860] | 0.704 [0.560, 0.886] | 0.649 [0.559, 0.765] |
| `pmma_sphere__stagnation` | 0.268 [0.132, 0.458] | 0.403 [0.148, 0.801] | 0.682 [0.595, 0.780] | 0.340 [0.141, 0.649] | 0.635 [0.560, 0.714] |
| `pmma_sphere__unknown` | 0.160 [0.101, 0.216] | 0.134 [0.051, 0.212] | 0.346 [0.126, 0.571] | 0.142 [0.054, 0.224] | 0.363 [0.157, 0.575] |

Paired comparison of the GP with the majority class (negative = GP better), plus Brier and AUC:

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

Reading:

- The GP beats the majority class on log loss with a CI that excludes 0 in 4 of 9 groups (`pmma_thin_film__opposed`, `pmma_sphere__wake`, `pmma_sphere__stagnation`, `pmma_sphere__unknown`); it is not distinguishable in 5 and worse in 0.
- Of the groups where the GP wins, 3 are groups whose not-sustained rows are mostly flow-off transients, where the gain mostly reflects "flow near zero means no flame". Removing those rows (sensitivity table in [validation.md](validation.md)) leaves one or no negatives in some groups, so the win cannot be re-evaluated there.
- Groups where the GP is not distinguishable from the majority class: `pmma_rod__opposed`, `pmma_slab__opposed`, `pmma_rod__stagnation`, `pmma_rod__unknown`, `sibal_fabric__concurrent`. With this much imbalance and this few experiments, the model's discrimination is modest and uncertain in those groups.
- Leave-one-campaign-out (11 held-out campaigns across groups with more than one campaign; the GP log loss is higher than the majority-class log loss in 2 of them) is a harder test because O2 is partly confounded with campaign; several folds have very few rows or not-sustained rows:

| group | held-out campaign | n | not sustained | GP log loss | majority log loss | which is lower |
|---|---|---|---|---|---|---|
| `pmma_slab__opposed` | BASS-II/Miller | 93 | 13 | 1.613 | 1.233 | GP worse |
| `pmma_slab__opposed` | BASS/2013 | 2 | 2 | 2.296 | 1.915 | GP worse |
| `pmma_rod__unknown` | BASS-II/Fernandez-Pello | 13 | 2 | 0.415 | 0.434 | GP better |
| `pmma_rod__unknown` | BASS-II/Olson | 39 | 4 | 0.348 | 0.365 | GP better |
| `pmma_sphere__wake` | BASS/2012 | 31 | 8 | 0.288 | 0.573 | GP better |
| `pmma_sphere__wake` | BASS/2013 | 11 | 2 | 0.247 | 0.497 | GP better |
| `pmma_sphere__stagnation` | BASS-II/T'ien | 5 | 2 | 0.614 | 0.696 | GP better |
| `pmma_sphere__stagnation` | BASS/2012 | 26 | 8 | 0.567 | 0.619 | GP better |
| `pmma_sphere__stagnation` | BASS/2013 | 2 | 0 | 0.256 | 0.405 | GP better |
| `pmma_sphere__unknown` | BASS/2012 | 6 | 0 | 0.167 | 0.174 | GP better |
| `pmma_sphere__unknown` | BASS/2013 | 23 | 3 | 0.374 | 0.387 | GP better |

## 5. Was the uncertainty useful? (blind-spot test)

The test asks whether the model's epistemic uncertainty, computed before an outcome is revealed, ranks where it makes larger errors on withheld experiments (point level on out-of-fold predictions, experiment level with leave-one-experiment-out refits).
Verdict rule: supported if rho > 0 with p < 0.05 at both levels; not supported if rho <= 0 at both; otherwise inconclusive.

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

Verdicts as computed: **3 supported, 6 inconclusive, 0 not supported** of 9 groups (supported: `pmma_sphere__wake`, `pmma_sphere__stagnation`, `pmma_sphere__unknown`; inconclusive: `pmma_rod__opposed`, `pmma_slab__opposed`, `pmma_rod__stagnation`, `pmma_rod__unknown`, `pmma_thin_film__opposed`, `sibal_fabric__concurrent`).

Caveats that matter: aleatoric uncertainty tracks loss at least as strongly as epistemic uncertainty in 8 of 9 groups; the partial correlation of epistemic uncertainty given aleatoric uncertainty is 0.08 to 0.80, so epistemic uncertainty has not been shown to add information beyond the model's overall predictive uncertainty.
Point-level p-values treat points as exchangeable and are optimistic; with 0 to 21 misclassified points per group the AUROC rests on very few events.
Conclusion: uncertainty is informative about error in the groups marked supported, in small imbalanced samples; it is not a guarantee, and in the other groups the evidence is inconclusive.

## 6. How the recommendation algorithm was evaluated

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


## 7. What remains unsupported

- **Any pressure other than about 1 atm.** Candidate and target conditions at reduced pressure (for example 56 to 70 kPa exploration atmospheres) are extrapolations that depend on the fixed pressure length scale 0.3; the sensitivity check does not validate them.
- **Elevated-O2 conditions** beyond the integrated O2 range (13.5 to 22.7 %) are not represented in the integrated records. Other NASA investigations (for example SoFIE-GEL with 13 to 34 % O2 and 0.15 to 1.1 atm, and Saffire-V/VI at reduced pressure and elevated O2) cover some of them but are not integrated, because no public per-test data were found or they are large-scale tests; the model says nothing about their outcomes.
- **Materials other than PMMA and SIBAL fabric** in microgravity: the other groups lack enough experiments and outcomes of both kinds to be modelled (`nomex_fabric__concurrent`, `nomex_fabric__unknown`, `paraffin_slab__concurrent`, `paraffin_slab__unknown`, `pmma_slab__concurrent`, `pmma_slab__unknown`, `sibal_fabric__opposed`, `sibal_fabric__unknown`, `ultem_sheet__unknown`, `wax_candle__unknown`, `wax_candle__wake`).
- **Physical quench boundaries**: many label-0 rows are transients or brief flames; the true flammability boundary is thinly observed.
- **Causal or mechanistic claims**: the model is a statistical interpolator of ordered flow-step outcomes, not a combustion model.
- **Retrospective advantage of the recommendation rule**: not established (see section 6).
- **Fire-safety certification, material qualification or any operational guidance**: out of scope; candidates are computational research candidates requiring qualified scientific review, established safety procedures and formal feasibility assessment.
