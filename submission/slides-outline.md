# Blind Spots: 7-slide outline (backup to the video)

Space Apps limit: 7 slides including title and intro, English. Hosted externally with a public link, no login (`docs/research/space-apps-challenge.md` section 2).
Numbers are copied from `models/gp-laplace-v1+8783ff5a.adfbbd/validation.json`, `models/retrospective/8783ff5aa6a2.json`, `data/normalized/dataset_report.json` and the precomputed snapshot (`apps/web/public/snapshot/manifest.json`); dataset `8783ff5aa6a2`. Re-check if anything is retrained or the snapshot is regenerated.
Visual rules: no NASA logos or branding; no images of people under 18; no AI-generated images; use screenshots of the real app (headless captures), each with its on-screen "not endorsed by NASA / research-planning tool" wording left visible.

---

## Slide 1: Title

**On the slide:** Blind Spots. Where NASA's microgravity combustion evidence ends, and what to learn next. NASA Space Apps Challenge 2026, "Flame in Freefall". Team name <team>. One-line disclaimer: research-planning tool, not a certified fire-safety assessment, not endorsed by NASA. QR/link to <deployed URL>.

**Speaker notes:**
- One sentence pitch: "Blind Spots shows, for a spacecraft or habitat atmosphere you choose, how much of it is backed by comparable NASA flame experiments, how sure a model is, and which computation would teach us most."
- Say up front that the interface answers "not represented in the integrated records", never "NASA has not studied this".
- Mention the app is live at <deployed URL> and the code is at <GitHub URL>.

---

## Slide 2: The problem

**On the slide:** Decades of NASA flame-in-microgravity results, hard to find, compare and use. Exploration cabins are planned at reduced pressure and elevated oxygen (example: 8.2 psia / 34 % O2). Three questions: How much of that condition is covered by comparable evidence? How sure is a model there? What should be studied next?

**Speaker notes:**
- The challenge asks for an SI-powered dashboard that summarizes, ranks and interprets findings for human space exploration (challenge text, `docs/research/space-apps-challenge.md` section 1).
- Most dashboards show what was measured. We show what was not measured relative to a target atmosphere.
- The exploration atmosphere 8.2 psia / 34 % O2 comes from NASA documents (NTRS 20140000417, JSC-CN-34806), quoted verbatim in `data/manifests/atmosphere_profiles.json`.

---

## Slide 3: The data

**On the slide:** Public NASA records only (no synthetic data). BASS-II (PSI-25, DOI 10.60555/4qc4-de67) and BASS (PSI-26, DOI 10.60555/58h4-dy80): 250 ISS Microgravity Science Glovebox experiments. Build: 276 experiments, 749 flow-step observations, of which 566 train the model (447 sustained / 119 not). Plus 26 context records (Saffire-I/III, DARTFire, Glenn drop tower, Saffire-IV/V/VI), shown but never modelled. Provenance: every value links to the source file, row and quoted cell text; 0 provenance failures.

**Speaker notes:**
- Free-text test-matrix cells were transcribed twice independently by AI, adjudicated, and each quoted token was automatically verified against the original NASA workbook. BASS-II outcomes were cross-checked against NASA/TM-20210011385 Appendix A.
- Be upfront: this was done with Claude (Anthropic) as a coding and transcription assistant; the app itself uses no generative AI.
- Honest caveats on the data: all integrated observations sit at about 1 atm (98.3 to 102.2 kPa, BASS-II pressure is an assumption, stored separately and flagged); many airflow values come from a calibration; 79 % of training rows are "sustained".
- Screenshot suggestion: Experiments page with one row opened to show the quoted source token.

---

## Slide 4: The method

**On the slide:** Pipeline: NASA records -> curated, provenance-checked dataset -> Gaussian-process classifier per material and flame configuration (9 modelled groups) -> coverage map -> target-aware active learning (expected variance reduction) -> interactive app. Output per point: probability of a sustained flame, uncertainty split into "lack of data" and "outcome variability", and a verdict: supported / extrapolation / insufficient evidence.

**Speaker notes:**
- The "SI" here is classical machine learning: GP classification with a Laplace approximation, MAP-II hyperparameters, constant mean fixed in advance. Explanations are deterministic sentences filled with computed numbers.
- Coverage is model-independent: distance to the nearest comparable observation in (O2, airflow, pressure) with documented scales.
- Where evidence is missing the app says "Insufficient experimental evidence for a reliable estimate." and does not treat a probability as a finding. Reason: the pressure length scale is fixed at 0.3 (ln units) because every integrated observation is near 1 atm, so at low pressure predictions simply revert to the training base rate (for example p about 0.6 at 34 % O2 / 56.5 kPa is reversion, not a pressure effect).
- Validation is grouped by experiment because flow steps of one test are correlated.

