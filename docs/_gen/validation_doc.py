from __future__ import annotations

from frag import ci, f2, f3, model, pct, table, verdict_vs_majority

HEAD = """# Validation

Generated from `{mdir}/validation.json` (dataset `{DV}`, model `{MV}`, validation generated {VAL_GEN}) and
`{retro_path}`. Every number on this page is copied from those artifacts by a script; nothing is typed by hand.
Regenerate the page after any dataset rebuild or retrain. Plain factual reporting: the results describe the
integrated NASA records only and are not an experimental validation of fire safety.

## Protocol

- Unit of observation: one flow step of one test. Steps of one test are correlated, so everything is grouped by
  experiment (D-005).
- Repeated grouped K-fold by experiment: k = min({CV_K}, number of experiments), {CV_REPEATS} repeats (seeds 0 to 4). GP hyperparameters are
  refit inside every training fold only. The GP pressure length scale is fixed at {LP} (ln-pressure units) and is not learned.
- Headline metrics use the out-of-fold predictions of all repeats stacked. 95% CIs are percentile intervals from a group
  bootstrap ({N_BOOT} draws, whole experiments resampled). Brier and log loss: lower is better. ECE uses 10 equal-width bins and is
  biased upward in small samples, so its bootstrap interval can exclude the point value.
- Baselines: majority class (Laplace-smoothed training prevalence), logistic on O2, logistic on O2 + flow + flow^2, bootstrap
  logistic ensemble ({ENSEMBLE} members). Majority-class AUC is 0.5 by definition.
- {MEAN_SENTENCE}
- Groups below the modelability rule (D-007: at least {MIN_EXP} training experiments, at least 3 sustained and 3 not-sustained
  rows, not-sustained rows in at least 2 experiments) are not modelled; they appear in coverage only:

{NOT_MODELLED_TABLE}

## Read this first

- Class imbalance is large. Across the {N_MODELLED} modelled groups the majority class is {MAJ_MIN} to {MAJ_MAX} of the rows, and the
  majority-class baseline is hard to beat on log loss. In {N_GP_BETTER} of {N_MODELLED} groups the GP log loss is better than the majority
  class with a CI that excludes 0 ({GP_BETTER_GROUPS}); in {N_GP_INDIST} it is not distinguishable; in {N_GP_WORSE} it is worse.
- Sample sizes are small ({N_EXP_MIN} to {N_EXP_MAX} experiments per group, {N_NEG_MIN} to {N_NEG_MAX} not-sustained rows per group). Intervals are
  wide and point estimates are unstable.
- Not-sustained rows of type `flow_off_transient` (flow turned off, ~0 cm/s) are not a physical quench boundary, and brief-flame rows
  (`no_sustained_propagation`) are not extinction events at a flow setting either. Share of each group's not-sustained rows (from the sensitivity rows below):

{FLOWOFF_TABLE}

  Groups where at least 80% of the not-sustained rows are flow-off transients: {FLOWOFF_GROUPS}. Any large gain over the majority class in those
  groups mostly reflects "flow near zero means label 0", not a learned flammability boundary. Grouped-CV AUC of the GP before and after dropping the flow-off rows
  (sensitivity rows below): {FLOWOFF_AUC}.
- Many near-quench negatives rely on the documented below-calibration flow interpolation (flow values below the calibrated range are extrapolated and flagged `below_calibration_range`). Dropping those rows leaves: {BELOWCAL_RELIANT}. Groups not listed keep at least half of their rows and negatives.
- The GP clearly beats the majority-class baseline (CI of the paired log-loss difference excludes 0) only in: {GP_BETTER_GROUPS}. In {GP_INDIST_GROUPS} it is roughly at the baseline (CI includes 0). Groups that beat the baseline without being dominated by flow-off negatives: {GP_BETTER_NOT_FLOWOFF}.
- Pressure: all integrated observations lie at {P_MIN:.1f} to {P_MAX:.1f} kPa and the pressure length scale is fixed. At low pressure (for example 34 % O2 at 56.5 kPa) the posterior reverts to the prior: the model reports `insufficient_evidence` (latent std ratio about 1.0) and a probability near the prior mean level (about 0.6 in the groups checked), which is reversion and not a pressure effect. The API still returns `p_sustained` next to the verdict; the interface does not present it as an estimate for `insufficient_evidence` targets.
- Every integrated observation is near 1 atm ({P_MIN:.1f} to {P_MAX:.1f} kPa; BASS measured, BASS-II assumed). The pressure length scale cannot be
  learned; the 0.15 / 0.3 / 0.6 sensitivity rows change the cross-validated log loss by at most {LP_MAX_DELTA} (absolute, any group), which is expected
  because pressure does not vary. Any pressure extrapolation is assumption-driven.
- The confidence subgroup rows are not a measure of curation quality: {CONFHIGH_MIN} to {CONFHIGH_MAX} of each group's not-sustained rows have confidence
  "high" (explicit outcome tokens), whereas most sustained rows are "medium" (implied by list order), so confidence is confounded with the label.

## Summary across groups

Value [95% CI]; log loss and Brier lower is better. "GP minus majority" is the group-bootstrap CI of the paired difference.

{VAL_HEADLINE_TABLE}

## Blind-spot test (all groups)

Question: does the model flag, before the outcome is revealed, the regions where it is worse on withheld experiments?
Point level: Spearman rho between pre-reveal epistemic uncertainty (mutual information) and per-point log loss on out-of-fold
predictions ({N_PERM}-permutation one-sided p; points are treated as exchangeable, so this p is optimistic). Experiment level: leave-one-experiment-out
refits (hyperparameters refit for each held-out experiment), mean epistemic uncertainty versus mean log loss per held-out experiment
({N_PERM} permutations, one-sided). Verdict rule: supported if rho > 0 with p < 0.05 at both levels; not supported if rho <= 0 at both; otherwise inconclusive.
The smallest reportable p is 1/{P_FLOOR}.

{BLINDSPOT_TABLE}

Result as computed: {BS_SUPPORTED} supported, {BS_INCONCLUSIVE} inconclusive, {BS_NOT_SUPPORTED} not supported out of {N_MODELLED} groups.
Supported: {BS_SUPPORTED_GROUPS}. Inconclusive: {BS_INCONC_GROUPS}.

Reading: where the verdict is "supported", epistemic uncertainty and loss rise together. But aleatoric (predictive-entropy)
uncertainty tracks loss at least as strongly as epistemic uncertainty in {N_ALEA_GE_EPI} of {N_MODELLED} groups (point-level rho), and the partial correlation
of epistemic uncertainty given aleatoric uncertainty ranges from {PARTIAL_MIN} to {PARTIAL_MAX}. The partial correlation is the better indicator of added value.
With {MIN_MISCLASS} to {MAX_MISCLASS} misclassified points per group, the AUROC rests on very few events. Treat the result as an association in small samples,
not proof that the model flags its own blind spots.

## Target-aware acquisition: retrospective evaluation

{RETRO_SECTION}

## Per-group results
"""

