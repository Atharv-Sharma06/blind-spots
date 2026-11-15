# Space Apps 2026 project page: Blind Spots

Draft for copy/paste into the project-page fields (field names per `docs/research/space-apps-challenge.md` section 2).
Every number below is copied from a repository artifact; the source file is named in brackets. Items in `<angle brackets>` are placeholders to fill in before submitting.
Build the numbers refer to: dataset `8783ff5aa6a2`, model `gp-laplace-v1+8783ff5a.adfbbd`, retrospective `models/retrospective/8783ff5aa6a2.json`.
If the lead retrains or regenerates the snapshot, re-check the numbers marked (V) against `models/gp-laplace-v1+8783ff5a.adfbbd/validation.json`.

---

## Project Name

Blind Spots

---

## High-Level Project Summary (limit 150 words)

Blind Spots is a web dashboard that shows where NASA's microgravity solid-fuel combustion experiments have, and have not, established evidence for a chosen spacecraft or habitat atmosphere. We integrated 250 ISS BASS and BASS-II tests (210 experiments, 566 flow-step observations used for modelling) with cell-level provenance. A Gaussian-process classifier predicts whether a flame is sustained, separates uncertainty into lack of data versus outcome variability, and says "Insufficient experimental evidence" where comparable data are missing. Expected-variance-reduction ranking then suggests computational research candidates that would teach us most about the target atmosphere. For Flame in Freefall, it summarizes, ranks and interprets investigations and exposes the gaps that matter for exploration cabins. It reports where the model is no better than a majority-class guess. It is a research-planning tool, not a certified fire-safety assessment, and not endorsed by NASA.

(136 words.)

---

## Link to Project Demo

<video URL>

Backup: the 7-slide deck outlined in `submission/slides-outline.md` (slide limit including title: 7).

---

## Link to Final Project

- Deployed app: <deployed URL>
- Source code: <GitHub URL>

---

## Detailed Project Description

### The problem

NASA has run many combustion investigations in microgravity, but the public results (NASA Physical Sciences Informatics, PSI) are hard to find, compare and interpret. For a crew cabin atmosphere (for example the exploration atmosphere of 8.2 psia / 34 % O2), the practical questions are: how much of that condition is covered by comparable experimental evidence, how sure is a model there, and which next computation or experiment would reduce that uncertainty most? Most dashboards summarise what was measured. Blind Spots is organised around what was not measured relative to a stated target atmosphere.

### What it does

1. **Experiment explorer.** Every integrated test is listed with the source file, sheet, row and the exact quoted source token behind each value, with assumptions flagged rather than hidden (for example BASS-II records no pressure, so the nominal ISS cabin pressure is stored in a separate, flagged "assumed" field).
2. **Coverage map.** For one material and flame-configuration group, it shows where integrated experiments exist in oxygen / airflow and oxygen / pressure space, and how far any point is from the nearest comparable observation. Documented tests that are not integrated into the model (Saffire-I, -III, -IV, -V, -VI, DARTFire, the Glenn 5.18 s drop-tower limits) are drawn as a separate "context" layer.
3. **Predictive model with honest uncertainty.** A Gaussian-process classifier (logit link, Laplace approximation, ARD squared-exponential kernel) per group predicts the probability that a flame is sustained and splits uncertainty into epistemic (lack of data) and aleatoric (outcome variability). Where comparable evidence is missing the app answers "Insufficient experimental evidence for a reliable estimate." and is designed not to present a probability as a meaningful estimate.
4. **Target-aware active learning.** Given one of 10 documented NASA atmosphere profiles (each with verbatim NASA quotes, machine-checked against the downloaded documents) or a user-defined hypothetical, it ranks candidate conditions by expected variance reduction (EVR) of the model's belief about the target, next to random, uncertainty-sampling and nearest-gap baselines, a pressure-assumption sensitivity check and counterfactual "what if this were sustained / not sustained" views. Candidates are labelled "computational research candidates requiring qualified scientific review, established safety procedures and formal feasibility assessment". The app contains no test or apparatus procedures.
5. **Research brief and guided demo.** A printable research brief and a guided tour of the coverage-to-candidate story.

### How it works (pipeline)

NASA records -> curation with provenance -> normalised dataset -> GP model with validation -> coverage analysis -> target-aware active learning -> interface.

