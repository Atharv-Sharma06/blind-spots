# lib-ml-core decisions (2026-11-15)

- GP mean parameters (b0, b1) are learned by MAP-II like other hyperparameters, with N(0,3^2)/N(0,1^2) priors; all hyperparameter priors are Gaussian in log space (log-normal), no Jacobian term, so the MAP is in log space.
- Analytic LML gradient derived for the non-zero mean (explicit a'dm plus implicit mode term); verified against finite differences. Sign of the third-derivative term follows dW/df = W(1-2pi).
- `GPLaplaceClassifier.default()` gives the project defaults (l=(3,1,0.3), l_p fixed, signal var 4); the bare constructor fixes nothing unless `fixed` is passed.
- Latent predictive variance clipped at 1e-12; Newton mode solved cold-start (deterministic) with backtracking line search; jitter 1e-8 on K.
- MajorityClass predicts Laplace-smoothed prevalence ((n1+1)/(n+2)); one-class training data in the logistic baselines degrade to the same constant.
- Training rows with a missing coordinate are dropped and counted (TrainingSet.n_dropped_missing_coords), never imputed.
- Ensemble epistemic uncertainty from logistic baselines is not expected to grow far from data (logistic members extrapolate confidently).
