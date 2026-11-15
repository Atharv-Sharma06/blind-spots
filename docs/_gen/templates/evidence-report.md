# Evidence report

What the data support, what the model learned from them, how well it performs against simple baselines, whether its uncertainty was useful, how the recommendation rule was evaluated, and what remains unsupported.
All numbers are copied from the artifacts by script (dataset `{{DV}}`, model `{{MV}}`, validation generated {{VAL_GEN}}); full tables are in [validation.md](validation.md). Plain reporting; no claim of experimental validation beyond the integrated records.

## 1. Which data were used and which were excluded

- {{N_INV}} investigations are catalogued; the model uses PSI-25 (BASS-II) and PSI-26 (BASS). Context-only records (Saffire, DARTFire, drop tower) never enter a model ({{N_CONTEXT_EXP}} experiments across context investigations in this build).
- {{N_EXP}} experiments and {{N_OBS}} flow-step observations were integrated; {{N_TRAIN_EXP}} experiments and {{N_TRAIN_OBS}} observations were used for training ({{POS}} sustained, {{NEG}} not sustained: {{POS_PCT}} sustained).
  Observation labels over all rows: {{LABEL_COUNTS_ALL}}.
- Training observations by campaign: {{CAMPAIGN_TRAIN}}.

Excluded observations (count by reason; {{EXCL_OBS_TOTAL}} of {{N_OBS}}):

{{EXCL_OBS_TABLE}}

Excluded experiments (count by reason; {{EXCL_EXP_TOTAL}} of {{N_EXP}}):

{{EXCL_EXP_TABLE}}

The largest exclusion is low curation confidence ({{EXCL_OBS_LOWCONF}} observations); those rows are kept in the records and tested in a sensitivity analysis ("add low-confidence rows" in [validation.md](validation.md)).
Of the modelled groups, {{N_MODELLED}} met the modelability rule; {{N_NOT_MODELLED}} groups have coverage only ({{NOT_MODELLED_LIST}}).

Modelled groups (training rows):

{{GROUPS_TABLE}}

## 2. What the data look like (and why that limits the claims)

- {{POS_PCT}} of training rows are "sustained"; the majority-class baseline is therefore strong. Not-sustained modes: {{NEG_MODES}}.
- {{FLOW_OFF}} not-sustained rows are flow-off transients (flow turned off, ~0 cm/s). In {{N_FLOWOFF_GROUPS}} groups at least 80% of the not-sustained rows are such transients: {{FLOWOFF_GROUPS}}.
- Operating conditions covered by the training rows: O2 {{O2_MIN}} to {{O2_MAX}} %, airflow {{U_MIN}} to {{U_MAX}} cm/s, pressure {{P_MIN}} to {{P_MAX}} kPa (that is, about 1 atm; BASS-II pressure is an assumed value).
- {{T_BELOW_CAL}} of {{N_TRAIN_OBS}} training rows have airflow below the calibrated range (linear extrapolation); {{T_O2_INTERP}} have interpolated O2.

## 3. What the model learned

Per-group GP classifiers. The table shows the learned length scales (how far O2 or flow must change before the latent function changes appreciably) and the predicted probability of a sustained flame at 1 atm at the 10th and 90th percentile
of each group's training O2 and flow.

{{LEARNED_TABLE}}

Qualitative reading of the table (commentary written for dataset `{{DV}}`; re-read it if the model is retrained):

- In most groups P(sustained) is highest at high O2 and high flow and lower in the low-flow corners (for example `pmma_thin_film__opposed` and `sibal_fabric__concurrent`).
- Visible exceptions: in `pmma_rod__stagnation` the low-O2, high-flow corner is the lowest (blow-off rows at high flow and brief-flame rows, all at low O2 in the training data); in `pmma_sphere__wake` and `pmma_sphere__stagnation` raising O2 at low flow does not raise P(sustained), because their not-sustained rows are mostly flow-off transients at ~0 cm/s, so the model has mostly learned "flow near zero means no flame", which is not a physical quench boundary.
- O2 effects are weakly identified where the training O2 range is narrow (see the percentile column) and O2 is partly confounded with campaign.
- Pressure was not learned: the pressure length scale is fixed at {{LP}} ln units because every observation is at about 1 atm. Predictions at other pressures are assumption-driven.

## 4. Performance against baselines (grouped cross-validation, with CIs)