- **Data.** NASA PSI BASS-II (PSI-25) and BASS (PSI-26) ISS Microgravity Science Glovebox test matrices (CC0-1.0). Free-text flow schedules and outcomes were interpreted into curation tables (`data/curation/`); the build re-reads the original NASA workbooks and rejects any quoted token that is not an exact substring of the cited cell (0 provenance failures in this build) [`data/normalized/dataset_report.json`]. BASS-II outcomes are cross-checked against the NASA BASS-II Summary Report (NASA/TM-20210011385), Appendix A: 126 transcribed rows, each verified against its PDF column [`docs/data-sources.md`].
- **Dataset.** 276 experiments and 749 flow-step observations; 210 experiments and 566 observations are training-eligible (447 sustained, 119 not sustained: 79 % sustained). 250 experiments are BASS/BASS-II (129 + 121); the other 26 are context records (22 transcribed from NASA reports plus 4 Saffire-I/III tests) that are never used for modelling [`docs/data-sources.md`, `data/normalized/dataset_report.json`]. Excluded rows stay in the records with their reason (for example low confidence, not ignited).
- **Model.** Nine analysis groups (material family + flame configuration) meet the modelling rule (at least 6 training experiments, 3 sustained and 3 not-sustained rows, not-sustained rows in at least 2 experiments); 11 others are shown for coverage only. Hyperparameters are fitted by MAP-II; the GP mean is constant, fixed a priori for every group. Validation is repeated grouped K-fold by experiment (5 x 5), leave-one-campaign-out, group-bootstrap 95 % CIs, majority-class and logistic baselines, calibration, sensitivity analyses and a "blind-spot test" [`models/gp-laplace-v1+8783ff5a.adfbbd/validation.json`].
- **Coverage.** Model-independent distances in (O2 %, ln(1 + airflow), ln pressure) with documented reference scales; a point with fewer than 3 comparable observations within one reference distance is a coverage gap.
- **Active learning.** EVR(c) = sum_t w_t Sigma(t,c)^2 F_c, with the outcome-averaged Laplace update factor F_c = sum_y p_y / (Sigma(c,c) + 1/W(f_y)); greedy batch selection; evaluated retrospectively against baselines [`docs/CONTRACTS.md` section 6, `docs/decisions.d/lead-review-fixes.md`].
- **Interface.** Next.js app that runs against the live FastAPI service or a precomputed static snapshot (a "Precomputed snapshot" badge is always visible; custom targets need the live service).

### What the evidence shows (and does not)

We report the weaknesses of our own model, because over-claiming is the main risk in this domain. All figures from `validation.json` and `models/retrospective/8783ff5aa6a2.json`.

- **A concrete blind spot.** For the NASA exploration atmosphere (34 % O2, 56.537 kPa) and the default group (thin PMMA films, opposed flow; 16 experiments, 48 training observations), 0 of 9 sampled target points have a comparable integrated observation; the nearest is 8.3 reference distances away; the verdict is "insufficient evidence" [precomputed target assessment in `apps/web/public/snapshot/manifest.json` entry `POST /api/target/assess` for `pmma_thin_film__opposed` x `exploration_atmosphere_8p2_34`] (V).
- **Reading the model's number at low pressure.** Every integrated observation lies at about 1 atm (98.3 to 102.2 kPa; BASS measured, BASS-II assumed) and the GP pressure length scale is fixed at 0.3 (ln units) because it cannot be learned. At low pressure the predictions simply revert to the training base rate (for example p about 0.6 at 34 % O2 / 56.5 kPa is reversion, not a pressure effect). For "insufficient evidence" targets that number is not a finding.
- **Does the GP beat a majority-class guess?** Grouped cross-validated log loss, GP minus majority class, 95 % group-bootstrap CI: clearly better (CI excludes 0) in 4 of 9 groups: thin PMMA films (-0.180 [-0.234, -0.128]) and the three sphere groups (wake -0.418, stagnation -0.367, unknown -0.203). In the other 5 (opposed rods, opposed slabs, stagnation rods, configuration-unknown rods, SIBAL fabric) it is not distinguishable from the baseline; stagnation rods have a favourable point estimate (-0.079) with a CI [-0.219, 0.018] that includes 0. It is never worse in this build (V).
- **Sphere groups are easy for a partly trivial reason.** Most of their not-sustained rows are steps where the flow was turned off (9 of 10 in sphere-wake, 8 of 10 in sphere-stagnation, 3 of 3 in sphere-unknown). Dropping those rows lowers the cross-validated AUC from 0.96 to 0.67 (sphere stagnation) and from 0.99 to 0.82 (sphere wake); sphere-unknown has no other negatives. Their discrimination is therefore largely "flow near zero means no flame", not a learned flammability boundary (V).
- **Interpolated flow.** Many near-quench rod steps depend on the documented extrapolation of the fan calibration below its calibrated range; for example opposed PMMA rods keep only 36 of 108 training rows when those steps are removed (V).
- **Blind-spot test.** Does pre-reveal epistemic uncertainty track errors on withheld experiments? With a strict rule that also requires a significant partial correlation given aleatoric uncertainty: supported in the 3 sphere groups, inconclusive in the other 6 (V).
- **Retrospective test of the EVR ranking.** In 18 pseudo-target scenarios (20 seeds), EVR beat random selection in 10, was indistinguishable in 3 and worse in 5; against uncertainty sampling: 9 better, 4 indistinguishable, 5 worse. We present this as modest small-sample evidence, not proof of a reliable advantage.

