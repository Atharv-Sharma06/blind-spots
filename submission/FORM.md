# Space Apps 2026 submission form: paste-ready (Blind Spots)

Fill the fields in this order. Each block below is exactly what goes into the form field named in its heading.
Full drafts with sources and verification notes: `submission/form/` (one file per field).

## Project Name
```
Blind Spots: Do ISS Fire Tests Cover Moon/Mars Cabin Air?
```

## Summary *  (166 words, 1011 of 1500 characters)
```
Blind Spots is an open-source website showing whether NASA's ISS tests cover a crew cabin's air. We turned 250 ISS flame tests (BASS, BASS-II; NASA PSI) into a dataset where every value links to its source. Pick a cabin to see a plain answer, a chart and the best next experiments. ISS air has 241 nearby ISS test results, but 8 of 11 cabins have none, including NASA's Exploration Atmosphere (34 % oxygen, 56.5 kPa). A machine-learning model predicts whether a flame keeps burning and says when evidence is missing; active learning ranks the most informative next experiments. For that cabin and thin acrylic film, the top experiment would cut the model's uncertainty by an expected 19.3 %, under stated assumptions. Published validation shows where a simple baseline does as well. Fire is a serious hazard in a sealed cabin, and future cabins may use thinner, oxygen-richer air. Ranked experiments are computational research candidates; this is not a certified fire-safety assessment and not endorsed by NASA.
```

