# Demo script

Describes the current build. The home page (`/`) asks the question, shows the key numbers and links to the Cabins page (`/cabins`) with **Check a cabin**; the full workspace is the Explorer (`/explore`). The whole site uses one dark look. Numbers come from the analysis API via `docs/_gen/build.py` (dataset `{{DV}}`); re-check them after any rebuild.

Setup, from the repository root:

```bash
cd services/analysis && uv run blindspots serve      # API on http://127.0.0.1:8000
cd apps/web && npm run dev                           # open http://localhost:3000
```

The static site (`NEXT_PUBLIC_DATA_MODE=snapshot`) works for the documented cabins. Custom targets need the live service.

## A. 30-second tour

Press **30-second tour** under the title on the Cabins page (or **Watch the 30-second tour** on the home page), or open `/cabins?demo=1` (old `/?demo=1` links forward there). It plays on the real page for about 29 seconds: a title card, five scenes, an end card. Space pauses, arrow keys step, Esc exits. Each scene shows one short caption and at most three facts. Suggested narration, one line per scene:

0. **Title.** "Do NASA's space-station fire tests cover this cabin's air?"
1. **ISS cabin.** {{H_ISS_COMPARABLE}} nearby ISS test results. Covered.
2. **Exploration Atmosphere** (NASA's Moon and Mars design air, 34 % oxygen, 56.5 kPa). {{H_EXPL_COMPARABLE}} nearby ISS test results in all {{H_N_GROUPS}} material setups. Not covered.
3. **The answer.** "Blind spot: none of the ISS flame tests in our data ran in air like this." On the chart, dots are ISS tests (filled: flame kept burning, hollow: went out). The shaded area is where ISS tests ran; "This cabin" sits far outside it. {{DX_PTS_WITH}} of {{DX_NPTS}} sampled points of this cabin have a nearby test.
4. **What to test next.** Top pick: {{TC_O2}} % oxygen, {{TC_P}} kPa, airflow {{TC_U}} cm/s. It would cut the model's uncertainty about this cabin by {{TC_EVR}}. A computational research candidate needing qualified scientific review.
5. **What would we learn?** The change in uncertainty if the flame kept burning, and if it went out. "Hypothetical model updates, not experimental results."
6. **End card.** "Blind Spots. Where NASA's ISS fire-test records end, and what to learn next."

## B. 3-minute demo

Say it up front: a research-planning tool, not a certified fire-safety assessment, not endorsed by NASA. Three steps on one page, then the expert views.

**0:00 - Step 1, pick a cabin (30 s).** Open the home page: the question and the key numbers. Press **Check a cabin** (`/cabins`). NASA burned materials aboard the ISS to learn when flames keep burning; air planned for Moon and Mars cabins (thinner, more oxygen) is missing from those tests. Each card shows a cabin's air and a chip: **Covered**, **Barely covered** or **Not covered**, with its count of nearby ISS test results. The ISS has {{H_ISS_COMPARABLE}}. {{H_N_ZERO}} of {{H_N_PROFILES_ANALYSED}} documented cabins have none, including all {{H_N_REDUCED}} below 1 atm ({{H_REDUCED_SHORT}}).

**0:30 - Step 2, the answer (40 s).** The page opens on the NASA Exploration Atmosphere (`?cabin=` in the URL). Read the verdict (icon and words, never colour alone). Pick a **Material** under it. The chart plots oxygen against pressure: dots are ISS tests, the shaded area is where they ran, "This cabin" is the bold marker. Every ISS test ran near 1 atm. "By material": {{H_EXPL_GROUPS_WITH}} of {{H_N_GROUPS}} material setups have nearby tests. If asked: related NASA ground tests exist, the model does not use them, the Explorer lists them. If asked about gravity: all ISS tests ran in microgravity, so "covered" is about the air only. "Show as table" gives the chart as text.

**1:10 - Step 3, what to test next (35 s).** Read the small-print framing sentence first. Then the top three research candidates: oxygen and pressure, airflow, expected cut in the model's uncertainty. The top one is {{TC_O2}} % oxygen, {{TC_P}} kPa, {{TC_U}} cm/s, a cut of {{TC_EVR}}. Same model, other strategies: random {{TB_RANDOM}}, uncertainty sampling {{TB_UNC}}, nearest gap {{TB_GAP}}. {{DEMO_TOP_SENTENCE}} Then **What would we learn?**: two outcomes, labelled "Hypothetical model updates, not experimental results."

**1:45 - Explorer (40 s).** **Open this cabin in the Explorer** goes to `/explore?target=<cabin>&group=<material>`. Pick a material and switch the map between test results, prediction, uncertainty, coverage and related NASA work. The target panel gives nearby tests, nearest distance, the verdict with reasons, the airflow range and its source, and NASA studies not in our data. The candidate panel can compare two candidates, test how the ranking changes with the pressure assumption, and show a what-if on the map.

**2:25 - Where the data come from (30 s).** Open **Experiments** ({{N_EXP}} experiments): open any row to see the quoted source cell and flagged assumptions (BASS-II did not record pressure, so an assumed value is shown separately). Then **How it works**: {{ENV_N_EXP}} ISS experiments, {{N_TRAIN_OBS}} training results ({{POS_PCT}} flame kept burning), {{N_CONTEXT_EXP}} more experiments as context only. Be plain about limits: the model beats a majority-class guess in {{N_GP_BETTER}} of {{N_MODELLED}} modelled material setups, and in {{N_FLOWOFF_IN_BETTER}} of those mostly on easy flow-off cases. Pressure is assumption-driven (fixed length scale {{LP}}). The ranking beat random in {{R_RAND_B}} of {{R_N}} retrospective scenarios: modest.

**3:00 - Close.** Everything rebuilds deterministically (`build-dataset`, `train`, `retrospective`, `export-artifacts`). Limits are in the app and in `docs/limitations.md`. The **Research brief** (`/brief`) is a printable summary for a chosen cabin.

Not in the demo, because not built: a 3D view, accounts or saved sessions, per-test spread-rate predictions, and any claim about conditions covered only by studies we did not integrate.
