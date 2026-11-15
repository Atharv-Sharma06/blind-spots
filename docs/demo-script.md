# Demo script

Describes the current build. The Cabins page (`/`) is the home page; the full workspace is the Explorer (`/explore`). Numbers come from the analysis API via `docs/_gen/build.py` (dataset `4fe55f76142a`); re-check them after any rebuild.

Setup, from the repository root:

```bash
cd services/analysis && uv run blindspots serve      # API on http://127.0.0.1:8000
cd apps/web && npm run dev                           # open http://localhost:3000
```

The static site (`NEXT_PUBLIC_DATA_MODE=snapshot`) works for the documented cabins. Custom targets need the live service.

## A. 30-second tour

Press **30-second tour** under the title on the Cabins page, or open `/?demo=1`. It plays on the real page for about 29 seconds: a title card, five scenes, an end card. Space pauses, arrow keys step, Esc exits. Each scene shows one short caption and at most three facts. Suggested narration, one line per scene:

0. **Title.** "Do NASA's space-station fire tests cover this cabin's air?"
1. **ISS cabin.** 241 nearby ISS test results. Covered.
2. **Exploration Atmosphere** (NASA's Moon and Mars design air, 34 % oxygen, 56.5 kPa). 0 nearby ISS test results in all 20 material setups. Not covered.
3. **The answer.** "Blind spot: none of the ISS flame tests in our data ran in air like this." On the chart, dots are ISS tests (filled: flame kept burning, hollow: went out). The shaded area is where ISS tests ran; "This cabin" sits far outside it. 0 of 9 sampled points of this cabin have a nearby test.
4. **What to test next.** Top pick: 34.0 % oxygen, 56.5 kPa, airflow 1.71 cm/s. It would cut the model's uncertainty about this cabin by 19.3%. A computational research candidate needing qualified scientific review.
5. **What would we learn?** The change in uncertainty if the flame kept burning, and if it went out. "Hypothetical model updates, not experimental results."
6. **End card.** "Blind Spots. Where NASA's ISS fire-test records end, and what to learn next."

## B. 3-minute demo

Say it up front: a research-planning tool, not a certified fire-safety assessment, not endorsed by NASA. Three steps on one page, then the expert views.

**0:00 - Step 1, pick a cabin (30 s).** Open **Cabins**. NASA burned materials aboard the ISS to learn when flames keep burning; air planned for Moon and Mars cabins (thinner, more oxygen) is missing from those tests. Each card shows a cabin's air and a chip: **Covered**, **Barely covered** or **Not covered**, with its count of nearby ISS test results. The ISS has 241. 8 of 11 documented cabins have none, including all 7 below 1 atm (Shuttle pre-EVA, Exploration Atmosphere, Artemis Surface Habitat, EAWG 2006, Orion lunar, Skylab, Apollo).

**0:30 - Step 2, the answer (40 s).** The page opens on the NASA Exploration Atmosphere (`?cabin=` in the URL). Read the verdict (icon and words, never colour alone). Pick a **Material** under it. The chart plots oxygen against pressure: dots are ISS tests, the shaded area is where they ran, "This cabin" is the bold marker. Every ISS test ran near 1 atm. "By material": 0 of 20 material setups have nearby tests. If asked: related NASA ground tests exist, the model does not use them, the Explorer lists them. If asked about gravity: all ISS tests ran in microgravity, so "covered" is about the air only. "Show as table" gives the chart as text.

**1:10 - Step 3, what to test next (35 s).** Read the small-print framing sentence first. Then the top three research candidates: oxygen and pressure, airflow, expected cut in the model's uncertainty. The top one is 34.0 % oxygen, 56.5 kPa, 1.71 cm/s, a cut of 19.3%. Same model, other strategies: random 0.0%, uncertainty sampling 0.0%, nearest gap 15.8%. The top-ranked candidate sits at the target conditions themselves; this follows from the model's distance-based (stationary) correlation assumption, because no integrated observation constrains that region. Then **What would we learn?**: two outcomes, labelled "Hypothetical model updates, not experimental results."

**1:45 - Explorer (40 s).** **Open this cabin in the Explorer** goes to `/explore?target=<cabin>&group=<material>`. Pick a material and switch the map between test results, prediction, uncertainty, coverage and related NASA work. The target panel gives nearby tests, nearest distance, the verdict with reasons, the airflow range and its source, and NASA studies not in our data. The candidate panel can compare two candidates, test how the ranking changes with the pressure assumption, and show a what-if on the map.

**2:25 - Where the data come from (30 s).** Open **Experiments** (276 experiments): open any row to see the quoted source cell and flagged assumptions (BASS-II did not record pressure, so an assumed value is shown separately). Then **How it works**: 250 ISS experiments, 565 training results (78% flame kept burning), 26 more experiments as context only. Be plain about limits: the model beats a majority-class guess in 6 of 9 modelled material setups, and in 0 of those mostly on easy flow-off cases. Pressure is assumption-driven (fixed length scale 0.3). The ranking beat random in 11 of 18 retrospective scenarios: modest.

**3:00 - Close.** Everything rebuilds deterministically (`build-dataset`, `train`, `retrospective`, `export-artifacts`). Limits are in the app and in `docs/limitations.md`. The **Research brief** (`/brief`) is a printable summary for a chosen cabin.

Not in the demo, because not built: a 3D view, accounts or saved sessions, per-test spread-rate predictions, and any claim about conditions covered only by studies we did not integrate.
