# docs decisions (2026-11-15)

- Documentation numbers (validation.md, evidence-report.md, and every count or metric in README.md, data-sources.md, scientific-methodology.md, limitations.md, architecture.md, demo-script.md) are produced by a script from the
  generated artifacts (`data/normalized/*`, `models/<LATEST>/{manifest,validation}.json`, `models/retrospective/<dataset_version>.json`, snapshot manifest) instead of being typed by hand. The generator and its templates live in `docs/_gen/`
  so the docs can be regenerated after the lead's final dataset rebuild and retrain (command in `docs/_gen/build.py`). Hand-written commentary that depends on specific groups (the "Qualitative reading" block in evidence-report.md and the demo narration)
  is marked with the dataset version it was written for and must be re-read after a retrain.
- The lead's task notes describe an earlier dataset (e55c2c98d9f8: 254 experiments, 684 observations, 481 training rows, 6 modelled groups). The artifacts at the time of writing are dataset 8783ff5aa6a2 (276 experiments, 749 observations,
  566 training rows, 9 modelled groups, after the TM-20210011385 Appendix A evidence and context records were integrated). The docs follow the artifacts.
- `docs/validation-draft.md` (generated from an older dataset, da32b5c9ca7c) was superseded by `docs/validation.md` and deleted in the docs-refresh pass.
- Verification of commands: build-dataset, train, retrospective and export-artifacts were run against a scratch copy of the inputs (BLINDSPOTS_ROOT) so the repository artifacts were not overwritten; the rebuilt dataset, model and retrospective JSON matched the
  committed ones exactly (ignoring timestamps and runtimes). The API (uvicorn, port 8107) and the web app (Next dev, port 3207, `NEXT_DIST_DIR=.next-docs`) were started, exercised headlessly and stopped. `npm ci` was deliberately not run in the shared tree because it would delete `node_modules`.
- The excluded planned-test-matrix workbook is described without naming the file (CONTRACTS section 0, rule 7).
- Deployment claims are limited to what was run: no Vercel deployment, container build or Dockerfile exists, and the docs say so.
- Docs refresh (2026-11-15): every number in README.md and docs/*.md is generated from the artifacts by `docs/_gen/build.py` (templates in `docs/_gen/templates`); the default group is now read with the same rule as `/api/groups` `is_default`
  (`pmma_thin_film__opposed` at dataset 8783ff5aa6a2), the guided-demo numbers in `docs/_gen/extra.json` were re-read from the running app, and computed caveat fragments were added (flow-off AUC before/after, below-calibration reliance, groups where the GP beats the majority class,
  pressure reversion, constant mean). README gained the Appendix A / context-record descriptions, a "<to be added>" deployed-URL placeholder and the AI-assistance disclosure. Snapshot size is no longer stated in the docs (it changes per deployment).
  The statement that the GP beats the majority-class baseline for stagnation rods is NOT made: the paired CI for `pmma_rod__stagnation` includes 0.
