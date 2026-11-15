# Blind Spots

Blind Spots maps where NASA microgravity solid-fuel combustion experiments have, and have not, established evidence; models flame
sustainment with calibrated uncertainty; and ranks **computational research candidates** by how much they would reduce uncertainty about a
chosen target cabin atmosphere. Built for the NASA Space Apps Challenge 2026 "Flame in Freefall". Not endorsed by NASA.

> This project is a data-analysis and research-planning tool. It is not a certified fire-safety assessment, makes no claim of NASA approval,
> and contains no combustion-test or apparatus procedures. Candidates are "computational research candidates requiring qualified scientific
> review, established safety procedures and formal feasibility assessment".

## Deployed app

URL: <to be added>

## AI-assistance disclosure

This project was built with substantial assistance from Claude (Anthropic), an AI coding assistant: code, data curation of free-text test-matrix cells (double transcription with automated provenance checks) and documentation drafts; all data are NASA PSI/NTRS records cited in the app.

## The problem

NASA has run many microgravity combustion investigations, and public results (NASA Physical Sciences Informatics, PSI) are hard to find, compare and
interpret. For a crew cabin atmosphere (for example an exploration atmosphere with raised O2 at reduced pressure), the practical question is:
*how much of that condition is actually covered by comparable experimental evidence, how sure is a model there, and which next computation or experiment
would teach us the most?*

## What the product does

- **Coverage map**: for one material and flame-configuration group ("analysis group"), shows where integrated experiments exist in oxygen /
  airflow (and oxygen / pressure) space and how far any point is from the nearest comparable observation.
- **Predictive model with uncertainty**: a Gaussian-process classifier (logit link, Laplace approximation) per group predicts the probability that a flame
  is sustained and splits uncertainty into epistemic (lack of data) and aleatoric (outcome variability). Where evidence is missing it answers
  "Insufficient experimental evidence for a reliable estimate." instead of a number.
- **Target-aware active learning**: given a documented NASA atmosphere profile (or a user-defined hypothetical), ranks candidate conditions by expected variance
  reduction (EVR) of the model's belief about the target, with random, uncertainty-sampling and nearest-gap baselines, a pressure-assumption sensitivity check and
  counterfactual "what if this came out sustained / not sustained" views.
- **Honest context**: NASA investigations that are *not* integrated (for example SoFIE-GEL, Saffire-V/VI) are listed alongside every target assessment as
  "not represented in the integrated records"; this is never phrased as "NASA has not studied this".
- **Experiment explorer**: every integrated test with the source cell behind each value.
- **Guided demo and defaults**: the default analysis group is data-driven (`is_default` on `/api/groups`, currently `{{DEFAULT_GROUP}}`) and the context layer is on by default; the built-in guided demo walks through coverage, target, gap, candidate and counterfactual in about a minute.

## Key differentiator

Most dashboards summarise what was measured. Blind Spots is organised around what was **not** measured relative to a stated target atmosphere, and it
quantifies that with (a) model-independent coverage distances, (b) a calibrated model that abstains outside its evidence, (c) an acquisition score tied to
the target rather than to generic uncertainty, and (d) a validation section that reports where the model is *not* better than a majority-class guess.

## Data sources

All model data come from public NASA records; nothing is synthetic outside unit tests.

{{INV_TABLE}}

- **BASS (PSI-26) and BASS-II (PSI-25)**: ISS Microgravity Science Glovebox solid-fuel flammability test matrices (CC0-1.0, NASA PSI). Free-text flow schedules and
  outcomes are interpreted in curation tables with cell-level provenance (two independent transcriptions per chunk, adjudicated); the pipeline verifies every quoted token against the original cell.
- **NASA/TM-20210011385 Appendix A evidence integration**: the BASS-II Summary Report (NTRS 20210011385) Appendix A is transcribed to `data/curation/evidence/bass2_tm_appendix_a.csv`
  and used to set outcome labels and flame-configuration labels where the matrices are silent or ambiguous. In this build {{TM_STEPS}} flow steps in {{TM_TESTS}} tests carry TM outcome evidence ({{TM_STEPS_TRAIN}} of those steps are in training), {{TM_NOTES}} experiments carry TM notes,
  and {{CFG_CHANGED}} flame-configuration labels changed relative to the previous build; conflicts with the ReadMe were resolved conservatively to `unknown`.
- **Context records (never used for modelling)**: {{N_CONTEXT_RECORDS}} transcribed context records ({{CONTEXT_BY_SOURCE}}) from NTRS reports: Saffire-IV, Saffire-V (NTRS 20210011521), Saffire-VI (NTRS 20240002981),
  the Glenn 5.18 s drop-tower flammability limits (NTRS 20080034883) and DARTFire (NTRS 20030111833); plus four large-scale Saffire-I (PSI-98) and Saffire-III (PSI-100) tests. They differ in apparatus or duration, so they are drawn on the map as context and are not training data.
  Also context: ground (normal-gravity) flammability thresholds and a catalogue of 16 NASA investigations that are not integrated. For example SoFIE-GEL (PMMA spheres) is catalogued only with its documented envelope (13 to 34 % O2, 15.2 to 111.5 kPa), because no public per-test table was found; it is listed with
  every target assessment as "not represented in the integrated records".
