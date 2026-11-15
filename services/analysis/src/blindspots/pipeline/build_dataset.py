"""Build the normalized dataset (CLI ``blindspots build-dataset``).

Matrices (BASS, BASS-II) + curation tables (interpretation with provenance) + fan calibration ->
``data/normalized``. Every step is deterministic; nothing under ``data/raw`` is modified.
"""

from __future__ import annotations

import json
from collections import Counter
from collections.abc import Sequence
from pathlib import Path
from typing import Any, Literal

from blindspots.config import REPO_ROOT
from blindspots.ingestion.bass import PSI26_MATRIX_FILE, read_bass
from blindspots.ingestion.bass2 import PSI25_MATRIX_FILE, RawTest, read_bass2
from blindspots.ingestion.investigations import build_investigations
from blindspots.ingestion.profiles import ProfilesData, iss_nominal_pressure, load_profiles
from blindspots.ingestion.saffire import SAFFIRE_FILE, load_saffire
from blindspots.processing import provenance
from blindspots.processing.dedupe import find_duplicates
from blindspots.processing.export import export_dataset
from blindspots.processing.flow_calibration import FAN_MAX_DISPLAY, FlowCalibration, load_default
from blindspots.processing.labels import (
    CurationData,
    CurationStep,
    CurationTest,
    label_step,
    load_curation,
    lowest_confidence,
    oxygen_for_step,
    training_exclusion,
)
from blindspots.processing.units import AIR_TO_U_FACTOR, norm_text
from blindspots.processing.validate import (
    apply_range_checks,
    missing_value_table,
    revalidate,
)
from blindspots.schemas import ExperimentRecord, Investigation, Observation

BASS2_HEADER_YEAR = 2014
MEASUREMENT_METHOD = (
    "Test-level values from the source matrix cells; flow schedule and outcomes transcribed from the "
    "matrix free text into curation tables with cell-level provenance."
)
OUTCOME_DEFINITION = (
    "terminal_event assigned during curation from the matrix observation text (see data/curation)."
)


def _float(text: str) -> float | None:
    try:
        return float(text) if text.strip() != "" else None
    except ValueError:
        return None


def _int(text: str) -> int | None:
    try:
        return int(float(text)) if text.strip() != "" else None
    except ValueError:
        return None


def _convert_flow(
    step: CurationStep,
    raw: RawTest,
    cal: FlowCalibration | None,
) -> tuple[float | None, float | None, str, str | None, list[str], bool]:
    """Convert one step's flow to cm/s: (airflow, uncertainty, basis, calibration_ref, flags, borrowed)."""
    r = step.row
    unit = r["flow_unit"]
    qualifier = r["flow_qualifier"]
    value = _float(r["flow_value"])
    flags: list[str] = []
    if qualifier == "<":
        flags.append("flow_upper_bound")
    elif qualifier == "~":
        flags.append("flow_approximate")
    if unit == "none":
        return None, None, "none", None, flags, False
    if value is None and qualifier == "max" and unit == "fan_display":
        value = FAN_MAX_DISPLAY
        flags.append("flow_max_taken_as_fan_display_122")
    if value is None:
        flags.append("flow_value_missing")
        return None, None, "none", None, flags, False
    if unit == "air_cm_s":
        if norm_text(r["raw_column"]).lower() == "air display":
            if value == 0:
                flags.append("air_display_zero_reading")
            if raw.investigation_id == "PSI-26":
                flags.append("air_factor_from_bass2_note")
            return AIR_TO_U_FACTOR * value, None, "air_display", None, flags, False
        return value, None, "stated_cm_s", None, flags, False
    # fan_display / pot: need the fan calibration and a restrictor count
    kind: Literal["fan_display", "pot"] = "fan_display" if unit == "fan_display" else "pot"
    basis = "fan_calibration" if kind == "fan_display" else "pot_calibration"
    if cal is None:
        flags.append("calibration_unavailable")
        return None, None, "none", None, flags, False
    if raw.flow_restrictor not in (0, 1, 2):
        flags.append("no_restrictor_for_calibration")
        return None, None, "none", None, flags, False
    borrowed = raw.investigation_id == "PSI-26"
    if borrowed:
        year: int | None = None
        day = raw.test_date.timetuple().tm_yday if raw.test_date else None
    else:
        year = raw.test_date.year if raw.test_date else BASS2_HEADER_YEAR
        if raw.test_date is None:
            flags.append("calibration_year_assumed_2014")
        day = raw.gmt_day
    res = cal.convert(kind, value, raw.flow_restrictor, year, day)
    if res is None:
        flags.append("no_calibration_for_restrictor_count")
        return None, None, "none", None, flags, borrowed
    flags.extend(res.flags)
    if borrowed:
        flags.append("calibration_borrowed_from_bass2")
    return res.u_cm_s, res.uncertainty_cm_s, basis, res.calibration_ref, flags, borrowed


