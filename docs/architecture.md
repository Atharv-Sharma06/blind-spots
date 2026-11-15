# Architecture

Blind Spots is a Python analysis service plus a Next.js web app, connected by one JSON API. Everything shown to a user is computed from the integrated NASA records by
deterministic code; there is no language model at runtime (explanations are template sentences over computed numbers). Exact HTTP shapes: [API.md](API.md).
Build contracts and integrity rules: [CONTRACTS.md](CONTRACTS.md).

## Flow

```
NASA Research Sources
        |   (NASA PSI web service, NTRS documents, atmosphere standards)
        v
Data Ingestion & Provenance
        |   (raw files never modified; curation tables with cell-level provenance; checker + pipeline verify every quoted token)
        v
Normalized Research Dataset
        |   (investigations / experiments / observations; dataset_version = sha256 prefix of the normalized content)
        v
Predictive Model
        |   (per-group GP classifier: predictions, epistemic/aleatoric uncertainty, grouped validation, blind-spot test)
        v
Coverage Analysis
        |   (standardized nearest-neighbour distance, comparable counts, convex-hull support, supported / extrapolation / insufficient_evidence)
        v
Target-Aware Active Learning
        |   (expected variance reduction of the model's belief over a target atmosphere region)
        v
Candidate Research Ranking
        |   (ranked candidates + random / uncertainty / nearest-gap baselines, pressure-assumption sensitivity, counterfactuals, documented context)
        v
Blind Spots Interactive Interface
        (Next.js; live FastAPI or a precomputed static snapshot)
```

## Repository layout

| path | role |
|---|---|
| `data/raw/psi/<PSI-ID>/` | original NASA files (never modified) with `inv_<ID>.json` metadata snapshots; large downloads under `large/` are git-ignored |
| `data/curation/` | interpretation tables (tests, steps with `raw_token`, `raw_column`, `token_row`, optional TM Appendix A evidence columns), context tables, ground-flammability tables, audit logs |
| `data/manifests/` | PSI catalogue, raw file manifest, `atmosphere_profiles.json`, `known_investigations_not_integrated.json` |
| `data/normalized/` | generated dataset (`.parquet`, `.csv`, `.json`), `dataset_report.json`, `VERSION` |
| `models/<model_version>/` | per-group model files, `manifest.json` (hashes, config), `validation.json`; `models/LATEST` points at the current one; `models/retrospective/<dataset_version>.json` |
| `services/analysis/src/blindspots/` | Python package (below) |
| `apps/web/` | Next.js app; `public/snapshot/` holds the static snapshot |
| `docs/` | this documentation, `decisions.md` (log), `decisions.d/` (per-task decision sources), `research/` (source notes) |

## Backend modules (`services/analysis/src/blindspots`)

| module | responsibility |
|---|---|
| `ingestion/` | PSI client (presigned S3 via the PSI web service), BASS and BASS-II matrices, Saffire context tables, atmosphere profiles, context-record readers |
| `processing/` | unit conversion, fan/pot flow calibration, label rule, provenance verification, duplicate flags, validation and export |
| `pipeline/` | CLI entry points: `build_dataset`, `train`, `retrospective`, `export_artifacts`, `fetch_raw`, `raw_manifest` |
| `models/` | `groups.py` (analysis groups, modelability rule), `features.py` (coordinates), `gp_laplace.py` (GP classifier, Laplace approximation, MAP-II), `baselines.py`, `registry.py` (artifact registry) |
| `uncertainty/` | epistemic / aleatoric decomposition (Gauss-Hermite), deterministic reason codes and verdict sentences |
| `coverage/` | nearest-neighbour distance, comparable counts, convex-hull support, coverage grids |
| `acquisition/` | target regions, candidate grid and demonstrated envelope, expected variance reduction, greedy batch, baselines, counterfactuals |
| `evaluation/` | metrics (Brier, log loss, AUC, ECE), grouped CV, group bootstrap, validation report, blind-spot test, retrospective acquisition evaluation |
| `api/` | FastAPI app (`routes_data.py`, `routes_model.py`, `services/` for targets, modelling, context, assess, ranking, brief), error envelope |

