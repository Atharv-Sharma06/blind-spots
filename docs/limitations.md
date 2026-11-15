# Limitations

Read together with [validation.md](validation.md) and [evidence-report.md](evidence-report.md). Figures are from dataset `4fe55f76142a` and model `gp-laplace-v1+4fe55f76.adfbbd`.

## Scope and framing

1. **Integrated records only.** Every statement describes the integrated NASA records. A condition missing from them is "not represented in the integrated records"; it is not evidence that NASA has not studied it.
   16 investigations are catalogued in `data/manifests/known_investigations_not_integrated.json` as known but not integrated (for example SoFIE-GEL, Saffire-V/VI); some have documented envelopes that overlap cabin-relevant targets.
2. **Not a certification.** Blind Spots is not a fire-safety assessment, makes no claim of NASA approval or endorsement, and produces no combustion-test, ignition or apparatus procedures.
   Candidates are computational research candidates requiring qualified scientific review, established safety procedures and formal feasibility assessment. "Within the demonstrated envelope" means only that conditions of that kind were already run in the integrated investigations.
3. **Microgravity only.** No partial-gravity data are integrated; ground (normal-gravity) thresholds are context and are never mixed into the model.

## Data limitations

4. **Class imbalance.** 78% of the 565 training observations are "sustained" (443 vs 122). The majority-class baseline is strong; the GP is better than it (CI excludes 0) in 6 of 9 modelled groups.
5. **Small samples.** Modelled groups have 12 to 25 experiments and 3 to 21 not-sustained rows. Intervals are wide, point estimates are unstable, and a single experiment can change a group's conclusion.
   11 groups are not modelled at all (coverage only).
6. **Weak negative labels.** 24 of the 122 not-sustained training rows are flow-off transients (flow turned off, not a physical quench) and more are brief flames. In 3 groups at least 80% of negatives are flow-off transients, so apparent skill there mostly reflects "flow near zero means no flame". Grouped-CV AUC before and after dropping those rows: PMMA spheres, wake ignition: 0.99 with all 10 not-sustained observations; 0.82 without them, but only 1 not-sustained observation remains, so that AUC is not interpretable; PMMA spheres, axial stagnation flow: 0.96 with all 10 not-sustained observations; 0.67 without them, but only 2 not-sustained observations remain, so that AUC is not interpretable; PMMA spheres, configuration not recorded: 1.00 with all 3 not-sustained observations; none remain without them, so not evaluable.
7. **Ordering bias.** Most "sustained" labels are implied by list order in decreasing-flow schedules (no outcome token in the source); the final unrecorded setting is omitted. The true boundary is therefore thinly observed and the model is conservative about where it lies.
8. **Derived flow values.** 332 of 565 training steps use a recorded airflow (duct reading or a value stated in the source); 233 are converted from fan or pot settings with the BASS-II calibration; none use a borrowed calibration. (air_display 257, pot_calibration 202, stated_cm_s 75, fan_calibration 31.) 139 training rows are below the calibrated range (extrapolated); below about 1 cm/s the values are uncertain. Many near-quench rows rely on this extrapolation; rows remaining when the below-calibration rows are dropped: PMMA rods, opposed flow (36 of 108 training rows and 4 of 21 negatives remain); PMMA rods, axial stagnation flow (32 of 66 training rows and 13 of 18 negatives remain); PMMA rods, configuration not recorded (35 of 52 training rows and 2 of 7 negatives remain); Thin PMMA films, opposed flow (37 of 48 training rows and 3 of 11 negatives remain). The air display lags about a minute, so steady state is not guaranteed.
9. **Interpreted text.** Flow schedules and outcomes are interpretations of free text. Each step cites its source token and the pipeline verifies it (0 provenance failures means the quoted token exists, not that the interpretation is unique). Configuration labels rest on weak evidence for some tests (publication titles, ReadMe) and 0 labels changed when NASA/TM-20210011385 Appendix A evidence was applied. Unknown configurations form their own groups.
10. **O2 is partly confounded with campaign**, so leave-one-campaign-out validation is hard and O2 effects for spheres and wax candles are not identifiable (essentially air-like O2).
11. **Possible duplicates** (PSI-26:24/12-R vs PSI-26:24/12-R2, PSI-26:26 vs PSI-26:27) are flagged and kept.

## Pressure

12. **Everything is about 1 atm** (98.3 to 102.2 kPa). BASS measured pressure; BASS-II pressure is an assumed ISS nominal (101.353 kPa, flagged `pressure_assumed`) because the matrices do not record it.
13. **The GP pressure length scale is fixed at 0.3 (ln units) and cannot be learned.** All reduced-pressure predictions, coverage claims and candidate rankings at other pressures are assumption-driven. The 0.15 / 0.3 / 0.6 sensitivity analysis shows how rankings change under that assumption; it does not validate it
    (its cross-validated effect is at most 0.001 log loss only because pressure does not vary in the data).
    At low pressure the posterior reverts to the prior (latent std ratio about 1): for example about 0.6 at 34 % O2 and 56.5 kPa is reversion, not a pressure effect, so the interface shows no p(sustained) for `insufficient_evidence` targets.

## Model and validation

14. **Statistical, not mechanistic.** The GP interpolates ordered flow-step outcomes in (O2, flow, pressure). It does not model heat transfer, radiation, geometry, ignition or gravity.
15. **Calibration is imperfect and ECE is biased upward** in small samples; reliability bins are sparse (see per-group calibration lines in [validation.md](validation.md)).
16. **Blind-spot test.** 4 of 9 groups are "supported", 5 inconclusive. Aleatoric uncertainty tracks error at least as strongly as epistemic in 8 groups, the partial correlation is 0.15 to 0.80, point-level p-values assume exchangeable points, and the AUROC rests on few misclassified points (0 to 22).
17. **Retrospective acquisition test.** EVR versus random: better in 11, indistinguishable in 5, worse in 2 of 18 scenarios; scenarios share groups and experiments and are not independent; seeds vary only the initial set; acquisition units are whole experiments, not single points; pressure plays no role. No reliable advantage over simple baselines is claimed.
18. **Target and candidate choices are analysis choices.** The target airflow band below 7.62 cm/s (down to 0.5 cm/s) is an analysis extension of the documented 7.62 to 60.96 cm/s ventilation band. Null nominals are replaced by documented bounds and flagged. The candidate domain (O2 12 to 40 %, pressure 50 to 103 kPa, airflow 0.5 to 45 cm/s) is a documented default, not a recommendation.
19. **Model/dataset version drift.** If the dataset is rebuilt after training, the API computes model quantities from the fitted model's own training coordinates and adds a version note to the assumptions; retrain to remove the mismatch.

## Software and deployment

20. **Static snapshot deployment** serves precomputed responses for documented profiles and groups; custom targets and arbitrary candidates require the live analysis service (the interface says so).
21. **Verification status.** The README commands were run locally (macOS); no container build or load test was performed. Run the README "How to test" commands for the current status.
22. **Environment quirk.** On macOS with iCloud Desktop the editable-install `.pth` can be hidden and `import blindspots` fails after `uv sync`; run `chflags nohidden .venv/lib/python3.12/site-packages/*.pth` or set `PYTHONPATH=src`.
23. **Licences**: The project's own code is licensed as stated in [LICENSE](LICENSE). Data licences are as stated in the README section "Licence and attribution".
