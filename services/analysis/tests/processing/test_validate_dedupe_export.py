from __future__ import annotations

import datetime as dt
import json
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq  # type: ignore[import-untyped]

from blindspots.processing.dedupe import find_duplicates
from blindspots.processing.export import dataset_version, export_dataset, norm_float
from blindspots.processing.validate import apply_range_checks, missing_value_table, revalidate
from blindspots.schemas import ExperimentRecord, Investigation, Observation


def exp(label: str = "T1", **kw: Any) -> ExperimentRecord:
    base: dict[str, Any] = dict(
        experiment_id=f"PSI-25:{label}",
        investigation_id="PSI-25",
        investigation_name="fixture",
        investigation_acronym="FX",
        campaign_group="BASS-II/Fixture",
        test_label=label,
        sample_id="147",
        test_date=dt.date(2014, 2, 19),
        oxygen_percent=22.2,
        oxygen_percent_initial=22.2,
        oxygen_percent_final=22.2,
        flame_configuration="opposed",
        gravity_environment="microgravity (ISS)",
        source_url="https://example.invalid/fixture",
        extraction_method="manually_transcribed",
        extraction_confidence="high",
        quality_flags=[],
        included_in_training=True,
        n_observations=1,
    )
    return ExperimentRecord(**{**base, **kw})


def obs(eid: str = "PSI-25:T1", step: int = 0, **kw: Any) -> Observation:
    base: dict[str, Any] = dict(
        observation_id=f"{eid}#s{step}",
        experiment_id=eid,
        investigation_id="PSI-25",
        campaign_group="BASS-II/Fixture",
        flame_configuration="opposed",
        step_index=step,
        oxygen_percent=22.2,
        airflow_cm_s=5.0,
        airflow_basis="air_display",
        flow_raw_unit="air_cm_s",
        flame_state="sustained",
        label=1,
        raw_token="5",
        raw_column="Air display",
        source_row=2,
        confidence="high",
        quality_flags=[],
        included_in_training=True,
    )
    return Observation(**{**base, **kw})


def inv() -> Investigation:
    return Investigation(
        investigation_id="PSI-25",
        acronym="FX",
        title="fixture",
        landing_url="https://example.invalid",
        license="CC0-1.0",
        platform="fixture",
        gravity_environment="microgravity (ISS)",
        role="integrated_model",
        role_reason="fixture",
        n_experiments=1,
        n_observations=1,
    )


def test_duplicate_experiment_id_is_an_error() -> None:
    report = find_duplicates([exp("T1"), exp("T1", sample_id="2")])
    assert report.id_errors and "PSI-25:T1" in report.id_errors[0]


def test_same_sample_date_and_conditions_is_flagged_not_removed() -> None:
    a, b, c = exp("T1"), exp("T2"), exp("T3", sample_id="999")
    report = find_duplicates([a, b, c])
    assert report.possible_duplicates == [["PSI-25:T1", "PSI-25:T2"]]
    assert "possible_duplicate" in a.quality_flags and "possible_duplicate" in b.quality_flags
    assert "possible_duplicate" not in c.quality_flags


def test_different_conditions_are_not_duplicates() -> None:
    report = find_duplicates([exp("T1"), exp("T2", oxygen_percent_initial=18.0)])
    assert report.possible_duplicates == []


def test_range_checks_flag_but_do_not_change_values() -> None:
    e = exp("T1", oxygen_percent_final=0.6, co_ppm_initial=-1.0)
    o = obs(airflow_cm_s=75.0)
    counts = apply_range_checks([e], [o])
    assert e.oxygen_percent_final == 0.6 and e.co_ppm_initial == -1.0 and o.airflow_cm_s == 75.0
    assert {"o2_final_out_of_range", "co_initial_out_of_range"} <= set(e.quality_flags)
    assert "airflow_out_of_range" in o.quality_flags
    assert counts["o2_final_out_of_range"] == 1


def test_missing_value_table() -> None:
    table = missing_value_table([exp("T1"), exp("T2", co_ppm_final=3.0)], ["co_ppm_final", "oxygen_percent"])
    assert table["co_ppm_final"] == {"missing": 1, "total": 2, "fraction_missing": 0.5}
    assert table["oxygen_percent"]["missing"] == 0


def test_revalidate_accepts_valid_records() -> None:
    assert revalidate([inv()], [exp()], [obs()]) == []


def test_norm_float_is_stable() -> None:
    assert norm_float(0.1 + 0.2) == 0.3
    assert dataset_version({"a": [1.5, 2]}) == dataset_version({"a": [1.5, 2]})
    assert len(dataset_version({"a": 1})) == 12


def test_export_is_deterministic_and_complete(tmp_path: Path) -> None:
    exps = [exp("T2"), exp("T1", sample_id="2")]
    observations = [obs("PSI-25:T2", 1), obs("PSI-25:T1", 0), obs("PSI-25:T2", 0)]
    profiles = {"version": 1, "profiles": []}
    v1 = export_dataset(tmp_path / "a", [inv()], exps, observations, profiles, {"k": 1})
    v2 = export_dataset(
        tmp_path / "b", [inv()], list(reversed(exps)), list(reversed(observations)), profiles, {"k": 1}
    )
    assert v1 == v2 and (tmp_path / "a" / "VERSION").read_text().strip() == v1
    for name in ("investigations", "experiments", "observations"):
        for ext in ("parquet", "csv", "json"):
            assert (tmp_path / "a" / f"{name}.{ext}").is_file()
        assert (tmp_path / "a" / f"{name}.csv").read_bytes() == (tmp_path / "b" / f"{name}.csv").read_bytes()
        assert (tmp_path / "a" / f"{name}.json").read_bytes() == (
            tmp_path / "b" / f"{name}.json"
        ).read_bytes()
    rows = json.loads((tmp_path / "a" / "observations.json").read_text())
    assert [r["observation_id"] for r in rows] == ["PSI-25:T1#s0", "PSI-25:T2#s0", "PSI-25:T2#s1"]
    table = pq.read_table(tmp_path / "a" / "experiments.parquet")
    assert table.num_rows == 2 and "quality_flags" in table.column_names
    report = json.loads((tmp_path / "a" / "dataset_report.json").read_text())
    assert report["dataset_version"] == v1 and (tmp_path / "a" / "atmosphere_profiles.json").is_file()


def test_content_change_changes_version(tmp_path: Path) -> None:
    v1 = export_dataset(tmp_path / "a", [inv()], [exp()], [obs()], None, {})
    v2 = export_dataset(tmp_path / "b", [inv()], [exp(oxygen_percent=21.0)], [obs()], None, {})
    assert v1 != v2
