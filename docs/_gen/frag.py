"""Fragments (tables and sentences) computed from artifacts."""

from __future__ import annotations

from collections import Counter

from facts import training_summary


def f3(x):
    return "n/a" if x is None else f"{x:.3f}"


def f2(x):
    return "n/a" if x is None else f"{x:.2f}"


def ci(d, nd=3):
    if d is None or d.get("value") is None:
        return "n/a"
    lo, hi = d["ci95"]
    return f"{d['value']:.{nd}f} [{lo:.{nd}f}, {hi:.{nd}f}]"


def pct(x, nd=0):
    return f"{100 * x:.{nd}f}%"


def table(header, rows):
    out = ["| " + " | ".join(header) + " |", "|" + "|".join("---" for _ in header) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(c) for c in r) + " |")
    return "\n".join(out)


def verdict_vs_majority(g):
    d = g["cv"]["gp_vs_majority"]["log_loss"]
    lo, hi = d["ci95"]
    if hi < 0:
        return "GP better (CI excludes 0)"
    if lo > 0:
        return "GP worse (CI excludes 0)"
    return "not distinguishable (CI includes 0)"


def model(g, name):
    return next(m for m in g["cv"]["models"] if m["name"] == name)


def build(F: dict) -> dict:
    X: dict = {}
    rep, val, man = F["report"], F["val"], F["manifest"]
    c = rep["counts"]
    ts = training_summary(F)
    X["ts"] = ts
    X["DV"] = F["dataset_version"]
    X["MV"] = man["model_version"]
    X["TRAINED_AT"] = man["trained_at"]
    X["VAL_GEN"] = val["generated_at"]
    X["N_INV"] = c["investigations"]
    X["N_EXP"] = c["experiments"]
    X["N_OBS"] = c["observations"]
    X["N_TRAIN_EXP"] = ts["n_exp"]
    X["N_TRAIN_OBS"] = ts["n"]
    X["POS"], X["NEG"] = ts["pos"], ts["neg"]
    X["POS_PCT"] = pct(ts["frac_pos"])
    X["FLOW_OFF"] = ts["flow_off"]
    X["N_PROFILES"] = len([p for p in F["profiles"]["profiles"]])
    groups = val["groups"]
    X["N_MODELLED"] = len(groups)
    X["N_NOT_MODELLED"] = len(val["not_modelled"])
    opts = man["config"]["mean_options"]
    X["MEAN_OPTIONS"] = ", ".join(opts)
    if len(opts) > 1:
        X["MEAN_SENTENCE"] = (
            "Mean function per group ("
            + " vs ".join(opts)
            + ") is chosen by repeated grouped-CV log loss; linear in O2 is used only when the 95% group-bootstrap CI "
            "of the log-loss difference is entirely below zero (MS-002)."
        )
        X["MEAN_SHORT"] = "mean function chosen by grouped CV (" + ", ".join(opts) + ")"
    else:
        X["MEAN_SENTENCE"] = (
            f"Mean function: `{opts[0]}` only. This is the `mean_options` setting of this model version's training configuration; the grouped-CV selection between a constant and a linear-in-O2 mean "
            "(MS-002) exists in the code but is not used by this configuration. Every group therefore uses a constant GP mean fixed a priori; there is no mean-function selection."
        )
        X["MEAN_SHORT"] = f"`{opts[0]}` mean function (the only option in this model version's configuration)"
    X["CV_REPEATS"] = groups[0]["cv"]["repeats"]
    X["CV_K"] = groups[0]["cv"]["k"]
    X["N_BOOT"] = man["config"]["n_bootstrap"]
    X["N_PERM"] = man["config"]["n_permutations"]
    X["ENSEMBLE"] = man["config"]["ensemble_members"]
    X["LP"] = man["config"]["pressure_length_scale"]
    X["MIN_EXP"] = 6

    # --- integrated records by investigation
    inv_rows = []
    for i in F["inv"]:
        if i["n_experiments"] or i["role"] in ("integrated_model", "integrated_context"):
            inv_rows.append(
                (
                    i["investigation_id"],
                    i["acronym"],
                    i["role"],
                    i["n_experiments"],
                    i["n_observations"],
                    i.get("doi") or "n/a",
                )
            )
    X["INV_TABLE"] = table(["id", "name", "role", "experiments", "flow-step observations", "DOI"], inv_rows)
    X["N_CATALOGUED_ONLY"] = sum(1 for i in F["inv"] if i["role"] == "catalogued_not_integrated")
    X["N_CONTEXT_EXP"] = sum(i["n_experiments"] for i in F["inv"] if i["role"] == "integrated_context")
    X["N_MODEL_EXP"] = sum(i["n_experiments"] for i in F["inv"] if i["role"] == "integrated_model")
    X["N_PSI25"] = c["experiments_by_investigation"].get("PSI-25")
    X["N_PSI26"] = c["experiments_by_investigation"].get("PSI-26")
    X["N_PSI25_OBS"] = c["observations_by_investigation"].get("PSI-25")
    X["N_PSI26_OBS"] = c["observations_by_investigation"].get("PSI-26")

    # --- exclusions
    ex = rep["exclusions"]
    X["EXCL_OBS_TABLE"] = table(
        ["reason (observations)", "count"],
        sorted(ex["observations_by_reason"].items(), key=lambda kv: -kv[1]),
    )
    X["EXCL_EXP_TABLE"] = table(
        ["reason (experiments)", "count"],
        sorted(ex["experiments_by_reason"].items(), key=lambda kv: -kv[1]),
    )
    X["EXCL_OBS_TOTAL"] = sum(ex["observations_by_reason"].values())
    X["EXCL_OBS_LOWCONF"] = ex["observations_by_reason"].get("low_confidence", 0)
    X["EXCL_EXP_TOTAL"] = sum(ex["experiments_by_reason"].values())
    X["N_LABEL_NULL"] = c["observations_by_label"].get("null", 0)
    X["LABEL_COUNTS_ALL"] = (
        f"label 1 (sustained) {c['observations_by_label'].get('1')}, "
        f"label 0 (not sustained) {c['observations_by_label'].get('0')}, "
        f"no label {c['observations_by_label'].get('null')}"
    )
    X["TRAIN_CONF"] = ", ".join(f"{k} {v}" for k, v in sorted(ts["confidence"].items()))
    X["NEG_MODES"] = ", ".join(f"{k} {v}" for k, v in sorted(ts["neg_modes"].items(), key=lambda kv: -kv[1]))
    X["BASIS"] = ", ".join(f"{k} {v}" for k, v in sorted(ts["basis"].items(), key=lambda kv: -kv[1]))
    X["CAMPAIGN_TRAIN"] = ", ".join(
        f"{k} {v}" for k, v in sorted(ts["campaign"].items(), key=lambda kv: -kv[1])
    )
    ev = rep.get("evidence", {})
    X["TM_STEPS"] = ev.get("steps_with_tm_evidence")
    X["TM_STEPS_TRAIN"] = ev.get("steps_with_tm_evidence_in_training")
    X["TM_TESTS"] = ev.get("tests_with_tm_evidence_steps")
    X["TM_NOTES"] = ev.get("experiments_with_tm_notes")
    cc = ev.get("configuration_changes_vs_previous_labels", {})
    X["CFG_CHANGED"] = cc.get("n_changed")
    X["CFG_TRANSITIONS"] = ", ".join(f"{k}: {v}" for k, v in cc.get("by_transition", {}).items())
    X["N_CONTEXT_RECORDS"] = ev.get("n_context_records")
    X["CONTEXT_BY_SOURCE"] = "; ".join(
        f"{k}: {v}" for k, v in ev.get("context_records_by_source", {}).items()
    )
    qf = rep["quality_flags"]["observations"]
    X["FLAG_BELOW_CAL_ALL"] = qf.get("below_calibration_range")
    X["FLAG_BORROWED_ALL"] = qf.get("calibration_borrowed_from_bass2")
    X["FLAG_FLOW_OFF_ALL"] = qf.get("flow_off_transient")
    X["FLAG_NOSUST_ALL"] = qf.get("no_sustained_propagation")
    X["FLAG_O2_INTERP_ALL"] = qf.get("o2_interpolated")
    X["FLAG_PRESSURE_ASSUMED_ALL"] = qf.get("pressure_assumed")
    X["N_PROVENANCE_FAIL"] = len(rep["provenance_failures"]["observations"]) + len(
        rep["provenance_failures"]["experiments"]
    )
    X["N_CURATION_PROBLEMS"] = len(rep["curation_problems"])
    X["EXP_POSSIBLE_DUP"] = ", ".join(" vs ".join(p) for p in rep["duplicates"]["possible_duplicates"])

    # --- groups table
    rows = []
    for g in groups:
        lc = g["label_counts"]
        rows.append(
            (
                f"`{g['group_id']}`",
                g["n_experiments"],
                g["n_observations"],
                lc["sustained"],
                lc["not_sustained"],
                pct(g["majority_class_fraction"]),
                g["cv"]["gp_mean_function"],
                ", ".join(g["campaigns"]),
            )
        )
    X["GROUPS_TABLE"] = table(
        [
            "group",
            "training experiments",
            "training observations",
            "sustained",
            "not sustained",
            "majority class",
            "GP mean",
            "campaigns",
        ],
        rows,
    )
    nm = val["not_modelled"]
    X["NOT_MODELLED_TABLE"] = table(
        ["group (coverage only)", "reason it is not modelled"], [(f"`{k}`", v) for k, v in sorted(nm.items())]
    )
    X["NOT_MODELLED_LIST"] = ", ".join(f"`{k}`" for k in sorted(nm))
    # default UI group
    try:  # same rule as /api/groups is_default (needs PYTHONPATH=services/analysis/src)
        from blindspots.api import deps as _deps

        X["DEFAULT_GROUP"] = _deps.default_group_id(_deps.require_store())
    except Exception:
        X["DEFAULT_GROUP"] = max(groups, key=lambda g: g["n_observations"])["group_id"]

    # --- headline validation table
    rows = []
    cnt = Counter()
    for g in groups:
        gp, mj = model(g, "gp"), model(g, "majority_class")
        d = g["cv"]["gp_vs_majority"]
        v = verdict_vs_majority(g)
        cnt[v.split(" (")[0]] += 1
        rows.append(
            (
                f"`{g['group_id']}`",
                g["n_experiments"],
                f"{g['label_counts']['sustained']}/{g['label_counts']['not_sustained']}",
                ci(gp["log_loss"]),
                ci(mj["log_loss"]),
                ci(d["log_loss"]),
                ci(gp["brier"]),
                ci(mj["brier"]),
                ci(gp["auc"]),
                v,
            )
        )
    X["VAL_HEADLINE_TABLE"] = table(
        [
            "group",
            "exp.",
            "sust./not sust.",
            "GP log loss [95% CI]",
            "majority log loss",
            "GP minus majority log loss",
            "GP Brier",
            "majority Brier",
            "GP AUC",
            "log loss vs majority",
        ],
        rows,
    )
    X["N_GP_BETTER"] = cnt["GP better"]
    X["N_GP_INDIST"] = cnt["not distinguishable"]
    X["N_GP_WORSE"] = cnt["GP worse"]
    better = [g["group_id"] for g in groups if verdict_vs_majority(g).startswith("GP better")]
    X["GP_INDIST_GROUPS"] = (
        ", ".join(
            f"`{g['group_id']}`" for g in groups if verdict_vs_majority(g).startswith("not distinguishable")
        )
        or "none"
    )
    X["GP_BETTER_GROUPS"] = ", ".join(f"`{x}`" for x in better) or "none"
    # share of negatives that are flow-off transients / brief flames
    fo_rows, fo_ids = [], []
    conf = []
    for g in groups:
        neg = g["label_counts"]["not_sustained"]
        sv = {s["variant"]: s for s in g["sensitivity"]}
        left_fo = sv["drop flow_off_transient rows"]["n_not_sustained"]
        left_ns = sv["drop no_sustained_propagation rows"]["n_not_sustained"]
        n_fo, n_ns = neg - left_fo, neg - left_ns
        fo_rows.append((f"`{g['group_id']}`", neg, n_fo, pct(n_fo / neg), n_ns, pct(n_ns / neg)))
        if n_fo / neg >= 0.8:
            fo_ids.append(f"`{g['group_id']}` ({n_fo} of {neg})")
        sub = {s["name"]: s for s in g["subgroups"]}
        hi = sub.get("confidence high")
        if hi and neg:
            conf.append(hi["n_not_sustained"] / neg)
    X["FLOWOFF_TABLE"] = table(
        [
            "group",
            "not-sustained rows",
            "of which flow_off_transient",
            "share",
            "of which no_sustained_propagation (brief flame)",
            "share",
        ],
        fo_rows,
    )
    # CV AUC with and without the flow-off rows, for groups dominated by them; reliance on below-calibration rows
    auc_parts, below_parts = [], []
    for g in groups:
        neg = g["label_counts"]["not_sustained"]
        sv = {s["variant"]: s for s in g["sensitivity"]}
        fo = sv["drop flow_off_transient rows"]
        gp_auc = next((m["auc"]["value"] for m in g["cv"]["models"] if m.get("name") == "gp"), None)
        if (neg - fo["n_not_sustained"]) / neg >= 0.8 and gp_auc is not None:
            if fo.get("auc") is None:
                auc_parts.append(
                    f"`{g['group_id']}` has no other negatives (CV AUC {gp_auc:.2f} with them; not evaluable without)"
                )
            else:
                auc_parts.append(f"`{g['group_id']}` {gp_auc:.2f} to {fo['auc']:.2f}")
        bc = sv["drop below_calibration_range rows"]
        n_all = g["label_counts"]["sustained"] + neg
        if bc["n_training"] < 0.5 * n_all or bc["n_not_sustained"] < 0.5 * neg:
            below_parts.append(
                f"`{g['group_id']}` ({bc['n_training']} of {n_all} training rows and {bc['n_not_sustained']} of {neg} negatives remain)"
            )
    X["FLOWOFF_AUC"] = "; ".join(auc_parts) or "none"
    X["BELOWCAL_RELIANT"] = "; ".join(below_parts) or "none"
    fo_set = {x.split("`")[1] for x in fo_ids}
    X["GP_BETTER_NOT_FLOWOFF"] = ", ".join(f"`{x}`" for x in better if x not in fo_set) or "none"
    X["FLOWOFF_GROUPS"] = ", ".join(fo_ids) or "none"
    X["N_FLOWOFF_GROUPS"] = len(fo_ids)
    X["CONFHIGH_MIN"], X["CONFHIGH_MAX"] = (pct(min(conf)), pct(max(conf))) if conf else ("n/a", "n/a")
    X["N_EXP_MIN"] = min(g["n_experiments"] for g in groups)
    X["N_EXP_MAX"] = max(g["n_experiments"] for g in groups)
    X["N_NEG_MIN"] = min(g["label_counts"]["not_sustained"] for g in groups)
    X["N_NEG_MAX"] = max(g["label_counts"]["not_sustained"] for g in groups)

    # --- blind-spot table
    rows = []
    vc = Counter()
    for g in groups:
        b = g["blindspot_test"]
        p, gl, d = b["point_level"], b["group_level"], b["diagnostics"]
        vc[b["verdict"]] += 1
        rows.append(
            (
                f"`{g['group_id']}`",
                p["n"],
                f2(p["spearman_rho"]),
                f"{p['p_value']:.4f}",
                f"{f2(p['auroc_error_detection'])} (of {p['n_misclassified']})",
                gl["n_groups"],
                f2(gl["spearman_rho"]),
                f"{gl['p_value']:.4f}",
                f2(d["rho_aleatoric_point"]),
                f2(d["partial_rho_epistemic_given_aleatoric"]),
                f"**{b['verdict']}**",
            )
        )
    X["BLINDSPOT_TABLE"] = table(
        [
            "group",
            "point n",
            "point rho",
            "point p",
            "AUROC (misclassified)",
            "experiments",
            "experiment rho",
            "experiment p",
            "rho aleatoric vs loss",
            "partial rho (epistemic given aleatoric)",
            "verdict",
        ],
        rows,
    )
    X["BS_SUPPORTED"] = vc["supported"]
    X["BS_INCONCLUSIVE"] = vc["inconclusive"]
    X["BS_NOT_SUPPORTED"] = vc["not_supported"]
    X["BS_SUPPORTED_GROUPS"] = (
        ", ".join(f"`{g['group_id']}`" for g in groups if g["blindspot_test"]["verdict"] == "supported")
        or "none"
    )
    X["BS_INCONC_GROUPS"] = (
        ", ".join(f"`{g['group_id']}`" for g in groups if g["blindspot_test"]["verdict"] == "inconclusive")
        or "none"
    )
    pr = [g["blindspot_test"]["diagnostics"]["partial_rho_epistemic_given_aleatoric"] for g in groups]
    X["PARTIAL_MIN"], X["PARTIAL_MAX"] = f2(min(pr)), f2(max(pr))
    pa = [g["blindspot_test"]["diagnostics"]["rho_aleatoric_point"] for g in groups]
    pe = [g["blindspot_test"]["point_level"]["spearman_rho"] for g in groups]
    X["N_ALEA_GE_EPI"] = sum(1 for a, e in zip(pa, pe, strict=True) if a >= e)
    X["MAX_MISCLASS"] = max(g["blindspot_test"]["point_level"]["n_misclassified"] for g in groups)
    X["MIN_MISCLASS"] = min(g["blindspot_test"]["point_level"]["n_misclassified"] for g in groups)

    # --- pressure sensitivity: max |delta log loss|
    deltas = []
    for g in groups:
        for s in g["sensitivity"]:
            if s["variant"].startswith("pressure length scale"):
                deltas.append(abs(s["delta_vs_primary"]))
    X["LP_MAX_DELTA"] = f"{max(deltas):.3f}" if deltas else "n/a"

    # --- retrospective
    r = F["retro"]
    if r:
        sm = r["acquisition_retrospective"]["summary"]
        sc = r["acquisition_retrospective"]["scenarios"]
        X["RETRO"] = True
        X["R_N"] = sm["n_scenarios"]
        X["R_SEEDS"] = r["design"]["seeds"]
        X["R_ROUNDS"] = sc[0]["n_rounds"]
        for key, nm_ in (
            ("evr_vs_random", "RAND"),
            ("evr_vs_uncertainty_sampling", "UNC"),
            ("evr_vs_nearest_gap", "GAP"),
        ):
            X[f"R_{nm_}_B"], X[f"R_{nm_}_I"], X[f"R_{nm_}_W"] = (
                sm[key]["better"],
                sm[key]["indistinguishable"],
                sm[key]["worse"],
            )
        X["R_SKIPPED"] = (
            "; ".join(f"`{s['group_id']}` / {s['name']}: {s['reason']}" for s in r["design"]["skipped"])
            or "none"
        )
        X["R_LIMITS"] = "\n".join(f"- {x}" for x in r["design"]["limitations"])
        rows = []
        degenerate = 0
        below = Counter()
        for s in sc:
            pdiff = s["paired_differences"]

            def cell(k, pdiff=pdiff):
                d = pdiff[k]
                lo, hi = d["ci95"]
                tag = "EVR better" if hi < 0 else ("EVR worse" if lo > 0 else "indist.")
                return f"{d['mean_auc_difference']:+.3f} [{lo:+.3f}, {hi:+.3f}] {tag}"

            finals = {k: v[-1]["mean"] for k, v in s["curves"].items()}
            same = max(finals.values()) - min(finals.values()) < 5e-4
            if same:
                degenerate += 1
            for k, vv in s["majority_class_baseline"]["final_round_log_loss_below_baseline"].items():
                below[k] += int(bool(vv))
            rows.append(
                (
                    f"`{s['group_id']}`",
                    s["name"],
                    f"{s['n_pool_experiments']}/{s['n_target_experiments']}",
                    f"{s['target_class_balance']['sustained']}/{s['target_class_balance']['not_sustained']}",
                    cell("evr_minus_random"),
                    cell("evr_minus_uncertainty_sampling"),
                    cell("evr_minus_nearest_gap"),
                    f3(s["majority_class_baseline"]["target_log_loss"]),
                    f3(finals["evr"]),
                    f3(finals["random"]),
                )
            )
        X["RETRO_TABLE"] = table(
            [
                "group",
                "target scenario",
                "pool/target experiments",
                "target sust./not sust.",
                "AUC diff EVR - random [95% CI]",
                "EVR - uncertainty sampling",
                "EVR - nearest gap",
                "majority-class log loss (target)",
                "EVR final log loss",
                "random final log loss",
            ],
            rows,
        )
        X["R_DEGENERATE"] = degenerate
        X["R_BELOW_EVR"] = below["evr"]
        X["R_BELOW_RANDOM"] = below["random"]
        X["R_SMALL_POOL"] = sum(1 for s in sc if s["n_pool_experiments"] - 3 <= s["n_rounds"])
        X["R_INTERP"] = sm["interpretation"]
        X["R_RUNTIME"] = r["runtime_seconds"]
    else:
        X["RETRO"] = False
    return X


