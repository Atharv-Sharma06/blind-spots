from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from blindspots.ingestion.investigations import build_investigations
from blindspots.ingestion.profiles import (
    PLACEHOLDER_SOURCE,
    STANDARD_ATMOSPHERE_KPA,
    iss_nominal_pressure,
    load_profiles,
)
from blindspots.ingestion.saffire import EXCLUSION, load_saffire
from blindspots.pipeline.raw_manifest import build_manifest

PROFILE = {
    "profile_id": "iss_cabin_nominal",
    "name": "fixture ISS",
    "context": "fixture",
    "status": "documented_nasa",
    "oxygen_percent": {"nominal": 21, "min": None, "max": 24.1},
    "total_pressure_kpa": {"nominal": 101.353, "min": 96.527, "max": 102.732},
    "total_pressure_psia": {"nominal": 14.7},
    "airflow_cm_s": None,
    "sources": [{"ref_id": "FX-1", "title": "fixture"}],
}


def write_inv(root: Path, acc: str, files: list[dict[str, object]]) -> None:
    d = root / "data" / "raw" / "psi" / acc
    d.mkdir(parents=True)
    (d / f"inv_{acc}.json").write_text(
        json.dumps(
            {
                "doi": "10.0/fixture",
                "licenseIdentifier": "CC0-1.0",
                "investigationAcronym": "FX",
                "title": "Fixture",
                "added": files,
            }
        ),
        encoding="utf-8",
    )


def test_raw_manifest_joins_metadata_and_hashes(tmp_path: Path) -> None:
    write_inv(
        tmp_path,
        "PSI-25",
        [{"file_name": "a.xlsx", "file_size": 3.0, "psi_legacy_s3_path": "legacy/1/a.xlsx"}],
    )
    d = tmp_path / "data" / "raw" / "psi" / "PSI-25"
    (d / "a.xlsx").write_bytes(b"abc")
    (d / "orphan.txt").write_bytes(b"zz")
    (d / "large").mkdir()
    (d / "large" / "big.bin").write_bytes(b"x")
    (d / "PSI-25_Science Documents_Planned_Test Matrix.xlsx").write_bytes(b"secret")
    m = build_manifest(tmp_path / "data" / "raw", tmp_path)
    by = {f["path"]: f for f in m["files"]}
    assert set(by) == {"data/raw/psi/PSI-25/a.xlsx", "data/raw/psi/PSI-25/orphan.txt"}
    a = by["data/raw/psi/PSI-25/a.xlsx"]
    assert a["sha256"] == hashlib.sha256(b"abc").hexdigest() and a["size_bytes"] == 3
    assert a["psi_file_size"] == 3.0 and a["psi_legacy_s3_path"] == "legacy/1/a.xlsx"
    assert a["doi"] == "10.0/fixture" and a["license"] == "CC0-1.0" and a["retrieved_at"] == "2026-11-15"
    assert a["landing_url"].endswith("/PSI-25")
    assert by["data/raw/psi/PSI-25/orphan.txt"]["in_psi_metadata"] is False
    assert m["investigations"]["PSI-25"]["inv_snapshot"] == "data/raw/psi/PSI-25/inv_PSI-25.json"


def test_profiles_validate_and_iss_nominal(tmp_path: Path) -> None:
    path = tmp_path / "atmosphere_profiles.json"
    bad = {**PROFILE, "profile_id": "broken", "oxygen_percent": {"nominal": None}}
    path.write_text(json.dumps({"version": 1, "profiles": [PROFILE, bad]}), encoding="utf-8")
    data = load_profiles(path)
    assert [p.profile_id for p in data.profiles] == ["iss_cabin_nominal"]
    assert any("broken" in e for e in data.errors)
    # total_pressure_psia is part of the profile schema (it mirrors the source's own units)
    assert "iss_cabin_nominal" not in data.extra_keys
    kpa, source, sourced = iss_nominal_pressure(data.profiles)
    assert (kpa, sourced) == (101.353, True) and "iss_cabin_nominal" in source and "FX-1" in source


def test_missing_profiles_use_documented_placeholder(tmp_path: Path) -> None:
    data = load_profiles(tmp_path / "nope.json")
    assert data.raw is None and data.profiles == []
    assert iss_nominal_pressure(data.profiles) == (STANDARD_ATMOSPHERE_KPA, PLACEHOLDER_SOURCE, False)


def test_investigations_roles(tmp_path: Path) -> None:
    for acc in ("PSI-25", "PSI-98"):
        write_inv(tmp_path, acc, [])
    manifests = tmp_path / "data" / "manifests"
    manifests.mkdir(parents=True)
    (manifests / "psi_investigations.json").write_text(
        json.dumps([{"accession": "PSI-10", "acronym": "ACME", "title": "ACME", "license": None,
                     "role": "catalogued_not_integrated", "role_reason": "gas flames", "platform": "CIR"}]),
        encoding="utf-8",
    )  # fmt: skip
    by = {i.investigation_id: i for i in build_investigations(tmp_path / "data" / "raw", manifests)}
    assert by["PSI-25"].role == "integrated_model" and by["PSI-98"].role == "integrated_context"
    assert by["PSI-25"].platform == "ISS Microgravity Science Glovebox (MSG)"
    assert by["PSI-10"].role == "catalogued_not_integrated" and by["PSI-10"].license.startswith("not stated")
    assert by["PSI-25"].landing_url == "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25"


def test_saffire_records_are_context_only(tmp_path: Path) -> None:
    write_inv(tmp_path, "PSI-98", [])
    manifests = tmp_path / "data" / "manifests"
    manifests.mkdir(parents=True)
    invs = {i.investigation_id: i for i in build_investigations(tmp_path / "data" / "raw", manifests)}
    csv_path = tmp_path / "saffire_tests.csv"
    csv_path.write_text(
        "investigation_id,test_label,sample,material_family,specimen_geometry,sample_length_mm,sample_width_mm,"
        "flame_configuration,airflow_cm_s,airflow_source_quote,oxygen_percent,total_pressure_kpa,value_method,"
        "outcome,outcome_source,notes\n"
        "PSI-98,FIXTURE S1,S1,sibal_fabric,flat_sheet,940,406,concurrent,20,quote,22.38,102.5,"
        "method file: data/raw/psi/PSI-98/large/x.xlsx,flame signal,src,Date 2016-06-14 UTC\n",
        encoding="utf-8",
    )
    (rec,) = load_saffire(csv_path, invs)
    assert rec.experiment_id == "PSI-98:FIXTURE S1" and rec.campaign_group == "SAFFIRE/FX"
    assert rec.included_in_training is False and rec.exclusion_reason == EXCLUSION
    assert rec.oxygen_percent == 22.38 and rec.airflow_cm_s == 20.0 and rec.n_observations == 0
    assert rec.source_file == "data/raw/psi/PSI-98/large/x.xlsx" and str(rec.test_date) == "2016-06-14"
    assert load_saffire(tmp_path / "absent.csv", invs) == []


@pytest.mark.parametrize("name", ["inv_PSI-25.json"])
def test_real_snapshot_metadata_present(name: str) -> None:
    from blindspots.config import REPO_ROOT

    path = REPO_ROOT / "data" / "raw" / "psi" / "PSI-25" / name
    if not path.is_file():
        pytest.skip("snapshot not present")
    assert json.loads(path.read_text())["doi"] == "10.60555/4qc4-de67"
