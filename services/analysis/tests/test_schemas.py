from __future__ import annotations

from datetime import date
from typing import Any

import pytest
from pydantic import ValidationError

from blindspots.schemas import AtmosphereProfile, ExperimentRecord, Investigation, Observation, Range


def fixture_experiment(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "experiment_id": "PSI-25:O15b",
        "investigation_id": "PSI-25",
        "investigation_name": "fixture",
        "investigation_acronym": "FIX",
        "campaign_group": "fixture/group",
        "test_label": "O15b",
        "flame_configuration": "unknown",
        "gravity_environment": "microgravity (ISS)",
        "source_url": "https://example.invalid/",
        "extraction_method": "structured_nasa_data",
        "extraction_confidence": "high",
        "quality_flags": [],
        "included_in_training": False,
        "n_observations": 0,
    }
    base.update(over)
    return base


def test_experiment_defaults_to_missing() -> None:
    rec = ExperimentRecord.model_validate(fixture_experiment())
    assert rec.oxygen_percent is None
    assert rec.total_pressure_kpa is None
    assert rec.test_date is None


def test_experiment_iso_date() -> None:
    rec = ExperimentRecord.model_validate(fixture_experiment(test_date="2015-03-04"))
    assert rec.test_date == date(2015, 3, 4)
    assert rec.model_dump(mode="json")["test_date"] == "2015-03-04"


def test_extra_forbidden() -> None:
    with pytest.raises(ValidationError):
        ExperimentRecord.model_validate(fixture_experiment(bogus=1))


def test_invalid_enum_rejected() -> None:
    with pytest.raises(ValidationError):
        ExperimentRecord.model_validate(fixture_experiment(extraction_confidence="certain"))


def test_observation_basis_enum() -> None:
    data: dict[str, Any] = {
        "observation_id": "e#s0",
        "experiment_id": "e",
        "investigation_id": "PSI-25",
        "campaign_group": "g",
        "flame_configuration": "opposed",
        "step_index": 0,
        "airflow_basis": "air_display",
        "flow_raw_unit": "air_cm_s",
        "flame_state": "sustained",
        "raw_token": "5",
        "raw_column": "Air display",
        "source_row": 3,
        "confidence": "high",
        "quality_flags": [],
        "included_in_training": True,
    }
    assert Observation.model_validate(data).label is None
    with pytest.raises(ValidationError):
        Observation.model_validate({**data, "airflow_basis": "guess"})


def test_profile_and_range() -> None:
    prof = AtmosphereProfile.model_validate(
        {
            "profile_id": "fixture",
            "name": "Fixture",
            "context": "test",
            "status": "user_hypothetical",
            "oxygen_percent": {"nominal": 21.0},
            "total_pressure_kpa": {"nominal": 101.3, "min": 100.0, "max": 102.0},
            "sources": [{"ref_id": "r", "title": "t"}],
        }
    )
    assert prof.airflow_cm_s is None
    assert prof.oxygen_percent == Range(nominal=21.0)
    with pytest.raises(ValidationError):
        AtmosphereProfile.model_validate({**prof.model_dump(), "status": "official"})


def test_investigation_role() -> None:
    data: dict[str, Any] = {
        "investigation_id": "PSI-25",
        "acronym": "FIX",
        "title": "t",
        "landing_url": "u",
        "license": "CC0-1.0",
        "platform": "p",
        "gravity_environment": "g",
        "role": "integrated_model",
        "role_reason": "r",
        "n_experiments": 1,
        "n_observations": 2,
    }
    assert Investigation.model_validate(data).doi is None
    with pytest.raises(ValidationError):
        Investigation.model_validate({**data, "role": "other"})