def extras(F, X):
    """README validation block, snapshot size, intersections."""
    import json as _json
    from pathlib import Path as _P

    val = F["val"]
    groups = val["groups"]
    better = {g["group_id"] for g in groups if verdict_vs_majority(g).startswith("GP better")}
    fo_ids = {x.split("`")[1] for x in X["FLOWOFF_GROUPS"].split(", ") if x.startswith("`")}
    X["N_FLOWOFF_IN_BETTER"] = len(better & fo_ids)
    rows = []
    for g in groups:
        gp, mj = model(g, "gp"), model(g, "majority_class")
        rows.append(
            (
                f"`{g['group_id']}`",
                g["n_experiments"],
                f"{g['label_counts']['sustained']}/{g['label_counts']['not_sustained']}",
                f"{gp['log_loss']['value']:.3f}",
                f"{mj['log_loss']['value']:.3f}",
                ci(g["cv"]["gp_vs_majority"]["log_loss"]),
                verdict_vs_majority(g),
                g["blindspot_test"]["verdict"],
            )
        )
    t = table(
        [
            "group",
            "experiments",
            "sust./not sust.",
            "GP log loss",
            "majority log loss",
            "GP minus majority [95% CI]",
            "log loss vs majority",
            "blind-spot test",
        ],
        rows,
    )
    lines = [
        f"Grouped {X['CV_K']}-fold cross-validation by experiment x {X['CV_REPEATS']} repeats; log loss, lower is better; CI from a group bootstrap ({X['N_BOOT']} draws).",
        "",
        t,
        "",
        f"- GP better than the majority-class baseline (CI excludes 0): {X['N_GP_BETTER']} of {X['N_MODELLED']} groups; not distinguishable: {X['N_GP_INDIST']}; worse: {X['N_GP_WORSE']}.",
        f"- Blind-spot test (does pre-reveal epistemic uncertainty track errors on withheld experiments?): {X['BS_SUPPORTED']} supported, {X['BS_INCONCLUSIVE']} inconclusive, {X['BS_NOT_SUPPORTED']} not supported. The partial correlation of epistemic uncertainty given aleatoric uncertainty ranges {X['PARTIAL_MIN']} to {X['PARTIAL_MAX']}, so this is not proof of added information.",
    ]
    if X["RETRO"]:
        lines.append(
            f"- Retrospective acquisition test ({X['R_N']} pseudo-target scenarios, {X['R_SEEDS']} seeds): EVR vs random better/indistinguishable/worse = {X['R_RAND_B']}/{X['R_RAND_I']}/{X['R_RAND_W']}; vs uncertainty sampling {X['R_UNC_B']}/{X['R_UNC_I']}/{X['R_UNC_W']}; vs nearest gap {X['R_GAP_B']}/{X['R_GAP_I']}/{X['R_GAP_W']}. No reliable advantage is claimed."
        )
    X["README_VALIDATION"] = "\n".join(lines)
    snap = F["root"] / "apps/web/public/snapshot"
    n = sum(1 for _ in (snap / "files").glob("*")) if (snap / "files").exists() else 0
    tot = sum(f.stat().st_size for f in snap.rglob("*") if f.is_file()) if snap.exists() else 0
    X["SNAP_FILES"] = n
    X["SNAP_MB"] = f"{tot / 1e6:.0f}"
    mf = snap / "manifest.json"
    if mf.exists():
        m = _json.loads(mf.read_text())
        X["SNAP_ENTRIES"] = len(m["entries"])
        X["SNAP_DV"] = m["dataset_version"]
        X["SNAP_MV"] = m["model_version"]
    ex = _P(__file__).parent / "extra.json"
    if ex.exists():
        X.update(_json.loads(ex.read_text()))

    # not-integrated and profiles tables
    def rng(r):
        return "n/a" if not r else f"{r[0]} to {r[1]}"

    rows = []
    for x in F["not_integrated"]:
        rows.append(
            (
                f"`{x['id']}`",
                x["name"].replace("|", "/"),
                rng(x.get("o2_percent_range")),
                rng(x.get("pressure_kpa_range")),
                rng(x.get("flow_cm_s_range")),
                x["reason_not_integrated"].replace("|", "/"),
            )
        )
    X["NOT_INTEGRATED_TABLE"] = table(
        [
            "id",
            "investigation",
            "O2 % range",
            "pressure kPa range",
            "flow cm/s range",
            "reason not integrated into the model",
        ],
        rows,
    )
    X["N_NOT_INTEGRATED"] = len(F["not_integrated"])

    def rr(r):
        if not r:
            return "n/a"
        parts = []
        for k_ in ("nominal", "min", "max"):
            if r.get(k_) is not None:
                parts.append(f"{k_} {r[k_]}")
        return ", ".join(parts) or "n/a"

    rows = [
        (
            f"`{p['profile_id']}`",
            p["status"],
            rr(p["oxygen_percent"]),
            rr(p["total_pressure_kpa"]),
            len(p["sources"]),
        )
        for p in F["profiles"]["profiles"]
    ]
    X["PROFILE_TABLE"] = table(["profile", "status", "O2 %", "total pressure kPa", "NASA sources"], rows)
    X["VENT_MIN"] = F["profiles"]["ventilation"]["min_cm_s"]
    X["VENT_MAX"] = F["profiles"]["ventilation"]["max_cm_s"]
    pri = F["manifest"]["config"]["priors"]

    def lg(k):
        m, sd = pri[k]
        return f"ln-mean {m:.3f} (= {2.718281828**m:.2f}), sd {sd}"

    X["PRIOR_L_O2"], X["PRIOR_L_FLOW"], X["PRIOR_SIGNAL"] = lg("l_o2"), lg("l_flow"), lg("signal_var")
    X["PRIOR_B0"] = f"normal, mean {pri['b0'][0]}, sd {pri['b0'][1]}"
    X["PRIOR_B1"] = f"normal, mean {pri['b1'][0]}, sd {pri['b1'][1]}"
    X["N_RESTARTS"] = F["manifest"]["config"]["n_restarts"]
    X["SEED"] = F["manifest"]["config"]["seed"]
    X["LEARNED_TABLE"] = learned_table(F)
    X["ALL_MODELS_TABLE"] = all_models_table(F)
    X["LOGO_TABLE"], X["LOGO_N"], X["LOGO_WORSE"] = logo_summary(F)