---

## Slide 5: The blind-spot finding

**On the slide:** Exploration atmosphere (34 % O2, 56.537 kPa) vs thin PMMA films, opposed flow (16 experiments): 0 of 9 sampled target points have a comparable integrated observation; the nearest is 8.3 reference distances away; verdict "insufficient evidence". Context layer: documented Saffire-V/VI and drop-tower tests near reduced pressure and elevated O2 are visible, but they are documented tests, not integrated into the model. Screenshot: the O2 x pressure plane with the dashed target and the empty region.

**Speaker notes:**
- Source of the numbers: precomputed target assessment for `pmma_thin_film__opposed` x `exploration_atmosphere_8p2_34` in the snapshot. One reference distance is about 2 % O2, or 0.5 in ln(1 + airflow), or 0.1 in ln-pressure.
- Use the O2 x pressure plane: the whole integrated data cloud is a thin line at about 1 atm, so the gap is visible at a glance.
- Phrase it as "not represented in the integrated records". Name documented NASA work that is not integrated (Saffire-V at 70.7 to 72.6 kPa, Saffire-VI at 54 to 55 kPa; SoFIE-GEL) because it has no machine-readable per-test table here.
- Optional second finding: the "blind-spot test" asks whether uncertainty flags the experiments where the model errs. Strict rule (also requires a significant partial correlation given outcome variability): supported in the 3 sphere groups, inconclusive in 6.

---

## Slide 6: Recommendation and validation

**On the slide:** Recommendation (computational research candidate, requires qualified scientific review and a formal feasibility assessment): the top-ranked candidate for this target is 34.0 % O2, 56.5 kPa, 1.71 cm/s, expected reduction of weighted latent variance 19.7 %; unchanged across pressure length scales 0.15 / 0.3 / 0.6; compared with random, uncertainty-sampling and nearest-gap baselines. Validation (honest): GP clearly beats a majority-class guess in 4 of 9 groups (thin PMMA films and the three sphere groups); roughly at baseline for opposed rods, slabs, stagnation rods (point estimate better, CI includes 0), configuration-unknown rods and SIBAL fabric. Retrospective test, 18 scenarios: EVR beat random in 10 (indistinguishable 3, worse 5) and uncertainty sampling in 9 (4, 5).

**Speaker notes:**
- Read the candidate honestly: the top pick sits at the unobserved corner because that is where the model knows least; its value is assumption-dependent through the fixed pressure length scale, which is why the sensitivity check is shown. It is a question to ask, not a test to run.
- The sphere groups' discrimination comes largely from flow-turned-off steps: dropping them lowers CV AUC from 0.96 to 0.67 (spheres, stagnation) and 0.99 to 0.82 (spheres, wake); the unknown-configuration spheres have no other negatives. Many near-quench rod steps rely on documented below-calibration flow interpolation (opposed PMMA rods keep 36 of 108 training rows without them).
- The EVR formula uses the outcome-averaged Laplace update factor F_c = sum_y p_y / (Sigma_cc + 1/W(f_y)).
- Retrospective result is modest small-sample evidence, not proof. We chose to show it because it is what separates a ranking from a guess.

---

## Slide 7: Impact and next steps

**On the slide:** Who benefits: combustion scientists, fire-safety engineers and students planning exploration atmospheres. What you get: a traceable evidence-gap map, ranked computational research questions with their assumptions, a printable research brief, reproducible rebuilds (dataset, model, snapshot). Next steps (not implemented): integrate more catalogued investigations (Saffire-V/VI, SoFIE-GEL) when per-test tables exist, add partial-gravity data when available, prospective validation with qualified reviewers. Links: <deployed URL>, <GitHub URL>.

**Speaker notes:**
- Impact in one line: it turns a pile of results into a list of what to ask next, and tells you how far to trust the answer.
- Limits stated plainly: small samples (12 to 25 experiments per group), strong class imbalance, microgravity only, gaps are gaps in the integrated records, not in NASA's knowledge.
- Disclosure: built with substantial help from Claude (Anthropic); the app contains no generative AI and no AI-generated images.
- Close with credits: NASA PSI and NTRS (CC0 / cited by identifier), open-source libraries listed on the project page. Not endorsed by NASA.
