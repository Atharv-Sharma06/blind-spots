from __future__ import annotations

import importlib
from pathlib import Path

import pytest

from blindspots import config


def test_repo_root_has_contracts() -> None:
    assert (config.REPO_ROOT / "docs" / "CONTRACTS.md").is_file()
    assert config.RAW_DIR == config.REPO_ROOT / "data" / "raw"
    assert config.MODELS_DIR == config.REPO_ROOT / "models"


def test_env_override(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BLINDSPOTS_ROOT", str(tmp_path))
    try:
        reloaded = importlib.reload(config)
        assert tmp_path.resolve() == reloaded.REPO_ROOT
        assert tmp_path.resolve() / "data" / "curation" == reloaded.CURATION_DIR
    finally:
        monkeypatch.delenv("BLINDSPOTS_ROOT")
        importlib.reload(config)


def test_constants() -> None:
    assert config.COVERAGE_SCALES == {"o2": 2.0, "flow": 0.5, "p": 0.1}
    assert config.P_REF_KPA == 101.325
    assert config.PSI_LANDING_URL.format(id="PSI-25").endswith("/investigations/PSI-25")


def test_versions_missing_are_none(fake_root: Path) -> None:
    assert config.dataset_version() is None
    assert config.model_version() is None


def test_versions_read_from_files(fake_root: Path) -> None:
    (fake_root / "data" / "normalized" / "VERSION").write_text("abc123def456\n")
    (fake_root / "models" / "LATEST").write_text("m-1\n")
    assert config.dataset_version() == "abc123def456"
    assert config.model_version() == "m-1"
