# acquisition-retrospective

- Design: per modelled group with >= 12 training experiments, held-out pseudo-targets (lowest mean-O2 quartile,
  lowest minimum-airflow quartile unless >50% overlap, largest campaign when >= 2 campaigns). Pool needs >= 6
  experiments. Seeds 0..19; initial = 3 pool experiments with both labels (<= 50 redraws; scenarios with no valid seed
  are skipped and listed). Up to 10 rounds picking one whole experiment. Metric: log loss and Brier on held-out
  target observations; the output also reports a constant (initial prevalence) baseline for context.
- EVR for an experiment = uniform-weight joint block variance reduction of the target latent values from observing all
  its points (W from current predictions). Baselines: uncertainty_sampling (mean epistemic MI), nearest_gap
  (centroid distance among experiments whose mean nn distance to training > 1, fallback closest), random.
- Hyperparameters: MAP-II on the current training set only, 3 restarts initially, then warm-started single-restart
  refits (l_p fixed 0.3). Chosen for runtime (whole run ~5 s with 20 seeds, 8 workers); targets never enter fitting.
- Curve CIs: normal approximation mean +/- 1.96 se over seeds. Paired differences use per-seed area under the log-loss
  curve (trapezoid over n_acquired), percentile bootstrap (2000) over seeds. Seeds vary initial sets only, so CIs
  understate uncertainty about the world; scenarios in one group are not independent.
- Output: models/retrospective/<dataset_version>.json (API.md acquisition_retrospective plus paired_differences,
  brier curves, diagnostics, design/limitations).
- Caveat: unit tests for src/blindspots/cli.py fail in this sandbox with a pydantic import error unrelated to this task.
