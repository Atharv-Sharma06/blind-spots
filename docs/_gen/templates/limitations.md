# Limitations

Read together with [validation.md](validation.md) and [evidence-report.md](evidence-report.md). Figures are from dataset `{{DV}}` and model `{{MV}}`.

## Scope and framing

1. **Integrated records only.** Every statement describes the integrated NASA records. A condition missing from them is "not represented in the integrated records"; it is not evidence that NASA has not studied it.
   {{N_NOT_INTEGRATED}} investigations are catalogued in `data/manifests/known_investigations_not_integrated.json` as known but not integrated (for example SoFIE-GEL, Saffire-V/VI); some have documented envelopes that overlap cabin-relevant targets.
2. **Not a certification.** Blind Spots is not a fire-safety assessment, makes no claim of NASA approval or endorsement, and produces no combustion-test, ignition or apparatus procedures.
   Candidates are computational research candidates requiring qualified scientific review, established safety procedures and formal feasibility assessment. "Within the demonstrated envelope" means only that conditions of that kind were already run in the integrated investigations.
3. **Microgravity only.** No partial-gravity data are integrated; ground (normal-gravity) thresholds are context and are never mixed into the model.

## Data limitations

4. **Class imbalance.** {{POS_PCT}} of the {{N_TRAIN_OBS}} training observations are "sustained" ({{POS}} vs {{NEG}}). The majority-class baseline is strong; the GP is better than it (CI excludes 0) in {{N_GP_BETTER}} of {{N_MODELLED}} modelled groups.
5. **Small samples.** Modelled groups have {{N_EXP_MIN}} to {{N_EXP_MAX}} experiments and {{N_NEG_MIN}} to {{N_NEG_MAX}} not-sustained rows. Intervals are wide, point estimates are unstable, and a single experiment can change a group's conclusion.
   {{N_NOT_MODELLED}} groups are not modelled at all (coverage only).
6. **Weak negative labels.** {{FLOW_OFF}} of the {{NEG}} not-sustained training rows are flow-off transients (flow turned off, not a physical quench) and more are brief flames. In {{N_FLOWOFF_GROUPS}} groups at least 80% of negatives are flow-off transients, so apparent skill there mostly reflects "flow near zero means no flame". Grouped-CV AUC before and after dropping those rows: {{FLOWOFF_AUC}}.
7. **Ordering bias.** Most "sustained" labels are implied by list order in decreasing-flow schedules (no outcome token in the source); the final unrecorded setting is omitted. The true boundary is therefore thinly observed and the model is conservative about where it lies.
8. **Derived flow values.** Airflow comes from the duct air display (U = 1.0066 x AIR), from fan or pot calibration (day-nearest, borrowed for BASS) or from stated values ({{BASIS}} in training). {{T_BELOW_CAL}} training rows are below the calibrated range (extrapolated); below about 1 cm/s the values are uncertain. Many near-quench rows rely on this interpolation; rows remaining when the below-calibration rows are dropped: {{BELOWCAL_RELIANT}}. The air display lags about a minute, so steady state is not guaranteed.
9. **Interpreted text.** Flow schedules and outcomes are interpretations of free text. Each step cites its source token and the pipeline verifies it (0 provenance failures means the quoted token exists, not that the interpretation is unique). Configuration labels rest on weak evidence for some tests (publication titles, ReadMe) and {{CFG_CHANGED}} labels changed when NASA/TM-20210011385 Appendix A evidence was applied. Unknown configurations form their own groups.
10. **O2 is partly confounded with campaign**, so leave-one-campaign-out validation is hard and O2 effects for spheres and wax candles are not identifiable (essentially air-like O2).
11. **Possible duplicates** ({{EXP_POSSIBLE_DUP}}) are flagged and kept.

## Pressure

12. **Everything is about 1 atm** ({{P_MIN}} to {{P_MAX}} kPa). BASS measured pressure; BASS-II pressure is an assumed ISS nominal (101.353 kPa, flagged `pressure_assumed`) because the matrices do not record it.
13. **The GP pressure length scale is fixed at {{LP}} (ln units) and cannot be learned.** All reduced-pressure predictions, coverage claims and candidate rankings at other pressures are assumption-driven. The 0.15 / 0.3 / 0.6 sensitivity analysis shows how rankings change under that assumption; it does not validate it
    (its cross-validated effect is at most {{LP_MAX_DELTA}} log loss only because pressure does not vary in the data).
    At low pressure the posterior reverts to the prior (latent std ratio about 1): for example about 0.6 at 34 % O2 and 56.5 kPa is reversion, not a pressure effect, so the interface shows no p(sustained) for `insufficient_evidence` targets.

## Model and validation

14. **Statistical, not mechanistic.** The GP interpolates ordered flow-step outcomes in (O2, flow, pressure). It does not model heat transfer, radiation, geometry, ignition or gravity.
15. **Calibration is imperfect and ECE is biased upward** in small samples; reliability bins are sparse (see per-group calibration lines in [validation.md](validation.md)).
16. **Blind-spot test.** {{BS_SUPPORTED}} of {{N_MODELLED}} groups are "supported", {{BS_INCONCLUSIVE}} inconclusive. Aleatoric uncertainty tracks error at least as strongly as epistemic in {{N_ALEA_GE_EPI}} groups, the partial correlation is {{PARTIAL_MIN}} to {{PARTIAL_MAX}}, point-level p-values assume exchangeable points, and the AUROC rests on few misclassified points ({{MIN_MISCLASS}} to {{MAX_MISCLASS}}).
17. **Retrospective acquisition test.** EVR versus random: better in {{R_RAND_B}}, indistinguishable in {{R_RAND_I}}, worse in {{R_RAND_W}} of {{R_N}} scenarios; scenarios share groups and experiments and are not independent; seeds vary only the initial set; acquisition units are whole experiments, not single points; pressure plays no role. No reliable advantage over simple baselines is claimed.
18. **Target and candidate choices are analysis choices.** The target airflow band below {{VENT_MIN}} cm/s (down to 0.5 cm/s) is an analysis extension of the documented {{VENT_MIN}} to {{VENT_MAX}} cm/s ventilation band. Null nominals are replaced by documented bounds and flagged. The candidate domain (O2 12 to 40 %, pressure 50 to 103 kPa, airflow 0.5 to 45 cm/s) is a documented default, not a recommendation.
19. **Model/dataset version drift.** If the dataset is rebuilt after training, the API computes model quantities from the fitted model's own training coordinates and adds a version note to the assumptions; retrain to remove the mismatch.

## Software and deployment

20. **Static snapshot deployment** serves precomputed responses for documented profiles and groups; custom targets and arbitrary candidates require the live analysis service (the interface says so).
21. **Verification status.** Commands in the README were run locally (macOS). No Vercel deployment, container build or load test was performed. Latest recorded test status: {{TEST_STATUS}}
22. **Environment quirk.** On macOS with iCloud Desktop the editable-install `.pth` can be hidden and `import blindspots` fails after `uv sync`; run `chflags nohidden .venv/lib/python3.12/site-packages/*.pth` or set `PYTHONPATH=src`.
23. **No project licence file** is present yet; data licences are as stated in section "Licence and attribution" of the README.
