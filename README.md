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
- **Guided demo and defaults**: the default analysis group is data-driven (`is_default` on `/api/groups`, currently `pmma_thin_film__opposed`) and the context layer is on by default; the built-in guided demo walks through coverage, target, gap, candidate and counterfactual in about a minute.

## Key differentiator

Most dashboards summarise what was measured. Blind Spots is organised around what was **not** measured relative to a stated target atmosphere, and it
quantifies that with (a) model-independent coverage distances, (b) a calibrated model that abstains outside its evidence, (c) an acquisition score tied to
the target rather than to generic uncertainty, and (d) a validation section that reports where the model is *not* better than a majority-class guess.

## Data sources

All model data come from public NASA records; nothing is synthetic outside unit tests.

| id | name | role | experiments | flow-step observations | DOI |
|---|---|---|---|---|---|
| NTRS-20030111833 | DARTFire | integrated_context | 8 | 0 | n/a |
| NTRS-20080034883 | Glenn 5.18 s drop tower flammability limits | integrated_context | 6 | 0 | n/a |
| NTRS-20210011521 | Saffire-IV, Saffire-V | integrated_context | 5 | 0 | n/a |
| NTRS-20240002981 | Saffire-VI | integrated_context | 3 | 0 | n/a |
| PSI-25 | BASS-II | integrated_model | 129 | 431 | 10.60555/4qc4-de67 |
| PSI-26 | BASS | integrated_model | 121 | 318 | 10.60555/58h4-dy80 |
| PSI-98 | SAFFIRE-I | integrated_context | 2 | 0 | 10.60555/0t15-1z43 |
| PSI-99 | SAFFIRE-II | integrated_context | 0 | 0 | 10.60555/2chp-m469 |
| PSI-100 | SAFFIRE-III | integrated_context | 2 | 0 | 10.60555/040q-4h36 |

- **BASS (PSI-26) and BASS-II (PSI-25)**: ISS Microgravity Science Glovebox solid-fuel flammability test matrices (CC0-1.0, NASA PSI). Free-text flow schedules and
  outcomes are interpreted in curation tables with cell-level provenance (two independent transcriptions per chunk, adjudicated); the pipeline verifies every quoted token against the original cell.
- **NASA/TM-20210011385 Appendix A evidence integration**: the BASS-II Summary Report (NTRS 20210011385) Appendix A is transcribed to `data/curation/evidence/bass2_tm_appendix_a.csv`
  and used to set outcome labels and flame-configuration labels where the matrices are silent or ambiguous. In this build 209 flow steps in 105 tests carry TM outcome evidence (206 of those steps are in training), 126 experiments carry TM notes,
  and 21 flame-configuration labels changed relative to the previous build; conflicts with the ReadMe were resolved conservatively to `unknown`.
- **Context records (never used for modelling)**: 22 transcribed context records (NTRS-20030111833 (DARTFire): 8; NTRS-20080034883 (Glenn 5.18 s drop tower flammability limits): 6; NTRS-20210011521 (Saffire-IV): 2; NTRS-20210011521 (Saffire-V): 3; NTRS-20240002981 (Saffire-VI): 3) from NTRS reports: Saffire-IV, Saffire-V (NTRS 20210011521), Saffire-VI (NTRS 20240002981),
  the Glenn 5.18 s drop-tower flammability limits (NTRS 20080034883) and DARTFire (NTRS 20030111833); plus four large-scale Saffire-I (PSI-98) and Saffire-III (PSI-100) tests. They differ in apparatus or duration, so they are drawn on the map as context and are not training data.
  Also context: ground (normal-gravity) flammability thresholds and a catalogue of 16 NASA investigations that are not integrated. For example SoFIE-GEL (PMMA spheres) is catalogued only with its documented envelope (13 to 34 % O2, 15.2 to 111.5 kPa), because no public per-test table was found; it is listed with
  every target assessment as "not represented in the integrated records".
- **Target atmospheres**: 11 profiles with verbatim NASA quotes in `data/manifests/atmosphere_profiles.json`.

Full list, licences and caveats: [docs/data-sources.md](docs/data-sources.md). Current build: dataset `8783ff5aa6a2`
(276 experiments, 749 flow-step observations; 210 experiments and 566 observations used for training:
447 sustained / 119 not sustained, i.e. 79% sustained).