def build_records(
    repo_root: Path,
    curation: CurationData,
    cal: FlowCalibration | None,
    profiles: ProfilesData,
    investigations: dict[str, Investigation],
) -> tuple[list[ExperimentRecord], list[Observation], dict[str, Any]]:
    """Join matrix rows, curation rows and calibration into experiment/observation records."""
    notes: dict[str, Any] = {"matrices_missing": [], "tests_skipped_no_investigation": []}
    raw_tests: list[RawTest] = []
    for rel, reader in (
        (PSI25_MATRIX_FILE, read_bass2),
        (PSI26_MATRIX_FILE, read_bass),
    ):
        path = repo_root / rel
        if path.is_file():
            raw_tests.extend(reader(path))
        else:
            notes["matrices_missing"].append(rel)
    p_kpa, p_source, p_sourced = iss_nominal_pressure(profiles.profiles)
    cells = provenance.SourceCells(repo_root)
    experiments: list[ExperimentRecord] = []
    observations: list[Observation] = []
    matched: set[tuple[str, str]] = set()
    for raw in raw_tests:
        key = (raw.investigation_id, raw.test_label)
        inv = investigations.get(raw.investigation_id)
        if inv is None:
            notes["tests_skipped_no_investigation"].append(f"{raw.investigation_id}:{raw.test_label}")
            continue
        cur: CurationTest | None = curation.tests.get(key)
        steps = curation.steps.get(key, [])
        flags = list(raw.flags)
        eid = f"{raw.investigation_id}:{raw.test_label}"
        test_prov_ok = True
        if cur is not None:
            matched.add(key)
            cr = cur.row
            err = provenance.check_test(
                cells, cr["source_file"], cr["source_sheet"], _int(cr["source_row"]) or 0, raw.test_label
            )
            if err:
                test_prov_ok = False
                flags.append(provenance.FLAG)
            if _int(cr["source_row"]) != raw.source_row:
                flags.append("curation_source_row_mismatch")
                test_prov_ok = False
                flags.append(provenance.FLAG) if provenance.FLAG not in flags else None
        # oxygen / pressure
        o2_anomaly = bool(cur and cur.row["o2_anomaly"].strip())
        if o2_anomaly:
            flags.append("o2_anomaly")
        if raw.o2_initial is None:
            flags.append("o2_initial_missing")
        measured_kpa = raw.pressure_kpa
        assumed_kpa: float | None = None
        assumption_source: str | None = None
        if measured_kpa is None:
            assumed_kpa, assumption_source = p_kpa, p_source
            flags.append("pressure_assumed")
            if not p_sourced:
                flags.append("pressure_assumption_unsourced")
        pressure_for_analysis = measured_kpa if measured_kpa is not None else assumed_kpa
        conf_test = cur.row["confidence"] if cur else "low"
        if cur is None:
            flags.append("no_curation_record")
        elif conf_test == "low":
            flags.append("test_confidence_low")
        # observations
        obs_list: list[Observation] = []
        n_steps = len(steps)
        for idx, st in enumerate(steps):
            r = st.row
            step_flags: list[str] = []
            label, label_flags, label_reason = label_step(r["flame_state"], r["extinction_mode"])
            step_flags.extend(label_flags)
            airflow, unc, basis, ref, flow_flags, borrowed = _convert_flow(st, raw, cal)
            step_flags.extend(flow_flags)
            o2_step, o2_flags = oxygen_for_step(raw.o2_initial, raw.o2_final, idx, n_steps, o2_anomaly)
            step_flags.extend(o2_flags)
            err = provenance.check_step(
                cells,
                r["source_file"],
                r["source_sheet"],
                _int(r["source_row"]) or 0,
                _int(r["token_row"]),
                r["raw_column"],
                r["raw_token"],
            )
            prov_ok = err is None and test_prov_ok
            if not prov_ok:
                step_flags.append(provenance.FLAG)
            conf = r["confidence"] if r["confidence"] in ("high", "medium", "low") else "low"
            if borrowed:
                conf = lowest_confidence(conf, "low")
            family = cur.row["material_family"] or None if cur else None
            reason = training_exclusion(
                label=label,
                label_reason=label_reason,
                airflow=airflow,
                provenance_ok=prov_ok,
                confidence=conf,
                material_family=family,
                oxygen=o2_step,
            )
            obs_list.append(
                Observation(
                    observation_id=f"{eid}#s{r['step_index']}",
                    experiment_id=eid,
                    investigation_id=raw.investigation_id,
                    campaign_group=raw.campaign_group,
                    material_family=family,
                    flame_configuration=(cur.row["flame_configuration"] if cur else "") or "unknown",
                    step_index=_int(r["step_index"]) or 0,
                    oxygen_percent=o2_step,
                    airflow_cm_s=airflow,
                    airflow_uncertainty_cm_s=unc,
                    airflow_basis=basis,
                    flow_raw_value=r["flow_value"] or None,
                    flow_raw_unit=r["flow_unit"],
                    flow_calibration_ref=ref,
                    total_pressure_kpa=measured_kpa,
                    pressure_for_analysis_kpa=pressure_for_analysis,
                    flame_state=r["flame_state"],
                    extinction_mode=r["extinction_mode"] or None,
                    label=label,
                    raw_token=r["raw_token"],
                    raw_column=r["raw_column"],
                    source_row=_int(r["token_row"]) or _int(r["source_row"]) or 0,
                    confidence=conf,
                    quality_flags=list(
                        dict.fromkeys(step_flags + (["pressure_assumed"] if measured_kpa is None else []))
                    ),
                    included_in_training=reason is None,
                    exclusion_reason=reason,
                )
            )
        observations.extend(obs_list)
        flows = [o.airflow_cm_s for o in obs_list if o.airflow_cm_s is not None]
        first_sustained = next(
            (o.airflow_cm_s for o in obs_list if o.flame_state == "sustained" and o.airflow_cm_s is not None),
            None,
        )
        included = any(o.included_in_training for o in obs_list)
        if included:
            exp_reason: str | None = None
        elif cur is None:
            exp_reason = "no_curation_record"
        elif not obs_list:
            exp_reason = "no_curated_flow_steps"
        else:
            exp_reason = Counter(o.exclusion_reason for o in obs_list).most_common(1)[0][0]
            top = sorted(
                Counter(o.exclusion_reason for o in obs_list).items(), key=lambda kv: (-kv[1], str(kv[0]))
            )
            exp_reason = top[0][0]
        cr = cur.row if cur else {}
        experiments.append(
            ExperimentRecord(
                experiment_id=eid,
                investigation_id=raw.investigation_id,
                investigation_name=inv.title,
                investigation_acronym=inv.acronym,
                campaign_group=raw.campaign_group,
                test_label=raw.test_label,
                sample_id=raw.sample_id,
                test_date=raw.test_date,
                oxygen_percent=raw.o2_initial,
                oxygen_percent_initial=raw.o2_initial,
                oxygen_percent_final=raw.o2_final,
                total_pressure_kpa=measured_kpa,
                total_pressure_atm_raw=raw.pressure_atm_raw,
                pressure_assumed_kpa=assumed_kpa,
                pressure_assumption_source=assumption_source,
                airflow_cm_s=first_sustained,
                airflow_min_cm_s=min(flows) if flows else None,
                airflow_max_cm_s=max(flows) if flows else None,
                material_type=raw.material_raw,
                material_family=cr.get("material_family") or None,
                specimen_geometry=cr.get("specimen_geometry") or None,
                material_thickness_mm=_float(cr.get("thickness_mm", "")),
                specimen_diameter_mm=_float(cr.get("diameter_mm", "")),
                specimen_width_mm=_float(cr.get("width_mm", "")),
                flame_configuration=cr.get("flame_configuration") or "unknown",
                gravity_environment=inv.gravity_environment,
                experimental_platform=inv.platform,
                flow_restrictor=raw.flow_restrictor,
                observed_outcome=cr.get("terminal_event") or None,
                outcome_definition=OUTCOME_DEFINITION if cur else None,
                measurement_method=MEASUREMENT_METHOD,
                co2_percent_initial=raw.co2_initial,
                co2_percent_final=raw.co2_final,
                co_ppm_initial=raw.co_initial,
                co_ppm_final=raw.co_final,
                notes_raw=raw.notes_raw,
                source_url=inv.landing_url,
                source_doi=inv.doi,
                source_file=raw.source_file,
                source_sheet=raw.source_sheet,
                source_row=raw.source_row,
                extraction_method="manually_transcribed" if cur else "structured_nasa_data",
                extraction_confidence=conf_test if cur else "low",
                quality_flags=list(dict.fromkeys(flags)),
                included_in_training=included,
                exclusion_reason=exp_reason,
                n_observations=len(obs_list),
            )
        )
    notes["curation_tests_without_matrix_row"] = sorted(
        f"{a}:{b}" for (a, b) in curation.tests if (a, b) not in matched
    )
    notes["curation_step_tests_without_test_row"] = sorted(
        f"{a}:{b}" for (a, b) in curation.steps if (a, b) not in curation.tests
    )
    notes["pressure_assumption_sourced"] = p_sourced
    return experiments, observations, notes


