## What it does

NASA burned materials aboard the International Space Station (ISS) to learn when a flame keeps burning in microgravity. Those ISS flame tests all ran in ISS-like air, near sea-level pressure. Moon and Mars cabins plan thinner air with more oxygen.

Blind Spots shows, for any crew cabin, whether the ISS flame tests cover its air, and which next experiment would teach the most.

- **Cabins (home page).** Three steps on one page:
  1. **Pick a cabin** from 11 documented NASA cabin atmospheres, from "ISS today" and the Artemis Moon habitat to Apollo. Each card says Covered, Barely covered or Not covered.
  2. **The answer:** a plain verdict and a simple chart of oxygen against pressure, with the ISS test results and the cabin marked.
  3. **What to test next:** the top 3 experiments ranked by machine learning, and "What would we learn?" if the flame kept burning or went out.
- **Explorer** for experts: full coverage map, model uncertainty and related NASA studies.
- **Experiments:** every test in one table with its NASA source and a CSV download.
- **How it works:** method, validation and limits in plain words.

**Headline:** NASA's Moon/Mars Exploration Atmosphere (34 % oxygen, 56.5 kPa) has 0 nearby ISS test results in all 20 material groups. The ISS cabin has 241. 8 of the 11 cabins have none, including all 7 below sea-level pressure.

## How it works

1. **Data.** NASA PSI records of 250 ISS BASS and BASS-II tests. Every value links to its source cell; the build rejects any quote not found there (0 failures across 749 flow-step observations). 210 experiments and 565 observations train the model.
2. **Coverage.** We count ISS test results "nearby" each cabin, within the model's comparison distance. The ISS tests span 13.5 to 22.7 % oxygen and 98.3 to 102.2 kPa.
3. **A model that abstains.** A Gaussian-process classifier per material group (9 of 20 have enough data) estimates the chance a flame keeps burning and separates "we lack data" from "outcomes vary". Without nearby tests it shows no number: "Insufficient experimental evidence for a reliable estimate."
4. **Ranking.** Active learning scores possible experiments by how much each would cut the model's uncertainty about the chosen cabin. For thin acrylic films in the Exploration Atmosphere, the top pick (34 % oxygen, 56.5 kPa, airflow 1.7 cm/s) cuts it by 19 %, against 0 % for a random pick and 16 % for the nearest gap. If that flame kept burning, uncertainty would fall 18 %; if it went out, 21 %. These are hypothetical model updates, not results.

## Benefits

- Scientists and cabin designers see in seconds whether a cabin's air is backed by traceable ISS records.
- A vague gap becomes a short, ranked, explained list of research questions.
- Reusable dataset: CSV, JSON and Parquet files with a version hash.

## Intended impact

Before anyone trusts a flammability number for a Moon or Mars cabin, they should know how much comparable evidence exists. Blind Spots makes that gap visible and points research where it would teach the most. The most relevant NASA work for the Exploration Atmosphere (SoFIE-GEL; Glenn drop-tower tests, NASA/TM-2008-215260) has no public per-test table. Publishing one would close this gap fastest.

## Tools, languages and software

- **Python 3.12:** FastAPI, Uvicorn, Pydantic, NumPy, SciPy, pandas, scikit-learn, PyArrow, openpyxl, httpx, python-docx, Typer; uv, pytest, ruff, mypy. The Gaussian process and active learning are written directly in NumPy and SciPy.
- **TypeScript:** Next.js, React, Tailwind CSS, Radix UI, D3, TanStack Query, Zustand, lucide-react.
- **Testing and hosting:** Playwright and axe-core (headless), Vercel.

## How it is creative

- It treats "we don't know" as a result: the model abstains instead of guessing.
- It asks "how much evidence do we have, and what should we test next?" rather than only "will it burn?"
- A plain first screen for anyone, with expert depth one click away.

## Factors we considered

- **Scientific honesty.** Gaps are gaps in the ISS records, not in NASA's knowledge. NASA ground and drop-tower tests exist for air like this; we list them as context, but the model does not use them.
- **Assumed pressures disclosed.** BASS-II did not record pressure, so 419 of 565 training steps use the ISS nominal 101.353 kPa, flagged as assumed.
- **Validation and its limits.** Grouped cross-validation with confidence intervals and baselines. The model beats a majority-class guess in 6 of 9 groups. The ranking beat random in 11 of 18 retrospective scenarios. Samples are small.
- **Accessibility.** Icon plus words, never colour alone; a "Show as table" option for the chart; light and dark themes; axe-core checks.
- **Phone layout.** Phone-first, with no sideways scrolling.
- **No backend needed.** The site runs on a precomputed snapshot, so judges need no server.
- **Licensing and privacy.** NASA PSI data are CC0. Researcher contact emails were removed from the stored metadata.
- **Safety.** Not endorsed by NASA. Not a certified fire-safety assessment. Results are computational research candidates requiring qualified scientific review, established safety procedures and formal feasibility assessment. No experimental procedures are given.

## Use of SI

The code, text and analysis pipeline were written with SI assistance from Claude, by Anthropic. All numbers are computed from NASA data by that code and checked by provenance checks and tests. The app runs no language model; its machine learning is the Gaussian-process model and the ranking above.

## Links

- Site: https://blind-spots-kappa.vercel.app
- Code: https://github.com/Atharv-Sharma06/blind-spots
- 30-second video: https://blind-spots-kappa.vercel.app/video/blind-spots-demo-30s.webm