- **Target atmospheres**: {{N_PROFILES}} profiles with verbatim NASA quotes in `data/manifests/atmosphere_profiles.json`.

Full list, licences and caveats: [docs/data-sources.md](docs/data-sources.md). Current build: dataset `{{DV}}`
({{N_EXP}} experiments, {{N_OBS}} flow-step observations; {{N_TRAIN_EXP}} experiments and {{N_TRAIN_OBS}} observations used for training:
{{POS}} sustained / {{NEG}} not sustained, i.e. {{POS_PCT}} sustained).

## Scientific methodology (summary)

1. **Unit of observation**: one flow step of one test (flame sustained or not at a recorded airflow and O2). Steps of a test are correlated, so all validation is grouped by experiment.
2. **Analysis groups**: material family plus flame configuration (for example `pmma_rod__stagnation`). A group is modelled only with at least 6 training
   experiments, at least 3 sustained and 3 not-sustained rows and not-sustained rows in at least 2 experiments; otherwise only coverage is shown.
3. **Coordinates**: O2 percent, ln(1 + airflow cm/s), ln(pressure / 101.325 kPa). Every integrated observation is near 1 atm, so the GP pressure length scale is **fixed** at {{LP}}
   (ln units) and cannot be learned; anything at another pressure is assumption-driven, and a 0.15 / 0.3 / 0.6 sensitivity check is reported.
4. **Model**: GP classifier, ARD squared-exponential kernel, MAP-II hyperparameters (log-normal priors), {{MEAN_SHORT}}.
5. **Validation**: repeated grouped K-fold by experiment, leave-one-campaign-out, group-bootstrap CIs, majority-class and logistic baselines, calibration, sensitivity analyses
   and a "blind-spot test" of whether epistemic uncertainty predicts errors on withheld experiments.
6. **Acquisition**: expected variance reduction of the latent function over a target grid, greedy batch with rank-one updates, evaluated retrospectively against baselines.

Details: [docs/scientific-methodology.md](docs/scientific-methodology.md).

## Architecture

```
NASA Research Sources
        |
        v
Data Ingestion & Provenance        (PSI client, curation tables, token-level provenance checks)
        |
        v
Normalized Research Dataset        (experiments, observations, investigations, dataset_version hash)
        |
        v
Predictive Model                   (per-group GP classifier: predictions, uncertainty, validation)
        |
        v
Coverage Analysis                  (nearest-neighbour distance, convex-hull support, verdicts)
        |
        v
Target-Aware Active Learning       (expected variance reduction over a target atmosphere)
        |
        v
Candidate Research Ranking         (candidates, baselines, sensitivity, counterfactuals)
        |
        v
Blind Spots Interactive Interface  (Next.js web app; live FastAPI or static snapshot)
```

Components and data flow: [docs/architecture.md](docs/architecture.md).

## Installation

