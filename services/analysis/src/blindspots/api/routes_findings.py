"""GET /api/findings: ranked materials and cabins with plain-word, k-of-n findings (docs/API.md)."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel

from blindspots import config
from blindspots.api import deps, routes_data
from blindspots.findings.compute import compute_findings

router = APIRouter(prefix="/api")

PressureBasis = Literal["measured", "assumed", "missing"]


class FindingsPoint(BaseModel):
    oxygen_percent: float
    airflow_cm_s: float | None
    pressure_kpa: float | None
    pressure_basis: PressureBasis
    o2_basis: Literal["measured", "interpolated"]
    n_at_value: int
    observation_ids: list[str]
    experiment_ids: list[str]


class Finding(BaseModel):
    id: str
    kind: Literal["lowest_o2_burning", "overlap", "airflow", "pressure_gap"]
    pillar: Literal["prevention", "suppression"]
    headline: str
    interpretation: str
    k: int | None
    n: int | None
    basis: Literal["measured", "derived", "assumed"]
    observation_ids: list[str]
    experiment_ids: list[str]


class AirflowBin(BaseModel):
    lo: float
    hi: float | None
    n: int
    n_sustained: int
    lowest_o2_burning: float | None


class TestedRanges(BaseModel):
    oxygen_percent: list[float] | None
    airflow_cm_s: list[float] | None
    pressure_kpa: list[float] | None
    pressure_basis: Literal["measured", "assumed", "mixed"]


class FindingsMaterial(BaseModel):
    rank: int
    group_id: str
    label: str
    material_family: str
    flame_configuration: str
    n_experiments: int
    n_observations: int
    investigation_ids: list[str]
    campaigns: list[str]
    model_status: Literal["modeled", "insufficient_data"]
    model_reason: str | None
    lowest_o2_burning: FindingsPoint | None
    highest_o2_out: FindingsPoint | None
    overlap_o2: list[float] | None
    airflow_bins: list[AirflowBin]
    n_airflow_missing: int
    tested_ranges: TestedRanges
    findings: list[Finding]


class FindingsCabin(BaseModel):
    rank: int
    profile_id: str
    name: str
    oxygen_percent: float | None
    total_pressure_kpa: float | None
    comparable_observations: int
    groups_with_comparable: int
    n_groups: int
    sentence: str
    pillar: Literal["prevention"]


class FindingsSummary(BaseModel):
    n_observations: int
    n_experiments: int
    n_groups: int
    n_investigations: int
    n_sustained: int
    n_not_sustained: int


class FindingsResponse(BaseModel):
    dataset_version: str | None
    model_version: str | None
    ranking_rule: str
    pillar_rule: str
    summary: FindingsSummary
    materials: list[FindingsMaterial]
    cabins: list[FindingsCabin]
    notes: list[str]


@router.get("/findings", response_model=FindingsResponse)
def findings() -> dict[str, Any]:
    store = deps.require_store()
    return compute_findings(
        observations=store.observations,
        groups=deps.groups_with_status(store),
        targets=routes_data.targets(),
        headline=routes_data.headline(None),
        dataset_version=config.dataset_version(),
        model_version=config.model_version(),
    )