GROUP = """
### {gid}

{label}. Campaigns: {campaigns}. **{n_exp} experiments, {n_obs} observations: {sust} sustained / {nsust} not sustained (majority class = {maj}).**
GP mean function: `{mean}`. {warn}

Cross-validation ({scheme}), value [95% CI]:

{cv_table}

GP minus majority class: log loss {dll}, Brier {dbr}: {verdict}.

Calibration (GP, pooled predictions; non-empty bins: count, mean predicted, observed frequency): {calib}. Counts pool the {reps} repeats, so they are {reps} times the row counts.

{logo}

Sensitivity (GP, same CV, evaluated on each variant's own rows; delta = variant log loss minus primary, not like-for-like when the rows differ):

{sens_table}

Subgroups (GP out-of-fold):

{sub_table}

Blind-spot test: **{bverdict}**. {binterp}
"""


def group_section(g, reps):
    lc = g["label_counts"]
    models = g["cv"]["models"]
    cv_rows = [
        (m["name"], ci(m["brier"]), ci(m["log_loss"]), ci(m["auc"]), ci(m["ece"])) for m in models
    ]
    d = g["cv"]["gp_vs_majority"]
    calib = "; ".join(
        f"[{b['lo']:.1f},{b['hi']:.1f}) n={b['count']} pred {b['mean_predicted']:.2f} obs {b['observed_frequency']:.2f}"
        for b in g["reliability"]["bins"]
        if b["count"]
    )
    logo = g["logo"]
    if logo["applicable"]:
        rows = [
            (
                f["held_out"],
                f["n"],
                f["n_not_sustained"],
                f3(f["brier"]),
                f3(f["log_loss"]),
                f3(f["auc"]),
                f3(f["majority_log_loss"]),
            )
            for f in logo["folds"]
        ]
        logo_s = (
            "Leave-one-campaign-out (GP vs majority log loss; n rows and not-sustained rows in the held-out campaign):\n\n"
            + table(
                ["held-out campaign", "n", "not sustained", "GP Brier", "GP log loss", "GP AUC", "majority log loss"],
                rows,
            )
        )
    else:
        logo_s = f"Leave-one-campaign-out: not applicable ({logo.get('reason', 'single campaign')})."
    sens = [
        (
            s["variant"],
            s["n_training"],
            s["n_not_sustained"],
            f3(s["brier"]),
            f3(s["log_loss"]),
            f3(s["auc"]),
            f3(s["delta_vs_primary"]),
        )
        for s in g["sensitivity"]
    ]
    sub = [(s["name"], s["n"], s["n_not_sustained"], f3(s["brier"]), f3(s["log_loss"])) for s in g["subgroups"]]
    b = g["blindspot_test"]
    return GROUP.format(
        gid=f"`{g['group_id']}`",
        label=g["label"],
        campaigns=", ".join(g["campaigns"]),
        n_exp=g["n_experiments"],
        n_obs=g["n_observations"],
        sust=lc["sustained"],
        nsust=lc["not_sustained"],
        maj=pct(g["majority_class_fraction"]),
        mean=g["cv"]["gp_mean_function"],
        warn=g.get("small_sample_warning", ""),
        scheme=g["cv"]["scheme"],
        cv_table=table(["model", "Brier", "log loss", "AUC", "ECE"], cv_rows),
        dll=ci(d["log_loss"]),
        dbr=ci(d["brier"]),
        verdict=verdict_vs_majority(g),
        calib=calib,
        reps=reps,
        logo=logo_s,
        sens_table=table(
            ["variant", "n rows", "not sustained", "Brier", "log loss", "AUC", "delta log loss"], sens
        ),
        sub_table=table(["subgroup", "n", "not sustained", "Brier", "log loss"], sub),
        bverdict=b["verdict"],
        binterp=b["interpretation"],
    )