## Project Demonstration *
```
https://blind-spots-kappa.vercel.app/video/blind-spots-demo-30s.webm
```
Under 30 seconds, public, no login. It is a WebM file: it plays in Chrome, Edge and Firefox; Safari support varies. If you
have two minutes, upload `submission/blind-spots-demo-30s.webm` to YouTube as **Unlisted** or **Public** (title "Blind
Spots: do ISS fire tests cover Moon/Mars cabin air? (30 s demo)"; put the SI line from below in the description) and
paste the YouTube link here instead. Backup (no more than 7 slides): https://github.com/Atharv-Sharma06/blind-spots/blob/main/submission/slides/blind-spots-slides.pdf

## Project *
```
https://blind-spots-kappa.vercel.app
```
(Code: https://github.com/Atharv-Sharma06/blind-spots, MIT licence; it is linked in the site header and in the details.)

## Project Details *  (rich text: paste, then make the "##" lines headings and the "-" lines bullets if needed)

## What it does

NASA burned materials aboard the International Space Station (ISS) to learn when a flame keeps burning. All those tests ran in ISS-like air. Moon and Mars cabins plan thinner air with more oxygen.

Blind Spots asks one question: **do the ISS flame tests cover this cabin's air?**

1. **Pick a cabin.** 11 documented NASA cabin atmospheres. Each card says Covered, Barely covered or Not covered.
2. **See the answer.** A plain verdict and a chart of oxygen against pressure, with ISS tests and your cabin marked.
3. **See what to test next.** The 3 tests that would teach the model most, and what we would learn if the flame kept burning or went out.

**Headline:** the NASA Moon/Mars Exploration Atmosphere (34 % oxygen, 56.5 kPa) has no nearby ISS test results for any of 20 material setups. The ISS cabin has 241. 8 of 11 cabins have none, including all 7 below sea-level pressure.

## How it works

1. **Data.** NASA PSI records of 250 ISS BASS and BASS-II tests. Every value links to its source cell; the build rejects any quote not found there (0 failures across 749 flow steps).
2. **Coverage.** "Nearby" means close in oxygen, pressure and airflow. ISS tests span 13.5 to 22.7 % oxygen and 98.3 to 102.2 kPa.
3. **A model that says "I don't know".** For the 9 of 20 material setups with enough data, a Gaussian-process model (one that reports its own uncertainty) estimates the chance a flame keeps burning. With no nearby tests it shows no number.
4. **Ranking.** Machine learning picks the tests that cut the model's uncertainty most. For thin acrylic films in the Exploration Atmosphere, the top pick (34 % oxygen, 56.5 kPa, airflow 1.7 cm/s) cuts it by 19 %, against 0 % for a random pick and 16 % for the nearest gap. If the flame kept burning, it would fall 18 %; if it went out, 21 %. Hypothetical model updates, not experimental results.

## Benefits

- Scientists and designers see in seconds whether a cabin's air is backed by ISS records.
- A vague gap becomes a short, ranked list of questions.

## Intended impact

Before anyone trusts a flammability number for a Moon or Mars cabin, they should know how much evidence exists. Blind Spots shows the gap and points research where it would teach the most.

The closest NASA work for the Exploration Atmosphere (SoFIE-GEL; Glenn drop-tower tests, NASA/TM-2008-215260) has no public per-test table. Publishing one would close the gap fastest.

## Tools, languages and software

- **Python 3.12:** FastAPI, NumPy, SciPy, pandas, scikit-learn.
- **TypeScript:** Next.js, React, Tailwind CSS, D3.
- **Testing, hosting:** Playwright, axe-core, Vercel.

## How it is creative

- "We don't know" counts as a result: the model abstains instead of guessing.
- It asks "how much evidence do we have?" before "will it burn?"

## Factors we considered

- **Honesty.** Gaps are gaps in the ISS records, not NASA's knowledge. NASA ground tests exist for air like this; the model does not use them.
- **Assumed pressure.** BASS-II did not record pressure, so 419 of 565 test steps use the ISS nominal 101.353 kPa, flagged as assumed.
- **Limits.** The model beats a majority-class guess in 6 of 9 material setups; the ranking beat random in 11 of 18 replayed scenarios. Samples are small.
- **Accessibility.** Icon plus words, never colour alone; "Show as table" for the chart.
- **No server.** The site runs on a precomputed snapshot. NASA PSI data are CC0.
- **Safety.** Not endorsed by NASA. Not a certified fire-safety assessment. Results are computational research candidates requiring qualified scientific review, established safety procedures and formal feasibility assessment. No experimental procedures are given.

## Use of SI

The code, text and analysis were written with SI assistance from Claude, by Anthropic. Every number is computed from NASA data and checked by provenance checks and tests. The app runs no language model.

## Links

- Site: https://blind-spots-kappa.vercel.app
- Code: https://github.com/Atharv-Sharma06/blind-spots
- 30-second video: https://blind-spots-kappa.vercel.app/video/blind-spots-demo-30s.webm

## Use of Super Intelligence (SI) *
Tick every option that means: **code generation / coding assistant**, **text / writing / documentation**,
**data processing / extraction / transcription**, **research / summarising / review**, and **machine learning** if it
is offered. Do NOT tick image, video or audio generation, and do NOT tick "I did not use SI".
(The Submission Guide says SI "should not be used to (come up with your idea of how to solve the challenge)"; the idea
and the decisions were yours, the code and text were written with Claude. Details: `submission/form/06-si-use.md`.)

## NASA Data *  (add one row per line: Link Text, then Link Url)
| Link Text | Link Url |
|---|---|
| NASA PSI: Burning and Suppression of Solids, BASS (PSI-26) | https://psi.nasa.gov/physci/repo/data/investigations/PSI-26 |
| NASA PSI: Burning and Suppression of Solids II, BASS-II (PSI-25) | https://psi.nasa.gov/physci/repo/data/investigations/PSI-25 |
| BASS-II Summary Report (NASA/TM-20210011385) | https://ntrs.nasa.gov/citations/20210011385 |
| Artemis Deep Space Habitation: lunar Surface Habitat atmosphere (NTRS) | https://ntrs.nasa.gov/citations/20220000245 |
| NASA-STD-3001 Volume 2, Revision F | https://standards.nasa.gov/system/files/tmp/NASA-STD-3001%20Vol%202%20Rev%20F.pdf |
| Open Atmospheres Forum: Exploration Atmospheres Validation Study (NTRS) | https://ntrs.nasa.gov/citations/20220011152 |
| Pressure Effects on the Self-Extinguishment Limits of Aerospace Materials, Orion (NTRS) | https://ntrs.nasa.gov/citations/20090012334 |
| NASA PSI: Spacecraft Fire Safety Experiment, SAFFIRE-I (PSI-98) | https://psi.nasa.gov/physci/repo/data/investigations/PSI-98 |
| Microgravity Flame Spread in Exploration Atmospheres, NASA/TM-2008-215260 (NTRS) | https://ntrs.nasa.gov/citations/20080034883 |
| Extinction of Solid Diffusion Flame in Microgravity, SoFIE-GEL (NTRS) | https://ntrs.nasa.gov/citations/20240007628 |
| NASA Space Apps 2026 challenge: Flame in Freefall | https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/ |
| Full list of all 48 NASA data sources and documents used (with verification) | https://github.com/Atharv-Sharma06/blind-spots/blob/main/submission/form/07-nasa-data.md |

## Space Agency Partner & Other Data  (one row per line)
| Link Text | Link Url |
|---|---|
| Link et al., "The Effect of Gravity on Flame Spread over PMMA Cylinders", Scientific Reports 8:120 (2018), CC BY 4.0 (used to cross-check BASS-II results) | https://doi.org/10.1038/s41598-017-18398-4 |
| Link et al. (2018), Supplementary Table S1 (per-test O2, flow, spread rate; used in the cross-check) | https://static-content.springer.com/esm/art%3A10.1038%2Fs41598-017-18398-4/MediaObjects/41598_2017_18398_MOESM1_ESM.pdf |
| Rasmussen and Williams, Gaussian Processes for Machine Learning, MIT Press (2006) (GP classification with the Laplace approximation, Algorithms 3.1, 3.2, 5.1) | https://gaussianprocess.org/gpml/ |
| Next.js 16 (MIT), incl. eslint-config-next | https://nextjs.org/ |
| React 19 and React DOM (MIT) | https://react.dev/ |
| D3 modules: d3-array, d3-contour, d3-format, d3-interpolate, d3-scale, d3-scale-chromatic, d3-selection, d3-shape, d3-zoom (ISC) | https://d3js.org/ |
| FastAPI (MIT) | https://fastapi.tiangolo.com/ |
| NumPy (BSD-3-Clause) | https://numpy.org/ |
| SciPy (BSD-3-Clause) | https://scipy.org/ |
| scikit-learn (BSD-3-Clause), logistic-regression baseline | https://scikit-learn.org/ |
| Vercel (web hosting) | https://vercel.com/ |
| Claude by Anthropic (AI assistant used for code, analysis and text, as disclosed in the project) | https://www.anthropic.com/claude |
| Claude Code by Anthropic (AI coding tool used to build the project) | https://www.anthropic.com/claude-code |
| GitHub (source code hosting) | https://github.com/ |
| Full list of all 58 open-source tools, papers and services used (with licences) | https://github.com/Atharv-Sharma06/blind-spots/blob/main/submission/form/08-other-data.md |

## Project Submission Verification
Tick both boxes yourself (terms; original work with all external resources listed), click **Save Progress**, then
**Submit for Judging** before 23:59 EST tonight. Only the last "Submit for Judging" counts.