def learned_table(F):
    try:
        import numpy as np
        from blindspots.models.registry import load_registry
    except Exception as exc:  # pragma: no cover
        return f"(model structure table unavailable: {exc})"
    reg = load_registry(F["root"] / "models", F["manifest"]["model_version"])
    rows = []
    for gid, gm in sorted(reg.groups.items()):
        if gm.model is None or gm.model_status != "modeled":
            continue
        X_ = np.asarray(gm.model.X, dtype=float)
        o2lo, o2hi = np.percentile(X_[:, 0], [10, 90])
        zlo, zhi = np.percentile(X_[:, 1], [10, 90])
        flo, fhi = np.expm1(zlo), np.expm1(zhi)

        def p(o2, z, gm=gm):
            return float(gm.model.predict_proba(np.array([[o2, z, 0.0]]))[0])

        ls = gm.model.length_scales
        rows.append(
            (
                f"`{gid}`",
                f"{ls[0]:.2f}",
                f"{ls[1]:.2f}",
                f"O2 {o2lo:.1f} to {o2hi:.1f} %, flow {flo:.2f} to {fhi:.1f} cm/s",
                f"{p(o2lo, zlo):.2f}",
                f"{p(o2hi, zlo):.2f}",
                f"{p(o2lo, zhi):.2f}",
                f"{p(o2hi, zhi):.2f}",
            )
        )
    return table(
        [
            "group",
            "learned O2 length scale (%)",
            "learned flow length scale (ln units)",
            "training 10th to 90th percentile",
            "P(sustained): low O2, low flow",
            "high O2, low flow",
            "low O2, high flow",
            "high O2, high flow",
        ],
        rows,
    )


def all_models_table(F):
    names = ["gp", "logistic_o2_flow", "logistic_o2", "bootstrap_logistic_ensemble", "majority_class"]
    rows = []
    for g in F["val"]["groups"]:
        rows.append((f"`{g['group_id']}`", *[ci(model(g, n)["log_loss"]) for n in names]))
    return table(["group", *[f"{n} log loss" for n in names]], rows)


def logo_summary(F):
    rows = []
    for g in F["val"]["groups"]:
        lg = g["logo"]
        if not lg["applicable"]:
            continue
        for f in lg["folds"]:
            rows.append(
                (
                    f"`{g['group_id']}`",
                    f["held_out"],
                    f["n"],
                    f["n_not_sustained"],
                    f3(f["log_loss"]),
                    f3(f["majority_log_loss"]),
                    "GP worse" if f["log_loss"] > f["majority_log_loss"] else "GP better",
                )
            )
    worse = sum(1 for r in rows if r[-1] == "GP worse")
    return (
        table(
            [
                "group",
                "held-out campaign",
                "n",
                "not sustained",
                "GP log loss",
                "majority log loss",
                "which is lower",
            ],
            rows,
        ),
        len(rows),
        worse,
    )