def retro_section(X):
    if not X["RETRO"]:
        return "No retrospective artifact was found for this dataset version (run `uv run blindspots retrospective`)."
    return f"""Design (copied from the artifact): per modelled group with at least 12 training experiments, target experiments (a lowest-O2 quartile, a
lowest-minimum-airflow quartile and one campaign) are held out of the pool. Each of {X['R_SEEDS']} seeds draws 3 random pool experiments with both labels as the
initial training set; then up to {X['R_ROUNDS']} rounds, each strategy picking one whole experiment from the remaining pool. EVR = expected variance reduction of the
target latent function. Baselines: uncertainty sampling, nearest gap, random. Metric: log loss (and Brier) on the held-out target observations, which never enter
fitting. A constant majority-class prediction is reported for reference.

Summary over {X['R_N']} pseudo-target scenarios (95% bootstrap CIs over seeds on the paired difference of the area under the target log-loss curve):

- EVR versus random: better in {X['R_RAND_B']}, indistinguishable in {X['R_RAND_I']}, worse in {X['R_RAND_W']}.
- EVR versus uncertainty sampling: better in {X['R_UNC_B']}, indistinguishable in {X['R_UNC_I']}, worse in {X['R_UNC_W']}.
- EVR versus nearest gap: better in {X['R_GAP_B']}, indistinguishable in {X['R_GAP_I']}, worse in {X['R_GAP_W']}.
- Final-round EVR target log loss was below the constant majority-class baseline in {X['R_BELOW_EVR']} of {X['R_N']} scenarios (random: {X['R_BELOW_RANDOM']} of {X['R_N']}).
- In {X['R_DEGENERATE']} of {X['R_N']} scenarios all four strategies end within 0.0005 of the same final log loss. {X['R_SMALL_POOL']} of {X['R_N']} scenarios have at most {X['R_ROUNDS']} experiments left in the pool after the 3 initial ones, so the strategies can acquire every pool experiment and only the path (area under the curve) differs.
- Scenarios skipped by the design: {X['R_SKIPPED']}.

Limitations (from the artifact):

{X['R_LIMITS']}

Honest reading: the artifact's own interpretation is "{X['R_INTERP']}" EVR is not shown to be reliably better than the baselines; it is a principled
target-aware score whose retrospective advantage, where present, is small-sample evidence only.

Per scenario (AUC difference of the target log-loss curve; negative favours EVR; tag from the CI):

{X['RETRO_TABLE']}
"""


def build_validation(F, X):
    val = F["val"]
    groups = val["groups"]
    fr = [g["majority_class_fraction"] for g in groups]
    X2 = dict(X)
    X2["MAJ_MIN"], X2["MAJ_MAX"] = pct(min(fr)), pct(max(fr))
    X2["P_MIN"], X2["P_MAX"] = X["ts"]["p_min"], X["ts"]["p_max"]
    X2["P_FLOOR"] = X["N_PERM"] + 1
    X2["RETRO_SECTION"] = retro_section(X)
    out = HEAD.format(mdir=F["mdir"], retro_path=F["retro_path"], **{k: v for k, v in X2.items() if k not in ("ts", "mdir", "retro_path")})
    for g in groups:
        out += group_section(g, X["CV_REPEATS"])
    out += """
## Limitations of this validation

- Observations are ordered flow schedules; most "sustained" rows are sustained by list order and the final unrecorded setting is omitted, so the
  boundary is thinly observed.
- Flow values are mostly derived (borrowed calibration, linear extrapolation below the calibrated range); the "drop below_calibration_range rows"
  sensitivity rows show the dependence.
- O2 is partly confounded with campaign; leave-one-campaign-out folds are small (see n).
- Results describe the integrated records only. They say nothing about conditions covered by investigations that are not integrated (for example
  SoFIE-GEL, Saffire-V/VI): those conditions are not represented in the integrated records.
- Pressure is effectively constant; no pressure effect can be validated.
"""
    return out