### Benefits

- Lets a researcher, systems engineer or student see at a glance which cabin conditions are backed by comparable, traceable NASA records, and which are not.
- Turns that gap into a ranked, explainable list of computational research questions, with the assumptions behind each rank (pressure length-scale sensitivity, feasibility "not verified") shown.
- Makes the data reusable: normalised CSV/JSON/Parquet exports, `dataset_version` hash, deterministic rebuilds of dataset, model, retrospective test and snapshot.
- Honest by design: "not represented in the integrated records" instead of "NASA has not studied this"; documented non-integrated NASA and partner work is listed beside every assessment; the validation page reports where the model is not better than a guess.

### Tools and languages

Python 3.12 (FastAPI, Uvicorn, Pydantic, NumPy, SciPy, pandas, scikit-learn, PyArrow, openpyxl, httpx, python-docx, Typer; pytest, Ruff, mypy for checks); the Gaussian-process classifier, Laplace approximation and EVR are implemented directly in NumPy/SciPy (scikit-learn is used for the logistic-regression baselines only). TypeScript, Next.js, React, Tailwind CSS, Radix UI, TanStack Query, Zustand and D3 modules (d3-array, d3-contour, d3-scale, d3-shape, d3-zoom and others) for the interface; Playwright and axe-core for headless accessibility and end-to-end tests. Full list with licences under References.

### What we hope to achieve

A reusable, auditable template for turning heterogeneous experimental records into an evidence-gap map: first as a literature- and data-triage tool for combustion scientists working on exploration atmospheres (reduced pressure, elevated oxygen), then, if qualified reviewers find it useful, as a way to prioritise which computations or experiments to request next. The next steps we would take (none implemented): integrate more of the catalogued investigations (for example Saffire-V/VI and SoFIE-GEL, which have no public machine-readable per-test table yet), add partial-gravity data once available, and validate the model prospectively against new results.

### Limitations (stated in the app and in `docs/limitations.md`)

Small samples (12 to 25 experiments per modelled group) and strong class imbalance (79 % of training rows sustained); gaps are gaps in the integrated records, not in NASA's knowledge; pressure behaviour is assumption-driven; some airflow values are calibration-derived and many "sustained" labels are implied by list order in the source matrices; microgravity only (no partial-gravity data); not a certified fire-safety assessment; not endorsed by NASA.

---

## Use of Super Intelligence (SI)