def _counts(items: Sequence[Any], attr: str) -> dict[str, int]:
    return dict(
        sorted(
            Counter(str(getattr(i, attr)) if getattr(i, attr) is not None else "null" for i in items).items()
        )
    )


def make_report(
    investigations: Sequence[Investigation],
    experiments: Sequence[ExperimentRecord],
    observations: Sequence[Observation],
    curation: CurationData,
    profiles: ProfilesData,
    extra: dict[str, Any],
    range_counts: dict[str, int],
    errors: list[str],
    duplicates: dict[str, Any],
) -> dict[str, Any]:
    prov_obs = [o.observation_id for o in observations if "provenance_mismatch" in o.quality_flags]
    prov_exp = [e.experiment_id for e in experiments if "provenance_mismatch" in e.quality_flags]
    return {
        "counts": {
            "investigations": len(investigations),
            "experiments": len(experiments),
            "observations": len(observations),
            "experiments_included_in_training": sum(e.included_in_training for e in experiments),
            "observations_included_in_training": sum(o.included_in_training for o in observations),
            "experiments_by_investigation": _counts(experiments, "investigation_id"),
            "observations_by_investigation": _counts(observations, "investigation_id"),
            "experiments_by_campaign": _counts(experiments, "campaign_group"),
            "observations_by_campaign": _counts(observations, "campaign_group"),
            "observations_by_material_family": _counts(observations, "material_family"),
            "observations_by_flame_configuration": _counts(observations, "flame_configuration"),
            "observations_by_label": _counts(observations, "label"),
            "observations_by_confidence": _counts(observations, "confidence"),
            "training_observations_by_family": dict(
                sorted(
                    Counter(
                        o.material_family or "null" for o in observations if o.included_in_training
                    ).items()
                )
            ),
        },
        "exclusions": {
            "observations_by_reason": dict(
                sorted(Counter(o.exclusion_reason for o in observations if o.exclusion_reason).items())
            ),
            "experiments_by_reason": dict(
                sorted(Counter(e.exclusion_reason for e in experiments if e.exclusion_reason).items())
            ),
        },
        "quality_flags": {
            "experiments": dict(sorted(Counter(f for e in experiments for f in e.quality_flags).items())),
            "observations": dict(sorted(Counter(f for o in observations for f in o.quality_flags).items())),
            "range_check_counts": range_counts,
        },
        "provenance_failures": {"observations": prov_obs, "experiments": prov_exp},
        "missing_values": {
            "experiments": missing_value_table(experiments),
            "observations": missing_value_table(observations),
        },
        "duplicates": duplicates,
        "chunks_found": {"tests": curation.test_chunks, "steps": curation.step_chunks},
        "curation_problems": curation.problems,
        "atmosphere_profiles": {
            "n_profiles": len(profiles.profiles),
            "errors": profiles.errors,
            "keys_outside_schema": profiles.extra_keys,
            "file_present": profiles.raw is not None,
        },
        "errors": errors,
        **extra,
    }