Grouped {{CV_K}}-fold by experiment x {{CV_REPEATS}} repeats; log loss, lower is better; 95% group-bootstrap CIs ({{N_BOOT}} draws). The majority-class baseline predicts the training prevalence everywhere.

{{ALL_MODELS_TABLE}}

Paired comparison of the GP with the majority class (negative = GP better), plus Brier and AUC:

{{VAL_HEADLINE_TABLE}}

Reading:

- The GP beats the majority class on log loss with a CI that excludes 0 in {{N_GP_BETTER}} of {{N_MODELLED}} groups ({{GP_BETTER_GROUPS}}); it is not distinguishable in {{N_GP_INDIST}} and worse in {{N_GP_WORSE}}.
- Of the groups where the GP wins, {{N_FLOWOFF_IN_BETTER}} are groups whose not-sustained rows are mostly flow-off transients, where the gain mostly reflects "flow near zero means no flame". Removing those rows (sensitivity table in [validation.md](validation.md)) leaves one or no negatives in some groups, so the win cannot be re-evaluated there.
- Groups where the GP is not distinguishable from the majority class: {{GP_INDIST_GROUPS}}. With this much imbalance and this few experiments, the model's discrimination is modest and uncertain in those groups.
- Leave-one-campaign-out ({{LOGO_N}} held-out campaigns across groups with more than one campaign; the GP log loss is higher than the majority-class log loss in {{LOGO_WORSE}} of them) is a harder test because O2 is partly confounded with campaign; several folds have very few rows or not-sustained rows:

{{LOGO_TABLE}}

## 5. Was the uncertainty useful? (blind-spot test)

The test asks whether the model's epistemic uncertainty, computed before an outcome is revealed, ranks where it makes larger errors on withheld experiments (point level on out-of-fold predictions, experiment level with leave-one-experiment-out refits).
Verdict rule: supported if rho > 0 with p < 0.05 at both levels; not supported if rho <= 0 at both; otherwise inconclusive.

{{BLINDSPOT_TABLE}}

Verdicts as computed: **{{BS_SUPPORTED}} supported, {{BS_INCONCLUSIVE}} inconclusive, {{BS_NOT_SUPPORTED}} not supported** of {{N_MODELLED}} groups (supported: {{BS_SUPPORTED_GROUPS}}; inconclusive: {{BS_INCONC_GROUPS}}).

Caveats that matter: aleatoric uncertainty tracks loss at least as strongly as epistemic uncertainty in {{N_ALEA_GE_EPI}} of {{N_MODELLED}} groups; the partial correlation of epistemic uncertainty given aleatoric uncertainty is {{PARTIAL_MIN}} to {{PARTIAL_MAX}}, so epistemic uncertainty has not been shown to add information beyond the model's overall predictive uncertainty.
Point-level p-values treat points as exchangeable and are optimistic; with {{MIN_MISCLASS}} to {{MAX_MISCLASS}} misclassified points per group the AUROC rests on very few events.
Conclusion: uncertainty is informative about error in the groups marked supported, in small imbalanced samples; it is not a guarantee, and in the other groups the evidence is inconclusive.

## 6. How the recommendation algorithm was evaluated

{{RETRO_SECTION}}

## 7. What remains unsupported

- **Any pressure other than about 1 atm.** Candidate and target conditions at reduced pressure (for example 56 to 70 kPa exploration atmospheres) are extrapolations that depend on the fixed pressure length scale {{LP}}; the sensitivity check does not validate them.
- **Elevated-O2 conditions** beyond the integrated O2 range ({{O2_MIN}} to {{O2_MAX}} %) are not represented in the integrated records. Other NASA investigations (for example SoFIE-GEL with 13 to 34 % O2 and 0.15 to 1.1 atm, and Saffire-V/VI at reduced pressure and elevated O2) cover some of them but are not integrated, because no public per-test data were found or they are large-scale tests; the model says nothing about their outcomes.
- **Materials other than PMMA and SIBAL fabric** in microgravity: the other groups lack enough experiments and outcomes of both kinds to be modelled ({{NOT_MODELLED_LIST}}).
- **Physical quench boundaries**: many label-0 rows are transients or brief flames; the true flammability boundary is thinly observed.
- **Causal or mechanistic claims**: the model is a statistical interpolator of ordered flow-step outcomes, not a combustion model.
- **Retrospective advantage of the recommendation rule**: not established (see section 6).
- **Fire-safety certification, material qualification or any operational guidance**: out of scope; candidates are computational research candidates requiring qualified scientific review, established safety procedures and formal feasibility assessment.