**How SI/AI was used to build the project (disclosure).** Blind Spots was built with substantial help from Claude (Anthropic), an AI coding assistant. Claude was used for:
- writing and testing the code (Python analysis service, FastAPI API, Next.js web app, tests);
- transcribing free-text cells of the BASS and BASS-II test matrices into structured curation tables: each chunk of the matrices was transcribed twice independently by AI, the two transcriptions were adjudicated, and an automated check against the original NASA workbooks verifies that every quoted token is an exact substring of the cited source cell (0 provenance failures in the final build). Outcome labels for BASS-II were additionally cross-checked against the NASA BASS-II Summary Report, Appendix A;
- research summaries (catalogue of PSI investigations, atmosphere-profile sources, other microgravity evidence, Space Apps rules) and drafts of the documentation, including this text. Quotes from NASA documents were machine-checked against the downloaded documents.
AI output was reviewed through automated tests, provenance checks, and independent AI reviews of the numerical core (the Gaussian-process core was re-derived against a dense brute-force implementation). <TEAM TO CONFIRM, and add human review if true: the idea of the project, the problem framing, the scientific choices and the final review were made by the team members; AI was used to accelerate implementation, not to devise the solution idea.>

**The SI inside the app is classical machine learning, not generative AI.** The app's predictions come from Gaussian-process classification (Laplace approximation) with calibrated uncertainty, and its recommendations from expected-variance-reduction active learning. The explanations shown to users ("reason codes", verdicts, candidate descriptions) are deterministic template sentences filled with computed numbers (no LLM call anywhere in the app or API). No generative AI produces any output a user sees.

**Images and media.** No AI-generated images, video or audio are used. The interface uses no NASA logos or branding.

**Data and code acknowledgement.** AI-assisted code and data interpretations are acknowledged here and in the repository documentation (`docs/decisions.md`, `docs/decisions.d/`); the curation tables carry the raw source token for each interpreted value.

---

## NASA Data

NASA data are the core of the project; all model data come from public NASA records, and nothing is synthetic outside unit tests.

**NASA Physical Sciences Informatics (PSI) investigations used** (landing pages `https://psi.nasa.gov/physci/repo/data/investigations/<PSI-ID>`; all CC0-1.0 per PSI metadata) [`data/manifests/psi_investigations.json`, `docs/data-sources.md`]:

| ID | Investigation | DOI | Role in Blind Spots |
|---|---|---|---|
| PSI-25 | Burning and Suppression of Solids - II (BASS-II) | https://doi.org/10.60555/4qc4-de67 | model data (129 experiments, 431 flow-step observations) |
| PSI-26 | Burning and Suppression of Solids (BASS) | https://doi.org/10.60555/58h4-dy80 | model data (121 experiments, 318 observations) |
| PSI-98 | Spacecraft Fire Safety Experiment-I (SAFFIRE-I) | https://doi.org/10.60555/0t15-1z43 | context only (2 tests) |
| PSI-100 | Spacecraft Fire Experiment-III (SAFFIRE-III) | https://doi.org/10.60555/040q-4h36 | context only (2 tests) |
| PSI-99 | Spacecraft Fire Experiment-II (SAFFIRE-II) | https://doi.org/10.60555/2chp-m469 | catalogued; no experiments integrated |

PSI landing pages: https://psi.nasa.gov/physci/repo/data/investigations/PSI-25, .../PSI-26, .../PSI-98, .../PSI-99, .../PSI-100. The PSI catalogue of Combustion Science investigations (24 records) was surveyed to decide what to integrate; 19 are catalogued but not integrated and no data from them are used [`docs/research/psi-catalog.md`]. The PSI fan-calibration workbook for BASS-II supplies the airflow conversion.

