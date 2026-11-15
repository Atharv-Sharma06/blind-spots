# Demo script

Both scripts describe functionality of the current build. Numbers are computed by `docs/_gen/build.py` from the analysis API.
Numbers marked "at dataset {{DV}}" were read off the running app and will change if the dataset or model is rebuilt; re-check them before presenting.

Setup (one time, from the repository root):

```bash
cd services/analysis && uv run blindspots serve      # API on http://127.0.0.1:8000
cd apps/web && npm run dev                           # open http://localhost:3000
```

For the static deployment use `NEXT_PUBLIC_DATA_MODE=snapshot` (see README). In snapshot mode everything below works for documented profiles, but custom targets, arbitrary candidates and arbitrary slice values show a "requires the live analysis service" state.

## A. 30-second script (the built-in "Guided demo" does this automatically)

Click **Guided demo** in the Explore header. It selects the data-driven default group ({{DEFAULT_GROUP}}), then the scenes autoplay (about 30 seconds in total) on the real map (Space pauses, arrow keys step, Esc exits). The demo target is the NASA Exploration Atmosphere (8.2 psia / 34 % O2). When the target's pressure lies outside the group's observed pressure range (here all observations are at about 101.4 kPa), scenes 2 to 5 switch the map to the O2 x pressure plane so the gap is visible, and from scene 3 the context layer is on: Saffire-V/VI flights and drop-tower runs near reduced pressure or elevated O2 are drawn as grey dashed boxes and triangles and captioned as documented tests that are not integrated into the model. Suggested narration, one sentence per scene:

1. **"We know where NASA has tested."** Every dot is a recorded flow step from NASA's ISS BASS/BASS-II test matrices, its outcome interpreted from the source cell, here for {{DG_LABEL}} ({{DG_N_EXP}} experiments, {{DG_N_OBS}} observations, {{DG_N_TRAIN}} training rows).
2. **"But do we know enough about where crews may live?"** A documented NASA cabin atmosphere ({{H_EXPL_LABEL}}) appears as a dashed target. At dataset {{DV}}: {{DX_COMPARABLE}} comparable integrated observations lie within one reference distance of its sampled conditions; the nearest is {{DX_NN}} reference distances away.
3. **"The missing evidence becomes visible."** Amber marks coverage gaps, plum marks model uncertainty, and the verdict reads "insufficient evidence". The caption says the conditions are "not represented in the integrated records" and names documented NASA work that is not integrated (for example SoFIE-GEL) - it never says NASA has not studied them. The caption adds that the map plots O2 against pressure because the target pressure is outside the observed range, and that the grey context markers are documented tests that are not integrated. No P(sustained) is shown for an insufficient-evidence target.
4. **"What should we learn next?"** The top-ranked *computational research candidate*: {{TC_O2}} % O2, {{TC_P}} kPa, {{TC_U}} cm/s, with a model-based expected reduction in uncertainty about the target of {{TC_EVR}}; it requires qualified scientific review.
5. **"Turn existing data into better research questions."** A counterfactual preview shows how the model would update under each hypothetical outcome (hypothetical, not experimental results); expected variance reduction {{TC_EVR}}. {{DEMO_TOP_SENTENCE}}

## B. 3-minute technical demo

Everything here is clickable in the current UI. Keep the framing: a research-planning tool, not a fire-safety certification, not endorsed by NASA.

**0:00 - Problem and data (20 s).** Open **Methodology** (sections: Data, Modelling, Active learning, Validation, Reproducibility, Sources and context, Limitations). Say: public NASA combustion data are hard to compare; we integrated {{N_MODEL_EXP}} ISS
BASS / BASS-II experiments ({{N_TRAIN_OBS}} training observations, {{POS_PCT}} sustained) with the exact source cell behind each value, and treated {{N_CONTEXT_EXP}} other experiments as context only. Point at the Data section's exclusion counts.

**0:20 - Provenance (20 s).** Open **Experiments** ({{N_EXP}} rows). Filter by investigation, group, outcome, training status or confidence; open any row to see the quoted source token, its row and column, and the flagged assumptions (for example, BASS-II pressure is "not recorded in the source", an assumed value is shown separately).

**0:40 - Coverage map (30 s).** Back on **Explore**. Choose a material and flame-configuration group (the default is `{{DEFAULT_GROUP}}`). Toggle the layers: Observed data, Model prediction, Uncertainty, Coverage, Context. Switch the plane between O2 x airflow and O2 x pressure and move the slice.
Point out that all data sit at about 1 atm, so the pressure plane shows how little is observed there. Coverage-only groups show an info callout instead of predictions.

**1:10 - Target atmosphere (30 s).** Open **Target** and pick a documented profile (e.g. NASA Exploration Atmosphere, 8.2 psia / 34 % O2). Read the Target analysis panel: number of comparable observations, nearest distance, verdict with reasons, the airflow band and its source
(for profiles without their own band: the documented ventilation band with a near-quiescent extension, labelled as an analysis choice), and the "Documented NASA work not integrated here" callout. "Coverage by material" assesses the same target in every group; click a row to switch the map.

**1:40 - Model and honesty (30 s).** Open **Methodology > Validation**: per-group cross-validation versus the majority-class baseline with group-bootstrap CIs, calibration, leave-one-campaign-out and the blind-spot test. Say plainly: the GP beats the majority-class baseline (CI excludes 0) in {{N_GP_BETTER}} of {{N_MODELLED}} groups,
{{N_FLOWOFF_IN_BETTER}} of those mostly because flow-off transients are easy negatives; the blind-spot test is supported in {{BS_SUPPORTED}} groups and inconclusive in {{BS_INCONCLUSIVE}}; pressure is assumption-driven (fixed length scale {{LP}}). The retrospective check is modest: EVR beat random in {{R_RAND_B}} of {{R_N}} scenarios.

**2:10 - Candidates (30 s).** In **Next research candidate** read the ranked candidates with their reasons, feasibility status ("outside the demonstrated envelope: feasibility not verified; requires qualified review") and the random / uncertainty-sampling / nearest-gap baselines.
Select two and use **Compare selected** (it can answer "indistinguishable"). The candidate panel also shows the sensitivity of the ranking to the assumed pressure correlation (pressure length scales 0.15 / 0.3 / 0.6).

**2:40 - Counterfactual and brief (20 s).** Click **Explore candidate**: the counterfactual panel shows target P(sustained) and variance under "if sustained" / "if not sustained" (labelled hypothetical); "Show on map" overlays the updated surface. Then **Research brief** (footer): a seven-section brief
(target, coverage, model and validation, candidate, historical investigations, citations, limitations) with Download .md and print.

**3:00 - Close.** Reproducible: `build-dataset`, `train`, `retrospective`, `export-artifacts` regenerate the data, model and static snapshot deterministically; limitations are listed in the app and in `docs/limitations.md`.

Things that are **not** in the demo because they are not implemented: a 3D view, user accounts or saved sessions, per-test spread-rate predictions, and any claim about conditions covered only by non-integrated investigations.
Custom targets exist only with the live service.
