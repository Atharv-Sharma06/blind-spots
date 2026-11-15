# Blind Spots

**Blind Spots: where NASA's microgravity fire evidence ends, and what to learn next.**

NASA's next crew cabins are planned at 8.2 psia and 34 % O2. All {{ENV_N_EXP}} integrated ISS flame tests (BASS, BASS-II)
ran at about 1 atm. Blind Spots measures that gap: {{H_ISS_COMPARABLE}} comparable observations for the ISS cabin,
{{H_EXPL_COMPARABLE}} for the Exploration Atmosphere in every material group. There, a Gaussian-process model answers
"Insufficient experimental evidence for a reliable estimate." and active learning ranks what would teach the most.
Built for NASA Space Apps Challenge 2026, "Flame in Freefall"; not endorsed by NASA.

**Try it:** [live app]({{DEPLOYED_URL}}) (press **Guided demo**) · [30-second video]({{VIDEO_URL}}) · [source code]({{GITHUB_URL}})

![Coverage map, oxygen against pressure: every integrated ISS flame observation sits at about 1 atm, far from a reduced-pressure cabin target](submission/stills/02-target-gap.png)

## The 60-second pitch

- **The question.** Future exploration cabins are planned at lower pressure and higher oxygen than the ISS (NASA's
  Exploration Atmosphere: 8.2 psia / 34 % O2). {{LUNAR_SENTENCE}} How much of NASA's microgravity flame evidence
  actually covers that air?
- **What we built.** We turned {{ENV_N_EXP}} ISS flame tests (BASS and BASS-II, NASA PSI) into {{ENV_N_OBS}} flow-step
  observations in which every value links to its NASA source cell. For a chosen cabin atmosphere, Blind Spots shows the
  comparable evidence, what an uncertainty-aware model predicts, where it refuses to guess, and which computation would
  reduce its uncertainty about that atmosphere the most.
- **The finding.** All integrated ISS records lie at {{ENV_O2}} % O2 and {{ENV_P}} kPa. The ISS cabin has
  {{H_ISS_COMPARABLE}} comparable observations, in {{H_ISS_GROUPS_WITH}} of the {{H_N_GROUPS}} material and flame-configuration groups; the NASA
  Exploration Atmosphere has {{H_EXPL_COMPARABLE}}, in every group (nearest {{H_EXPL_NN_MIN}} to {{H_EXPL_NN_MAX}}
  reference distances). So the app answers "Insufficient experimental evidence for a reliable estimate." instead of
  printing a probability.
- **What is different.** Most dashboards show what was tested. Blind Spots shows where the integrated evidence stops for the
  air a crew will breathe, keeps "lack of data" apart from "outcome variability", withholds estimates outside its
  evidence, and ranks the next research question by expected information about that target, next to random,
  uncertainty-sampling and nearest-gap baselines.

## Headline finding

Computed by `docs/_gen/build.py` from `POST /api/target/assess` for every analysis group (the same responses the static
snapshot serves), dataset `{{DV}}`, model `{{MV}}`:

{{H_PROFILE_TABLE}}

- {{H_N_ZERO}} of the {{H_N_PROFILES_ANALYSED}} documented NASA atmospheres analysed have no comparable integrated observation
  in any group, including all {{H_N_REDUCED}} below 1 atm ({{H_REDUCED_SHORT}}).
- Default view (thin PMMA films, opposed flow, the API's default group): {{DX_PTS_WITH}} of {{DX_NPTS}} Exploration
  Atmosphere target points have a comparable observation; the nearest is {{DX_NN}} reference distances away.
- Top-ranked computational research candidate for that target: {{TC_O2}} % O2, {{TC_P}} kPa, {{TC_U}} cm/s, expected
  reduction of the target's model uncertainty {{TC_EVR}} (the baselines' picks, scored with the same model: random
  {{TB_RANDOM}}, uncertainty sampling {{TB_UNC}}, nearest gap {{TB_GAP}}). {{DEMO_TOP_SENTENCE}}

## What it does not claim

- It is a research-planning tool, not a fire-safety assessment or a certification, and it contains no test or apparatus
  procedures. Candidates are "computational research candidates requiring qualified scientific review, established safety
  procedures and formal feasibility assessment".
- A gap means "not represented in the integrated records", never "NASA has not studied this". Documented NASA and partner
  work that is not integrated (for example SoFIE-GEL, Saffire-V/VI, the Glenn drop-tower exploration-atmosphere tests) is
  listed beside every assessment.
