"""Investigation rows from PSI metadata snapshots (``inv_*.json``) and the catalogue manifest."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from blindspots.schemas import Investigation

LANDING_URL = "https://psi.nasa.gov/physci/repo/data/investigations/{id}"
DEFAULT_ROLES = {
    "PSI-25": (
        "integrated_model",
        "Solid-fuel flammability tests with per-test O2 and flow schedule (BASS-II).",
    ),
    "PSI-26": (
        "integrated_model",
        "Solid-fuel flammability tests with per-test O2, pressure and flow schedule (BASS).",
    ),
    "PSI-98": ("integrated_context", "Large-scale SAFFIRE fire experiment: context only."),
    "PSI-99": ("integrated_context", "Large-scale SAFFIRE fire experiment: context only."),
    "PSI-100": ("integrated_context", "Large-scale SAFFIRE fire experiment: context only."),
}
MSG_PLATFORM = "ISS Microgravity Science Glovebox (MSG)"
ISS_GRAVITY = "microgravity (ISS)"
CYGNUS_GRAVITY = "microgravity (Cygnus vehicle after ISS departure)"
LICENSE_MISSING = "not stated in PSI metadata"


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else None


def _platform_gravity(acc: str, platform: str | None) -> tuple[str, str]:
    if acc in ("PSI-25", "PSI-26"):
        return MSG_PLATFORM, ISS_GRAVITY
    if acc in ("PSI-98", "PSI-99", "PSI-100"):
        return platform or "SAFFIRE enclosure in Cygnus", CYGNUS_GRAVITY
    return platform or "not stated", "not assessed (catalogued only)"


def build_investigations(raw_dir: Path, manifests_dir: Path) -> list[Investigation]:
    """One row per investigation with a metadata snapshot or a catalogue entry (counts start at 0)."""
    catalogue: dict[str, dict[str, Any]] = {}
    cat = _load_json(manifests_dir / "psi_investigations.json")
    if isinstance(cat, list):
        catalogue = {str(c["accession"]): c for c in cat if isinstance(c, dict) and "accession" in c}
    snapshots: dict[str, dict[str, Any]] = {}
    psi_dir = raw_dir / "psi"
    if psi_dir.is_dir():
        for inv_dir in sorted(p for p in psi_dir.iterdir() if p.is_dir()):
            data = _load_json(inv_dir / f"inv_{inv_dir.name}.json")
            if isinstance(data, dict):
                snapshots[inv_dir.name] = data
    rows: list[Investigation] = []
    for acc in sorted(set(catalogue) | set(snapshots), key=lambda a: (len(a), a)):
        cat_row = catalogue.get(acc, {})
        snap = snapshots.get(acc, {})
        role = cat_row.get("role")
        reason = cat_row.get("role_reason")
        if role is None:
            role, reason = DEFAULT_ROLES.get(
                acc, ("catalogued_not_integrated", "No role assigned in the manifest.")
            )
        platform, gravity = _platform_gravity(acc, cat_row.get("platform") or snap.get("experimentHardware"))
        rows.append(
            Investigation(
                investigation_id=acc,
                acronym=str(snap.get("investigationAcronym") or cat_row.get("acronym") or acc),
                title=str(snap.get("title") or cat_row.get("title") or acc),
                doi=snap.get("doi") or cat_row.get("doi") or None,
                landing_url=LANDING_URL.format(id=acc),
                license=str(snap.get("licenseIdentifier") or cat_row.get("license") or LICENSE_MISSING),
                platform=platform,
                gravity_environment=gravity,
                role=role,
                role_reason=str(reason or ""),
                n_experiments=0,
                n_observations=0,
            )
        )
    return rows