**NASA Technical Reports Server (NTRS) documents used** (https://ntrs.nasa.gov/citations/<id>):
- 20210011385: Burning and Suppression of Solids-II (BASS-II) Summary Report, NASA/TM-20210011385 (2021): outcome cross-check (Appendix A) and publication points.
- 20030111833: Sounding Rocket Microgravity Experiments Elucidating Diffusive and Radiative Transport Effects on Flame Spread over Thermally-Thick Solids (DARTFire), Table 1: context records.
- 20080034883: Microgravity Flame Spread in Exploration Atmospheres: Pressure, Oxygen, and Velocity Effects on Opposed and Concurrent Flame Spread (NASA/TM-2008-215260): context records.
- 20210011521: Fire Safety Implications of Preliminary Results from Saffire IV and V Experiments on Large Scale Spacecraft Fires (ICES-2021-266): context records.
- 20240002981: Preliminary Results from the Saffire VI Experiment (ICES-2024-365): context records.
- Ground (normal-gravity) flammability thresholds, shown as context and never joined to microgravity data: 20070005041 (Pressure Effects on Oxygen Concentration Flammability Thresholds of Materials for Aerospace Applications), 20070018178 (Oxygen Concentration Flammability Thresholds of Selected Aerospace Materials Considered for the Constellation Program), 20100015582 (Pressure Flammability Thresholds of Selected Aerospace Materials), 20160001047 (Oxygen Partial Pressure and Oxygen Concentration Flammability: Can They Be Correlated?, JSC-CN-34845).
- Publication cross-check points (reference only, not training data): 20160000593, 20150008961, 20140011099, 20150019858 and others listed in `data/curation/publication_points.csv`.

**Atmosphere-profile sources** (11 profiles in `data/manifests/atmosphere_profiles.json`, with verbatim quotes and page references):
- NASA-STD-3001, Volume 2, Revision F: Human Factors, Habitability, and Environmental Health, https://standards.nasa.gov/system/files/tmp/NASA-STD-3001%20Vol%202%20Rev%20F.pdf
- NASA-STD-3001 Technical Brief: Habitable Atmosphere (OCHMO-TB-003 Rev A), https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-003-habitable-atmosphere.pdf
- NTRS 20130013505, Effects of the 8 psia / 32 % O2 Atmosphere on the Human in the Spaceflight Environment (NASA/TM-2013-217377)
- NTRS 20140000417, Fifteen-minute Extravehicular Activity Prebreathe Protocol Using NASA's Exploration Atmosphere (8.2 psia / 34 % O2) (JSC-CN-29019)
- NTRS 20150021491, Evidence Report: Risk of Hypobaric Hypoxia from the Exploration Atmosphere (JSC-CN-34806)
- NTRS 20150010425, Report on ISS O2 Production, Gas Supply and Partial Pressure Management (ICES-2015-146 / JSC-CN-33571)
- NTRS 20250003954, Enhancing Future Commercial Space Stations: Applying ISS Insights to ECLSS Development on Emergency Response (ICES-2025-126)
- NTRS 20070021378, Risk Assessment of Physiological Effects of Atmospheric Composition and Pressure in Constellation Vehicles
- NTRS 20090012334, Pressure Effects on the Self-Extinguishment Limits of Aerospace Materials (JSC-17943; 09ICES-0267)
- NTRS 20220011152, Open Atmospheres Forum: Exploration Atmospheres Validation Study
- NTRS 19720012252, Apollo Experience Report: Command and Service Module Environmental Control System (NASA TN D-6718)
- NTRS 20070018178 and 20160001047 (listed above).

NASA web resources from the challenge page that framed the work: PSI Data Repository (Combustion Science) https://psi.nasa.gov/physci/repo/search?q=combustion ; A Researcher's Guide to International Space Station Combustion Science https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/ [`docs/research/space-apps-challenge.md`].

---

## Space Agency Partner Data and Other References

**Space agency partner data.** None integrated. No JAXA, ESA, CSA, DLR or other partner dataset is used in any model, map or number in the app. For transparency, `data/manifests/known_investigations_not_integrated.json` catalogues partner work that exists but is not integrated, each with the reason (for example JAXA FLARE on the Kibo Solid Combustion Experiment Module, and the ZARM drop-tower FLARE-G I tests: no machine-readable per-test data were located). These are shown only as "documented work not integrated" notes beside target assessments.

**Open-source software (direct dependencies; licences as read from the installed packages; the full transitive lists are in `services/analysis/uv.lock` and `apps/web/package-lock.json`).**

Python (`services/analysis/pyproject.toml`, versions from `uv.lock`):
FastAPI 0.163.1 (MIT); Uvicorn 0.54.0 (BSD-3-Clause); Pydantic 2.14.3 (MIT); pandas 3.1.1 (BSD-3-Clause); NumPy 2.5.4 (BSD-3-Clause and others, see package metadata); SciPy 1.18.1 (BSD); scikit-learn 1.9.1 (BSD-3-Clause); PyArrow 26.0.1 (Apache-2.0); openpyxl 3.1.5 (MIT); httpx 0.28.1 (BSD-3-Clause); python-docx 1.2.0 (MIT); Typer 0.29.1 (MIT). Development: pytest 9.2.0 (MIT); Ruff 0.17.5 (MIT); mypy 2.4.1 (MIT); pandas-stubs 3.1.0.261029 (BSD-3-Clause). Build: hatchling.

Web (`apps/web/package.json`, versions as installed):
Next.js 16.4.6 (MIT); React 19.3.1 and React DOM 19.3.1 (MIT); TypeScript 5.9.3 (Apache-2.0); Tailwind CSS 4.3.5 and @tailwindcss/postcss (MIT); PostCSS 8.5.33 (MIT); Radix UI primitives: dialog 1.3.1, select 2.4.1, slider 1.6.1, slot 1.5.0, switch 1.4.1, tabs 1.2.1, toggle-group 1.2.1, tooltip 1.4.1, visually-hidden 1.2.13 (MIT); TanStack React Query 5.107.1 (MIT); Zustand 5.1.0 (MIT); class-variance-authority 0.7.1 (Apache-2.0); clsx 2.1.1 (MIT); tailwind-merge 3.7.0 (MIT); lucide-react 1.73.0 (ISC; icons); Geist font 1.9.2 (SIL Open Font License); D3 modules d3-array 3.2.5, d3-contour 4.0.3, d3-format 3.1.3, d3-interpolate 3.0.2, d3-scale 4.0.3, d3-scale-chromatic 3.1.1, d3-selection 3.0.1, d3-shape 3.2.1, d3-zoom 3.0.1 (ISC). Testing and linting: Playwright 1.65.1 (Apache-2.0); @axe-core/playwright 4.14.0 (MPL-2.0); ESLint 9.39.5 and eslint-config-next 16.4.6 (MIT); @types/* packages (MIT).

**Publications and methods cited in the documentation.**
- Rasmussen, C. E. and Williams, C. K. I. (2006). Gaussian Processes for Machine Learning. MIT Press (GP classification with the Laplace approximation, Algorithms 3.1, 3.2, 5.1; cited in `docs/scientific-methodology.md`).
- Olson, S. L. and Ferkul, P. V. (2017). Combustion and Flame 180, 217-229, doi 10.1016/j.combustflame.2017.03.001 (BASS-II publication point, via NASA/TM-20210011385 Sec. 6.1).
- Bhattacharjee, S. et al. (2016). Combustion and Flame 163 (doi 10.1016/j.combustflame.2015.10.023) and Fire Safety Journal 79 (doi 10.1016/j.firesaf.2015.11.011) (via NASA/TM-20210011385).
- Zhao, X. et al. (2017). Proceedings of the Combustion Institute 36, 2971-2978, doi 10.1016/j.proci.2016.06.028.
- Link, S., Huang, X., Fernandez-Pello, C., Olson, S., Ferkul, P. (2018). The Effect of Gravity on Flame Spread over PMMA Cylinders. Scientific Reports 8, 120, doi 10.1038/s41598-017-18398-4 (CC BY 4.0).
- T'ien, J. S. et al. (2025). Combustion and Flame 277, 114244, doi 10.1016/j.combustflame.2025.114244 (SoFIE-GEL; referenced in the non-integrated catalogue only).
- NASA-STD-3001 Vol. 2 Rev F and OCHMO-TB-003 Rev A (atmosphere and ventilation bands); NASA-STD-6001 is mentioned only as the ground-test reference in the NASA/TM-2008-215260 context table.

**AI assistance.** Claude (Anthropic), as described under Use of Super Intelligence.

**Text, code and images.** All code in the repository was written for this project (with AI assistance as disclosed); no third-party images; no NASA logos or branding. NASA data and NTRS tables are used under the licence stated by the source (PSI: CC0-1.0; NTRS documents cited by identifier, with transcribed tables carrying page and table references).

---

## Build notes (not for the submission form)

- High-Level Project Summary: 136 words (limit 150).
- Numbers marked (V) are read from `models/gp-laplace-v1+8783ff5a.adfbbd/validation.json` (generated 2026-11-15T18:00:31+00:00) and `models/retrospective/8783ff5aa6a2.json`.
- The 8.3 reference-distance example is read from the precomputed snapshot (manifest generated 2026-11-15T18:07:10Z); if the snapshot is regenerated and the value changes, update it.
- The deployed app, video and repository links, and the team's confirmation of who devised the idea, must be filled by the team.
