"""Atmosphere profiles (``data/manifests/atmosphere_profiles.json``): load and validate."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from blindspots.schemas import AtmosphereProfile

PROFILES_FILE = "atmosphere_profiles.json"
STANDARD_ATMOSPHERE_KPA = 101.325
PLACEHOLDER_SOURCE = "standard atmosphere placeholder pending sourced ISS profile"


@dataclass
class ProfilesData:
    raw: dict[str, Any] | None = None
    profiles: list[AtmosphereProfile] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    extra_keys: dict[str, list[str]] = field(default_factory=dict)  # profile_id -> keys not in the schema


def load_profiles(path: Path) -> ProfilesData:
    """Load and validate profiles. Unknown keys (e.g. psia mirrors) are reported, not rejected."""
    data = ProfilesData()
    if not path.is_file():
        return data
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        data.errors.append(f"{path.name}: invalid JSON ({exc})")
        return data
    data.raw = raw
    items = raw.get("profiles", []) if isinstance(raw, dict) else raw
    allowed = set(AtmosphereProfile.model_fields)
    seen: set[str] = set()
    for i, item in enumerate(items):
        pid = str(item.get("profile_id", f"#{i}")) if isinstance(item, dict) else f"#{i}"
        if not isinstance(item, dict):
            data.errors.append(f"profile {pid}: not an object")
            continue
        extras = sorted(set(item) - allowed)
        if extras:
            data.extra_keys[pid] = extras
        try:
            prof = AtmosphereProfile.model_validate({k: v for k, v in item.items() if k in allowed})
        except ValidationError as exc:
            data.errors.append(
                f"profile {pid}: {exc.error_count()} validation errors: {exc.errors()[0]['msg']}"
            )
            continue
        if prof.profile_id in seen:
            data.errors.append(f"profile {pid}: duplicate profile_id")
            continue
        seen.add(prof.profile_id)
        data.profiles.append(prof)
    return data


def iss_nominal_pressure(profiles: list[AtmosphereProfile]) -> tuple[float, str, bool]:
    """(pressure_kpa, source text, sourced) for the ISS nominal profile.

    Picks the first profile whose id contains ``iss`` and ``nominal``; otherwise the standard
    atmosphere with the documented placeholder source and ``sourced=False``.
    """
    for p in profiles:
        pid = p.profile_id.lower()
        if "iss" in pid and "nominal" in pid and p.total_pressure_kpa.nominal is not None:
            refs = ", ".join(s.ref_id for s in p.sources) or "no source refs"
            text = (
                f"data/manifests/atmosphere_profiles.json profile '{p.profile_id}' "
                f"nominal total pressure ({refs})"
            )
            return p.total_pressure_kpa.nominal, text, True
    return STANDARD_ATMOSPHERE_KPA, PLACEHOLDER_SOURCE, False