def build(repo_root: Path = REPO_ROOT, out_dir: Path | None = None) -> dict[str, Any]:
    """Run the whole pipeline; returns the report (with ``dataset_version``)."""
    data_dir = repo_root / "data"
    out = out_dir or (data_dir / "normalized")
    invs = build_investigations(data_dir / "raw", data_dir / "manifests")
    inv_by_id = {i.investigation_id: i for i in invs}
    profiles = load_profiles(data_dir / "manifests" / "atmosphere_profiles.json")
    cal = load_default(repo_root)
    curation = load_curation(data_dir / "curation")
    experiments, observations, notes = build_records(repo_root, curation, cal, profiles, inv_by_id)
    experiments.extend(load_saffire(data_dir / "curation" / SAFFIRE_FILE, inv_by_id))
    dups = find_duplicates(experiments)
    range_counts = apply_range_checks(experiments, observations)
    errors = revalidate(invs, experiments, observations) + dups.id_errors
    n_exp = Counter(e.investigation_id for e in experiments)
    n_obs = Counter(o.investigation_id for o in observations)
    invs = [
        i.model_copy(
            update={"n_experiments": n_exp[i.investigation_id], "n_observations": n_obs[i.investigation_id]}
        )
        for i in invs
    ]
    extra = {"calibration_file_found": cal is not None, **notes}
    report = make_report(
        invs,
        experiments,
        observations,
        curation,
        profiles,
        extra,
        range_counts,
        errors,
        {"id_errors": dups.id_errors, "possible_duplicates": dups.possible_duplicates},
    )
    report["dataset_version"] = export_dataset(out, invs, experiments, observations, profiles.raw, report)
    return report


def main() -> None:
    report = build()
    c = report["counts"]
    print(f"dataset {report['dataset_version']}: {c['experiments']} experiments, {c['observations']} obs")
    n_e, n_o = c["experiments_included_in_training"], c["observations_included_in_training"]
    print(f"  training: {n_e} experiments, {n_o} observations")
    print(f"  chunks: tests={report['chunks_found']['tests']} steps={report['chunks_found']['steps']}")
    print(f"  exclusions: {json.dumps(report['exclusions']['observations_by_reason'])}")
    print(f"  provenance failures: {len(report['provenance_failures']['observations'])} observations")
    if report["errors"]:
        print("ERRORS:", *report["errors"], sep="\n  ")
        raise SystemExit(1)
