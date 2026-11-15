# Lead: fixes after the independent numerical review (2026-11-15)

An independent reviewer re-derived the GP Laplace core (mode, predictive moments, cross-covariance, LML and
gradients: all match a dense brute force to ~1e-14), the greedy batch and the counterfactual refits. Changes made:

1. Coverage/envelope: a dimension counts as varying only if its observed spread is at least its coverage scale
   (s_o2 = 2, s_flow = 0.5, s_p = 0.1). BASS pressures (98-102 kPa) span ~0.04 ln units, so pressure is treated as
   degenerate and checked against the observed range padded by one scale. Before, sphere groups showed 0 % of the
   101.3 kPa slice "inside the hull" despite 23 comparable observations.
2. Mean function: constant mean for every group, fixed a priori. Selecting constant vs linear-in-O2 on the same CV
   folds that produce the reported metrics biased them (thin film: 0.333 reported vs 0.367 unbiased), and the
   linear mean extrapolated to p = 1.00 at 34 % O2 / 56.5 kPa.
3. EVR uses the outcome-averaged Laplace update factor F_c = Σ_y p_y / (Σ_cc + 1/W(f̂_y)) instead of the
   prior-averaged curvature, in single-point EVR, greedy downdates and (as an effective curvature) the
   retrospective block update. The old form was 8-19 % low against exact refits and could change the top pick.
4. Blind-spot test: "supported" now also requires the point-level partial Spearman correlation of epistemic
   uncertainty with log loss, controlling for aleatoric uncertainty, to be positive with p < 0.05 (otherwise the
   association could come from predictive entropy alone). Result: supported in the 3 sphere groups, inconclusive
   in 6.
5. Leave-one-experiment-out never fits hyperparameters on rows that include the held-out experiment (the
   over-budget fallback now uses a single optimizer start instead); fixed hyperparameters are no longer clipped
   into optimizer bounds; "n_converged" counts optimizer successes.

Caveats that the methodology must state: all integrated data lie at 98-102 kPa and the pressure length scale is
fixed (0.3), so at low pressure the kernel correlation with the data is ~0.15 and predictions revert to the
training base rate (e.g. pmma_rod__opposed p = 0.60 at 34 % O2 / 56.5 kPa and also at 34 % / 101 kPa versus 0.91
at 21 %: a reversion, not a pressure effect); blind spots are flagged by the latent standard-deviation ratio;
EVR measures logit-scale variance; much of the sphere groups' discrimination comes from flow-turned-off steps
(dropping them lowers AUC to 0.67-0.82); most rod near-quench steps rely on the documented below-calibration flow
interpolation.