Command line: `uv run blindspots {build-dataset,raw-manifest,fetch-raw,train,retrospective,export-artifacts,serve}`.

## Data flow in detail

1. **Acquisition** (`fetch-raw`): PSI files are retrieved through the PSI web service. The public `s3://nasa-psi` bucket does not hold them, and the `remote_url` host in PSI metadata does not resolve (D-002).
   The planned-test-matrix workbook that contains legacy credentials is never requested or stored (D-003).
2. **Curation**: free-text flow schedules and outcomes of BASS / BASS-II are interpreted into `data/curation/tests` and `steps` CSVs by independent transcriptions that are adjudicated; each step cites the
   exact source token. For BASS-II, outcomes are cross-checked against NASA/TM-20210011385 Appendix A (`data/curation/evidence`).
3. **Normalization** (`build-dataset`): re-reads the original workbooks, verifies every token against its cell, converts flows with the documented calibration, applies the label rule and training filter,
   flags quality issues and writes the dataset plus `dataset_report.json`. Current build: dataset `4fe55f76142a`, 276 experiments, 749 observations, 0 provenance failures, 0 curation problems.
4. **Training** (`train`): per analysis group, fits the GP, uses the configured mean function (constant), runs the validation suite and the blind-spot test, and writes `models/<model_version>/`. Current model: `gp-laplace-v1+4fe55f76.adfbbd`.
   The model version is a hash of data and configuration, so identical inputs give identical artifacts (checked: a rebuild into a scratch root reproduced the committed dataset, model and retrospective JSON exactly, ignoring timestamps).
5. **Serving** (`serve`): FastAPI loads the dataset and the model registry. Responses are memoised by endpoint, canonical request and dataset/model versions and are deterministic (the random baseline is seeded by a hash of the request).
   Without artifacts, data endpoints return 503 `artifact_missing` and health reports `degraded`.
6. **Snapshot** (`export-artifacts`): writes the JSON of every GET endpoint, coverage/surface grids for every group x plane x snapshot slice, and target/assess, candidates/rank, counterfactual and brief
   for every documented profile x group, plus `manifest.json`. The snapshot is generated per deployment (git-ignored); the build this documentation describes uses dataset `4fe55f76142a` and model `gp-laplace-v1+4fe55f76.adfbbd`.
7. **Web**: `lib/api.ts` is a typed client with three data modes (`live`, `snapshot`, `auto`). Browser code calls relative `/api/*` paths; Next rewrites them to `ANALYSIS_API_ORIGIN`, so there is no CORS and one origin to configure.
   In snapshot mode the interface states plainly what needs the live service.

## HTTP API (summary)

Read: `GET /api/health, investigations, groups, experiments, experiments/{id}, observations, export/experiments.csv, targets, context, sources, methodology, coverage, surface, model/metadata, model/validation`.
Compute: `POST /api/predict, target/assess, candidates/rank, candidates/compare, candidates/counterfactual, brief`. Scientific limits are never HTTP errors: they return 200 with `verdict`
`supported | extrapolation | insufficient_evidence` and reason codes. Errors use one envelope (`validation_error` 422, `not_found` 404, `artifact_missing` 503, `ingestion_failure` 500, `internal` 500).

## Integrity controls built into the architecture

- Measurement fields keep missing values as `null`; assumptions live in separately named fields (`pressure_assumed_kpa`) with a quality flag.
- Synthetic data exist only in tests (`synthetic_*` / `fixture_*`); app code never imports them.
- Training inclusion is decided by a documented filter; excluded rows stay in the records with a reason.
- Context and not-integrated investigations are exposed through `/api/context` and are never joined to training data.
- Candidates always carry a feasibility status that is never a feasibility claim, and every brief contains the mandated disclaimer and no operational instructions (enforced by a phrase denylist in tests).
