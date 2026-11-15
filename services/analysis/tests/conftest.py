from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture
def fake_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point blindspots.config at an empty temporary repo layout (fixture data only)."""
    from blindspots import config

    (tmp_path / "data" / "normalized").mkdir(parents=True)
    (tmp_path / "models").mkdir()
    monkeypatch.setattr(config, "NORMALIZED_DIR", tmp_path / "data" / "normalized")
    monkeypatch.setattr(config, "MODELS_DIR", tmp_path / "models")
    return tmp_path
