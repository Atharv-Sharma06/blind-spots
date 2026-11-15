"""Repository root, data paths, shared constants and artifact versions."""

from __future__ import annotations

import os
from pathlib import Path

ROOT_ENV_VAR = "BLINDSPOTS_ROOT"


def _find_repo_root() -> Path:
    env = os.environ.get(ROOT_ENV_VAR)
    if env:
        return Path(env).expanduser().resolve()
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "data").is_dir() and (parent / "docs" / "CONTRACTS.md").is_file():
            return parent
    raise RuntimeError(
        f"Could not locate the repository root (a directory with data/ and docs/CONTRACTS.md). "
        f"Set {ROOT_ENV_VAR}."
    )


REPO_ROOT: Path = _find_repo_root()
DATA_DIR: Path = REPO_ROOT / "data"
RAW_DIR: Path = DATA_DIR / "raw"
CURATION_DIR: Path = DATA_DIR / "curation"
MANIFESTS_DIR: Path = DATA_DIR / "manifests"
NORMALIZED_DIR: Path = DATA_DIR / "normalized"
MODELS_DIR: Path = REPO_ROOT / "models"
DOCS_DIR: Path = REPO_ROOT / "docs"

# Model-independent coverage reference scales (CONTRACTS section 4).
COVERAGE_SCALES: dict[str, float] = {"o2": 2.0, "flow": 0.5, "p": 0.1}
P_REF_KPA = 101.325
PSI_LANDING_URL = "https://psi.nasa.gov/physci/repo/data/investigations/{id}"


def _read_version(path: Path) -> str | None:
    try:
        text = path.read_text(encoding="utf-8").strip()
    except OSError:
        return None
    return text or None


def dataset_version() -> str | None:
    """Content hash of the normalized dataset, or None when it has not been built."""
    return _read_version(NORMALIZED_DIR / "VERSION")


def model_version() -> str | None:
    """Identifier of the latest trained model set, or None when none exists."""
    return _read_version(MODELS_DIR / "LATEST")
