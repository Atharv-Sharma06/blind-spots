## What it does

NASA burned materials aboard the International Space Station (ISS) to learn when a flame keeps burning. All those tests ran in ISS-like air. Moon and Mars cabins plan thinner air with more oxygen.

Blind Spots asks one question: **do the ISS flame tests cover this cabin's air?** The home page asks it and shows the key numbers; **Check a cabin** opens the tool.

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
- Check a cabin: https://blind-spots-kappa.vercel.app/cabins
- Code: https://github.com/Atharv-Sharma06/blind-spots
- 30-second video: https://blind-spots-kappa.vercel.app/video/blind-spots-demo-30s.webm