## Scientific methodology (summary)

1. **Unit of observation**: one flow step of one test (flame sustained or not at a recorded airflow and O2). Steps of a test are correlated, so all validation is grouped by experiment.
2. **Analysis groups**: material family plus flame configuration (for example `pmma_rod__stagnation`). A group is modelled only with at least 6 training
   experiments, at least 3 sustained and 3 not-sustained rows and not-sustained rows in at least 2 experiments; otherwise only coverage is shown.
3. **Coordinates**: O2 percent, ln(1 + airflow cm/s), ln(pressure / 101.325 kPa). Every integrated observation is near 1 atm, so the GP pressure length scale is **fixed** at 0.3
   (ln units) and cannot be learned; anything at another pressure is assumption-driven, and a 0.15 / 0.3 / 0.6 sensitivity check is reported.
4. **Model**: GP classifier, ARD squared-exponential kernel, MAP-II hyperparameters (log-normal priors), `constant` mean function (the only option in this model version's configuration).
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

Backend (from `services/analysis`). The repository already contains the generated artifacts (`data/normalized`, `models/gp-laplace-v1+8783ff5a.adfbbd`, `models/retrospective`), so the steps
marked "rebuild" are only needed after changing curation tables or code. Each is deterministic: rebuilding the committed inputs reproduces dataset `8783ff5aa6a2` and model
`gp-laplace-v1+8783ff5a.adfbbd` exactly.

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

Latest recorded run in this tree: backend `uv run pytest -q`: 241 passed; `uv run mypy src` clean (66 source files); `uv run ruff check .` and `uv run ruff format --check .` were clean on the files this documentation covers but flagged line-length/format issues in `src/blindspots/pipeline/export_artifacts.py`, which was still being edited when this was written, so re-run them before release. Web: `npm run typecheck` clean; `npm run lint` 0 errors (1 unused-variable warning in `tests/e2e/methodology-brief.spec.ts`); `node --test tests/unit/` 14 passed; `node scripts/check-snapshot-keys.mjs` reports a few experiment ids that contain a space (for example `PSI-98:SAFFIRE-I S2`) as not round-tripping and no missing files; `NEXT_PUBLIC_DATA_MODE=snapshot npm run build` succeeds and its `next start` output was driven headlessly (guided demo, methodology, experiments) with numbers equal to the live API; the Playwright e2e suite was not run for this documentation (it uses fixed ports 8205/3305/3306).

## Deployment notes

- **Frontend on Vercel with the static snapshot** (the Space Apps default): set `NEXT_PUBLIC_DATA_MODE=snapshot`; the app then serves the JSON written by `export-artifacts`
  (`apps/web/public/snapshot`, generated per deployment and git-ignored; it must be present in the upload, for example `.vercelignore` must not exclude it). Custom targets and arbitrary candidates need the live analysis service and show an honest
  "requires the live analysis service" state; a "Precomputed snapshot" badge is always visible.
- **Python service on any container host**: `uvicorn blindspots.api.app:create_app --factory` with the repository's `data/` and `models/` directories present
  (`BLINDSPOTS_ROOT` overrides root discovery); point the web app at it with `ANALYSIS_API_ORIGIN`.
- **Verified here**: the commands above on macOS (local runs; API on port 8208, web dev on 3309; a snapshot-mode production build served with `next start` gave the same guided-demo numbers as the live API); deterministic rebuild of dataset, model, retrospective and snapshot.
  **Not verified**: an actual Vercel deployment, container image build, or any other host; this repository ships no Dockerfile or Vercel project configuration.

## Validation results

Copied from `models/gp-laplace-v1+8783ff5a.adfbbd/validation.json` and `models/retrospective/8783ff5aa6a2.json` (full tables, CIs, calibration, sensitivity and blind-spot results in [docs/validation.md](docs/validation.md)).

Grouped 5-fold cross-validation by experiment x 5 repeats; log loss, lower is better; CI from a group bootstrap (1000 draws).

| group | experiments | sust./not sust. | GP log loss | majority log loss | GP minus majority [95% CI] | log loss vs majority | blind-spot test |
|---|---|---|---|---|---|---|---|
| `pmma_rod__opposed` | 24 | 87/21 | 0.492 | 0.497 | -0.005 [-0.041, 0.033] | not distinguishable (CI includes 0) | inconclusive |
| `pmma_slab__opposed` | 22 | 80/15 | 0.445 | 0.439 | 0.006 [-0.021, 0.033] | not distinguishable (CI includes 0) | inconclusive |
| `pmma_rod__stagnation` | 15 | 51/16 | 0.486 | 0.565 | -0.079 [-0.219, 0.018] | not distinguishable (CI includes 0) | inconclusive |
| `pmma_rod__unknown` | 12 | 46/6 | 0.387 | 0.380 | 0.007 [-0.033, 0.048] | not distinguishable (CI includes 0) | inconclusive |
| `pmma_thin_film__opposed` | 16 | 37/11 | 0.366 | 0.547 | -0.180 [-0.234, -0.128] | GP better (CI excludes 0) | inconclusive |
| `pmma_sphere__wake` | 24 | 32/10 | 0.143 | 0.561 | -0.418 [-0.531, -0.296] | GP better (CI excludes 0) | supported |
| `sibal_fabric__concurrent` | 25 | 29/13 | 0.613 | 0.649 | -0.036 [-0.113, 0.032] | not distinguishable (CI includes 0) | inconclusive |
| `pmma_sphere__stagnation` | 18 | 23/10 | 0.268 | 0.635 | -0.367 [-0.504, -0.203] | GP better (CI excludes 0) | supported |
| `pmma_sphere__unknown` | 18 | 26/3 | 0.160 | 0.363 | -0.203 [-0.358, -0.063] | GP better (CI excludes 0) | supported |

- GP better than the majority-class baseline (CI excludes 0): 4 of 9 groups; not distinguishable: 5; worse: 0.
- Blind-spot test (does pre-reveal epistemic uncertainty track errors on withheld experiments?): 3 supported, 6 inconclusive, 0 not supported. The partial correlation of epistemic uncertainty given aleatoric uncertainty ranges 0.08 to 0.80, so this is not proof of added information.
- Retrospective acquisition test (18 pseudo-target scenarios, 20 seeds): EVR vs random better/indistinguishable/worse = 10/3/5; vs uncertainty sampling 9/4/5; vs nearest gap 9/2/7. No reliable advantage is claimed.

## Known limitations

See [docs/limitations.md](docs/limitations.md). The most important ones:

- Strong class imbalance (79% of training rows are "sustained") and small samples (12 to 25 experiments per modelled group); the GP is a statistically
  significant improvement over the majority-class baseline in 4 of 9 groups, and in 3 of those the gain is mostly "flow near zero means no flame".
- The sphere groups' discrimination comes largely from flow-turned-off steps (grouped-CV AUC before and after dropping them: `pmma_sphere__wake` 0.99 to 0.82; `pmma_sphere__stagnation` 0.96 to 0.67; `pmma_sphere__unknown` has no other negatives (CV AUC 1.00 with them; not evaluable without)); many near-quench rod steps rely on the documented below-calibration flow interpolation (rows remaining without them: `pmma_rod__opposed` (36 of 108 training rows and 4 of 21 negatives remain); `pmma_rod__stagnation` (33 of 67 training rows and 11 of 16 negatives remain); `pmma_rod__unknown` (35 of 52 training rows and 1 of 6 negatives remain); `pmma_thin_film__opposed` (37 of 48 training rows and 3 of 11 negatives remain)).
- The GP clearly beats the majority-class baseline only in `pmma_thin_film__opposed`, `pmma_sphere__wake`, `pmma_sphere__stagnation`, `pmma_sphere__unknown`; it is roughly at baseline in `pmma_rod__opposed`, `pmma_slab__opposed`, `pmma_rod__stagnation`, `pmma_rod__unknown`, `sibal_fabric__concurrent`. Every group uses a constant GP mean fixed a priori (no mean-function selection).
- All integrated data are at about 1 atm (98.3 to 102.2 kPa); BASS-II pressure is an assumption and the pressure length scale is fixed. At low pressure predictions revert to the prior (for example about 0.6 at 34 % O2 and 56.5 kPa is reversion, not a pressure effect), so the interface shows no p(sustained) for insufficient-evidence targets.
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
