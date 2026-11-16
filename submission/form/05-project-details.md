## What it does

NASA burned materials aboard the International Space Station (ISS) to learn when a flame keeps burning. Those tests all ran in ISS-like air. Moon and Mars cabins plan thinner air with more oxygen, and we wanted to know how far apart the two are.

So Blind Spots asks one question: do the ISS flame tests cover this cabin's air? Pick one of 11 documented NASA cabin atmospheres and each card says Covered, Barely covered or Not covered. Open one for a plain verdict, a chart of oxygen against pressure with ISS tests and your cabin marked, and the 3 tests that would teach the model most, plus what each outcome would show.

Our headline: the NASA Moon/Mars Exploration Atmosphere (34 % oxygen, 56.5 kPa) has no nearby ISS test results for any of 20 material setups. The ISS cabin has 241. Overall, 8 of 11 cabins have none, including all 7 below sea-level pressure.

Three newer parts help with the challenge's ask to summarize, rank and interpret. A Findings page ranks what the ISS fire tests show, such as the lowest oxygen at which each material kept burning, and links every finding to the records it comes from. An "Ask about your cabin air" box answers one cabin and material in a single sentence. And a model check beside the charts shows where our model beats a simple guess and where it does not.

## How it works

The data are NASA PSI records of 250 ISS BASS and BASS-II tests. Every value links to its source cell, and the build rejects any quote it can't find there (0 failures across 749 flow steps).

"Nearby" means close in oxygen, pressure and airflow. ISS tests span 13.5 to 22.7 % oxygen and 98.3 to 102.2 kPa.

For the 9 of 20 material setups with enough data, a Gaussian-process model estimates the chance a flame keeps burning. It reports its own uncertainty, and with no nearby tests it shows no number instead of guessing.

Machine learning ranks tests by how much each would cut that uncertainty. For thin acrylic films in the Exploration Atmosphere, the top pick (34 % oxygen, 56.5 kPa, airflow 1.7 cm/s) cuts it by 19 %, against 0 % for a random pick and 16 % for the nearest gap. If the flame kept burning, it would fall 18 %. If it went out, 21 %. These are hypothetical model updates, not experimental results.

## Benefits and intended impact

A scientist or cabin designer can see in seconds whether a cabin's air is backed by ISS records, and a vague gap becomes a short, ranked list of questions. Before anyone trusts a flammability number for a Moon or Mars cabin, they should know how much evidence sits behind it. Blind Spots shows that gap and where research would teach the most.

The closest NASA work for the Exploration Atmosphere (SoFIE-GEL; Glenn drop-tower tests, NASA/TM-2008-215260) has no public per-test table. Publishing one would close the gap fastest.

## What is new here

We ask "how much evidence do we have?" before "will it burn?" A model that says it doesn't know counts as a result.

## Factors we considered

The gaps are gaps in the ISS records, not in NASA's knowledge. NASA ground tests exist for air like this, but our model does not use them. BASS-II did not record pressure, so 419 of 565 test steps use the ISS nominal 101.353 kPa, flagged as assumed.

The limits bug us. The model beats a majority-class guess in 6 of 9 material setups, and the ranking beat random in 11 of 18 replayed scenarios. The samples are small.

Status shows an icon plus words, never colour alone, and the chart has a "Show as table" option. The site runs on a precomputed snapshot, so it needs no server. NASA PSI data are CC0.

Blind Spots is not endorsed by NASA and is not a certified fire-safety assessment. The ranked tests are computational research candidates requiring qualified scientific review, established safety procedures and formal feasibility assessment. We give no experimental procedures.

## Tools and languages

Python 3.12 (FastAPI, NumPy, SciPy, pandas, scikit-learn) for the analysis, TypeScript (Next.js, React, Tailwind CSS, D3) for the site, Playwright and axe-core for testing, and Vercel for hosting.

## Use of SI

Claude, by Anthropic, wrote much of the code and text. We directed the work, made the decisions and checked the results. Every number is computed from NASA data and checked by provenance checks and tests. Inside the app, a Gaussian-process model estimates, abstains and ranks. An optional "Explain with SI" button sends only the numbers on screen to Claude Opus 5.5 and shows a short explanation labelled as SI-generated; our code removes any sentence with a number that is not on the page.

## Links

- Site: https://blindspots.earth
- Cabins tool: https://blindspots.earth/cabins
- Code: https://github.com/Atharv-Sharma06/blind-spots
- 30-second video: https://blindspots.earth/video/blind-spots-demo-30s.webm