Requirements: Python 3.12 with [uv](https://docs.astral.sh/uv/), Node.js with npm (the lockfile is `apps/web/package-lock.json`).

```bash
# backend
cd services/analysis
uv sync
# macOS iCloud Desktop quirk only: if `import blindspots` fails after uv sync, run
#   chflags nohidden .venv/lib/python3.12/site-packages/*.pth
# (the flag can come back after any `uv run`, so the robust fix is `export PYTHONPATH=src` in this shell)

# web
cd ../../apps/web
npm ci
```

## How to run

Backend (from `services/analysis`). The repository already contains the generated artifacts (`data/normalized`, `{{MDIR}}`, `models/retrospective`), so the steps
marked "rebuild" are only needed after changing curation tables or code. Each is deterministic: rebuilding the committed inputs reproduces dataset `{{DV}}` and model
`{{MV}}` exactly.

```bash
uv run blindspots build-dataset     # rebuild: data/normalized/*  (about a second)
uv run blindspots train             # rebuild: models/<version>/ + validation.json  (about half a minute)
uv run blindspots retrospective     # rebuild: models/retrospective/<dataset_version>.json  (about ten seconds)
uv run blindspots export-artifacts --snapshot ../../apps/web/public/snapshot   # static snapshot for the web app  (about twenty seconds)

uv run blindspots serve             # API on http://127.0.0.1:8000  (health: /api/health)
# another port:
uv run uvicorn blindspots.api.app:create_app --factory --host 127.0.0.1 --port 8208
```

Web (from `apps/web`):

```bash
npm run dev                         # http://localhost:3000, proxies /api/* to the analysis service
# live backend on another port, separate build directory:
ANALYSIS_API_ORIGIN=http://127.0.0.1:8208 NEXT_DIST_DIR=.next-docs2 npm run dev -- --port 3309
# production build / static-snapshot mode (never calls the API):
NEXT_PUBLIC_DATA_MODE=snapshot npm run build && npm run start
```

`NEXT_PUBLIC_DATA_MODE` is `live` (API only), `snapshot` (precomputed JSON only) or `auto` (default: live first, snapshot when the backend is unavailable).
Raw NASA files are fetched on demand with `uv run blindspots fetch-raw` (requires network; large raw downloads are git-ignored).

## How to test

```bash
cd services/analysis
uv run pytest -q
uv run ruff check . && uv run ruff format --check .
uv run mypy src

cd ../../apps/web
npm run lint && npm run typecheck
node --test tests/unit/             # unit tests of the data layer
node scripts/check-snapshot-keys.mjs  # snapshot key round-trip
npm run test:e2e                    # Playwright, headless chromium only (first run: npx playwright install chromium)
```

Latest recorded run in this tree: {{TEST_STATUS}}

## Deployment notes

- **Frontend on Vercel with the static snapshot** (the Space Apps default): set `NEXT_PUBLIC_DATA_MODE=snapshot`; the app then serves the JSON written by `export-artifacts`
  (`apps/web/public/snapshot`, generated per deployment and git-ignored; it must be present in the upload, for example `.vercelignore` must not exclude it). Custom targets and arbitrary candidates need the live analysis service and show an honest
  "requires the live analysis service" state; a "Precomputed snapshot" badge is always visible.
- **Python service on any container host**: `uvicorn blindspots.api.app:create_app --factory` with the repository's `data/` and `models/` directories present
  (`BLINDSPOTS_ROOT` overrides root discovery); point the web app at it with `ANALYSIS_API_ORIGIN`.
- **Verified here**: the commands above on macOS (local runs; API on port 8208, web dev on 3309; a snapshot-mode production build served with `next start` gave the same guided-demo numbers as the live API); deterministic rebuild of dataset, model, retrospective and snapshot.
  **Not verified**: an actual Vercel deployment, container image build, or any other host; this repository ships no Dockerfile or Vercel project configuration.

## Validation results

Copied from `{{MDIR}}/validation.json` and `{{RETRO_PATH}}` (full tables, CIs, calibration, sensitivity and blind-spot results in [docs/validation.md](docs/validation.md)).

{{README_VALIDATION}}

## Known limitations

See [docs/limitations.md](docs/limitations.md). The most important ones:

- Strong class imbalance ({{POS_PCT}} of training rows are "sustained") and small samples ({{N_EXP_MIN}} to {{N_EXP_MAX}} experiments per modelled group); the GP is a statistically
  significant improvement over the majority-class baseline in {{N_GP_BETTER}} of {{N_MODELLED}} groups, and in {{N_FLOWOFF_IN_BETTER}} of those the gain is mostly "flow near zero means no flame".
- The sphere groups' discrimination comes largely from flow-turned-off steps (grouped-CV AUC before and after dropping them: {{FLOWOFF_AUC}}); many near-quench rod steps rely on the documented below-calibration flow interpolation (rows remaining without them: {{BELOWCAL_RELIANT}}).
- The GP clearly beats the majority-class baseline only in {{GP_BETTER_GROUPS}}; it is roughly at baseline in {{GP_INDIST_GROUPS}}. Every group uses a constant GP mean fixed a priori (no mean-function selection).
- All integrated data are at about 1 atm ({{P_MIN}} to {{P_MAX}} kPa); BASS-II pressure is an assumption and the pressure length scale is fixed. At low pressure predictions revert to the prior (for example about 0.6 at 34 % O2 and 56.5 kPa is reversion, not a pressure effect), so the interface shows no p(sustained) for insufficient-evidence targets.
- Many airflow values are derived from calibrations (not measured) and many "sustained" labels are implied by list order in the source matrices.
- Gaps are gaps in the integrated records, not in NASA's knowledge: SoFIE-GEL, Saffire-V/VI and others are not integrated.

## Future work

See [docs/future-work.md](docs/future-work.md). Nothing listed there is implemented.

## Documentation

[architecture](docs/architecture.md) | [data sources](docs/data-sources.md) | [scientific methodology](docs/scientific-methodology.md) | [validation](docs/validation.md) |
[evidence report](docs/evidence-report.md) | [limitations](docs/limitations.md) | [demo script](docs/demo-script.md) | [future work](docs/future-work.md) |
[decisions](docs/decisions.md) | [API](docs/API.md) | [contracts](docs/CONTRACTS.md)

## Licence and attribution

NASA PSI data (BASS, BASS-II, Saffire) are released by NASA under CC0-1.0; NTRS documents are cited with their NTRS identifiers. Source files are never modified; derived tables
are labelled as interpretations. Blind Spots is an independent project and is **not endorsed by NASA**; it uses no NASA logos or branding. No licence file for the project's own code is
present in this repository yet; add one before redistribution.