- The model is uncertainty-aware; its calibration is reported, not forced. It beats a majority-class
  guess with a 95 % CI that excludes 0 in {{N_GP_BETTER}} of {{N_MODELLED}} modelled groups, and the app shows where it does not.
- Predictions away from 1 atm rest on an assumption (the model's correlation depends only on distance, "stationarity"),
  because every integrated observation is near 1 atm. No NASA approval or endorsement is claimed.

## AI-assistance disclosure

Blind Spots was built with extensive use of Claude (Anthropic) as an AI coding, transcription, review and writing
assistant:
- code (Python analysis service, FastAPI API, Next.js app, tests);
- the curation tables that turn free-text BASS/BASS-II matrix cells into values: two independent AI transcriptions per
  chunk, adjudicated, with every quoted token machine-checked as an exact substring of the cited NASA cell
  ({{N_PROVENANCE_FAIL}} provenance failures in this build); see [data/curation/README.md](data/curation/README.md);
- transcription of tables from NASA reports (BASS-II Summary Report Appendix A, DARTFire, the Glenn drop-tower limits,
  Saffire-IV/V/VI, ground flammability thresholds), each row carrying its page and table reference;
- extraction of the verbatim NASA quotes behind the {{N_PROFILES}} atmosphere profiles, machine-checked against the
  downloaded documents;
- research summaries, code and science reviews, this documentation, and the scripted headless capture of the demo video
  and screenshots (recordings of the real app; no AI-generated images, video or audio).

Decisions and their rationale are logged in [docs/decisions.md](docs/decisions.md). The app itself uses no generative
AI: predictions come from a Gaussian-process classifier, rankings from expected-variance-reduction active learning, and
every explanation it shows is a deterministic template filled with computed numbers
(`services/analysis/src/blindspots/uncertainty/explanations.py`).

## The problem

NASA has run many microgravity combustion investigations, and public results (NASA Physical Sciences Informatics, PSI) are hard to find, compare and
interpret. For a crew cabin atmosphere (for example an exploration atmosphere with raised O2 at reduced pressure), the practical question is:
*how much of that condition is actually covered by comparable experimental evidence, how sure is a model there, and which next computation or experiment
would teach us the most?*

## What the product does

- **Coverage map**: for one material and flame-configuration group ("analysis group"), shows where integrated experiments exist in oxygen /
  airflow (and oxygen / pressure) space and how far any point is from the nearest comparable observation.
- **Predictive model with uncertainty (the machine learning)**: a Gaussian-process classifier (logit link, Laplace approximation) per group predicts the probability that a flame
  is sustained and splits uncertainty into epistemic (lack of data) and aleatoric (outcome variability). Where evidence is missing it answers
  "Insufficient experimental evidence for a reliable estimate." instead of a number.
- **Target-aware active learning**: given a documented NASA atmosphere profile (or a user-defined hypothetical), ranks candidate conditions by expected variance
  reduction (EVR) of the model's belief about the target, with random, uncertainty-sampling and nearest-gap baselines, a pressure-assumption sensitivity check and
  counterfactual "what if this came out sustained / not sustained" views.
- **Honest context**: NASA investigations that are *not* integrated (for example SoFIE-GEL, Saffire-V/VI) are listed alongside every target assessment as
  "not represented in the integrated records"; this is never phrased as "NASA has not studied this".
- **Experiment explorer**: every integrated test with the source cell behind each value.
- **Guided demo and defaults**: the default analysis group is data-driven (`is_default` on `/api/groups`, currently {{DG_LABEL}}, id `{{DEFAULT_GROUP}}`) and the context layer is on by default; the built-in guided demo walks through coverage, target, gap, candidate and counterfactual in about a minute.

## Key differentiator

Most dashboards summarise what was measured. Blind Spots is organised around what is **not** represented in the integrated records relative to a stated
target atmosphere, and it quantifies that with (a) model-independent coverage distances, (b) a model that reports out-of-fold calibration and withholds its
estimate where comparable evidence is missing, (c) an acquisition score tied to the target rather than to generic uncertainty, and (d) a validation section
that reports where the model is *not* better than a majority-class guess.

## Data sources

All model data come from public NASA records; nothing is synthetic outside unit tests.

{{INV_TABLE}}

- **BASS (PSI-26) and BASS-II (PSI-25)**: ISS Microgravity Science Glovebox solid-fuel flammability test matrices (CC0-1.0, NASA PSI). Free-text flow schedules and
  outcomes are interpreted in curation tables with cell-level provenance (two independent transcriptions per chunk, adjudicated); the pipeline verifies every quoted token against the original cell.
- **NASA/TM-20210011385 Appendix A evidence integration**: the BASS-II Summary Report (NTRS 20210011385) Appendix A is transcribed to `data/curation/evidence/bass2_tm_appendix_a.csv`
  and used to set outcome labels and flame-configuration labels where the matrices are silent or ambiguous. In this build {{TM_STEPS}} flow steps in {{TM_TESTS}} tests carry TM outcome evidence ({{TM_STEPS_TRAIN}} of those steps are in training), {{TM_NOTES}} experiments carry TM notes,
  and conflicts with the ReadMe were resolved conservatively to `unknown`.
- **Context records (never used for modelling)**: {{N_CONTEXT_RECORDS}} transcribed context records ({{CONTEXT_BY_SOURCE}}) from NTRS reports: Saffire-IV, Saffire-V (NTRS 20210011521), Saffire-VI (NTRS 20240002981),
  the Glenn 5.18 s drop-tower flammability limits (NTRS 20080034883) and DARTFire (NTRS 20030111833); plus four large-scale Saffire-I (PSI-98) and Saffire-III (PSI-100) tests. They differ in apparatus or duration, so they are drawn on the map as context and are not training data.
  Also context: ground (normal-gravity) flammability thresholds and a catalogue of {{N_NOT_INTEGRATED}} further documented investigations (NASA and partner) that are not integrated. For example SoFIE-GEL (PMMA spheres) is catalogued only with its documented envelope (13 to 34 % O2, 15.2 to 111.5 kPa), because no public per-test table was found; it is listed with
  every target assessment as "not represented in the integrated records".
- **Target atmospheres**: {{N_PROFILES}} profiles with verbatim NASA quotes in `data/manifests/atmosphere_profiles.json`.
- **Counts, named by source**: {{N_PSI_SURVEYED}} PSI combustion records surveyed (`data/manifests/psi_investigations.json`); {{N_NOT_INTEGRATED}} further documented
  investigations catalogued as not integrated (`data/manifests/known_investigations_not_integrated.json`); {{N_INV_RECORDS}} investigation records in the normalized dataset.
- **Airflow provenance**: {{FLOW_PROVENANCE}}

Full list, licences and caveats: [docs/data-sources.md](docs/data-sources.md). Current build: dataset `{{DV}}`
({{N_EXP}} experiments, {{N_OBS}} flow-step observations; {{N_TRAIN_EXP}} experiments and {{N_TRAIN_OBS}} observations used for training:
{{POS}} sustained / {{NEG}} not sustained, i.e. {{POS_PCT}} sustained).

## Scientific methodology (summary)

1. **Unit of observation**: one flow step of one test (flame sustained or not at a recorded airflow and O2). Steps of a test are correlated, so all validation is grouped by experiment.
2. **Analysis groups**: material family plus flame configuration (for example PMMA rods in axial stagnation flow, id `pmma_rod__stagnation`). A group is modelled only with at least 6 training
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

Requirements: Python 3.12 with [uv](https://docs.astral.sh/uv/), Node.js with npm (lockfile `apps/web/package-lock.json`).

```bash
cd services/analysis && uv sync          # backend
cd ../../apps/web && npm ci              # web
```

## How to run

The repository contains the generated dataset and model (`data/normalized`, `{{MDIR}}`, `models/retrospective`). The
static snapshot the public site serves is generated, not committed, so export it before any snapshot-mode run.

```bash
# 1. analysis API (live mode), from services/analysis
uv run blindspots serve                  # http://127.0.0.1:8000  (health: /api/health)

# 2. web app against the live API, from apps/web
npm run dev                              # http://localhost:3000, proxies /api/* to the analysis service

# 3. static-snapshot mode (what the public deployment serves): export the snapshot first
cd services/analysis && uv run blindspots export-artifacts --snapshot ../../apps/web/public/snapshot
cd ../../apps/web && NEXT_PUBLIC_DATA_MODE=snapshot npm run build && npm run start
```

`NEXT_PUBLIC_DATA_MODE` is `live` (API only), `snapshot` (precomputed JSON only) or `auto` (default: live first, snapshot
when the API is unavailable). Rebuild steps, only needed after changing curation tables or code; each is deterministic:

```bash
uv run blindspots build-dataset          # data/normalized/*
uv run blindspots train                  # models/<version>/ + validation.json
uv run blindspots retrospective          # models/retrospective/<dataset_version>.json
uv run blindspots fetch-raw              # optional: large raw NASA files (network; git-ignored)
```

Regenerate every number in this README, `docs/*.md` and `submission/*.md` after a rebuild or retrain (one command; the
three links come from `docs/_gen/links.json`; `--check` reports stale files):

```bash
cd services/analysis && PYTHONPATH=src uv run python ../../docs/_gen/build.py --install
```

## How to test

```bash
cd services/analysis
uv run pytest -q
uv run ruff check . && uv run ruff format --check . && uv run mypy src

cd ../../apps/web
npm run lint && npm run typecheck
node --test tests/unit/                  # data-layer unit tests
node scripts/check-snapshot-keys.mjs     # snapshot key round-trip (needs an exported snapshot)
npm run test:e2e                         # Playwright, headless Chromium (first run: npx playwright install chromium)
```

## Deployment notes

- **Public site: Vercel, static snapshot.** Export the snapshot (step 3 above), then deploy with the Vercel CLI from
  `apps/web` (`npx vercel deploy --prod --archive=tgz`). `apps/web/vercel.json` sets `NEXT_PUBLIC_DATA_MODE=snapshot` and
  `apps/web/.vercelignore` makes the CLI upload the git-ignored snapshot. A Git-integrated Vercel build has no snapshot,
  because it is git-ignored. Custom targets and arbitrary candidates need the live API and say so in the interface.
- **Python API on a container host** (optional): `uvicorn blindspots.api.app:create_app --factory` with the repository's
  `data/` and `models/` present (`BLINDSPOTS_ROOT` overrides root discovery); point the web app at it with
  `ANALYSIS_API_ORIGIN`. Not verified: a container image build.
- macOS iCloud Desktop only: if `import blindspots` fails after `uv sync`, run
  `chflags nohidden .venv/lib/python3.12/site-packages/*.pth` or `export PYTHONPATH=src`.

## Validation results

Copied from `{{MDIR}}/validation.json` and `{{RETRO_PATH}}` (full tables, CIs, calibration, sensitivity and blind-spot results in [docs/validation.md](docs/validation.md)).

{{README_VALIDATION}}

## Known limitations

See [docs/limitations.md](docs/limitations.md). The most important ones:

- Strong class imbalance ({{POS_PCT}} of training rows are "sustained") and small samples ({{N_EXP_MIN}} to {{N_EXP_MAX}} experiments per modelled group); the GP is a statistically
  significant improvement over the majority-class baseline in {{N_GP_BETTER}} of {{N_MODELLED}} groups, and in {{N_FLOWOFF_IN_BETTER}} of those the gain is mostly "flow near zero means no flame".
- The sphere groups' discrimination comes largely from flow-turned-off steps (grouped-CV AUC before and after dropping them: {{FLOWOFF_AUC}}); many near-quench rod steps rely on the documented below-calibration flow extrapolation (rows remaining without them: {{BELOWCAL_RELIANT}}).
- The GP clearly beats the majority-class baseline only in {{GP_BETTER_GROUPS}}; it is roughly at baseline in {{GP_INDIST_GROUPS}}. Every group uses a constant GP mean fixed a priori (no mean-function selection).
- All integrated data are at about 1 atm ({{P_MIN}} to {{P_MAX}} kPa); BASS-II pressure is an assumption and the pressure length scale is fixed. At low pressure predictions revert to the prior (for example about 0.6 at 34 % O2 and 56.5 kPa is reversion, not a pressure effect), so the interface shows no p(sustained) for insufficient-evidence targets.
- Airflow provenance: {{FLOW_PROVENANCE}} Many "sustained" labels are implied by list order in the source matrices.
- Gaps are gaps in the integrated records, not in NASA's knowledge: SoFIE-GEL, Saffire-V/VI and others are not integrated.

## Future work

See [docs/future-work.md](docs/future-work.md). Nothing listed there is implemented.

## Documentation

[architecture](docs/architecture.md) | [data sources](docs/data-sources.md) | [scientific methodology](docs/scientific-methodology.md) | [validation](docs/validation.md) |
[evidence report](docs/evidence-report.md) | [limitations](docs/limitations.md) | [demo script](docs/demo-script.md) | [future work](docs/future-work.md) |
[decisions](docs/decisions.md) | [API](docs/API.md) | [contracts](docs/CONTRACTS.md)

## Licence and attribution

NASA PSI data (BASS, BASS-II, Saffire) are released by NASA under CC0-1.0; NTRS documents are cited with their NTRS
identifiers. Source files are never modified; derived tables are labelled as interpretations. Blind Spots is an
independent project and is **not endorsed by NASA**; it uses no NASA logos or branding. {{LICENSE_LINE}}
