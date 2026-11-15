"""Candidate grid, demonstrated envelope and feasibility status (never a feasibility claim)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

from blindspots.coverage.coverage import SCALES, inside_hull, nn_distance, to_coords

WITHIN = "within_demonstrated_envelope"
OUTSIDE = "outside_demonstrated_envelope"
STATUS_TEXT = {
    WITHIN: (
        "Inside conditions already run in the integrated investigations "
        "(not an engineering feasibility assessment)."
    ),
    OUTSIDE: "Feasibility not verified; requires qualified review.",
}

O2_GRID = np.arange(12.0, 40.0 + 1e-9, 1.0)
PRESSURE_GRID_KPA = (50.0, 56.5, 60.0, 70.3, 80.0, 90.0, 101.3)
N_FLOW = 12
FLOW_RANGE = (0.5, 45.0)


@dataclass(frozen=True)
class Envelope:
    """Box + convex hull of observed conditions (analysis coordinates)."""

    obs: np.ndarray

    def contains(self, x: np.ndarray) -> np.ndarray:
        x = np.atleast_2d(x)
        if len(self.obs) == 0:
            return np.zeros(len(x), dtype=bool)
        lo, hi = self.obs.min(axis=0), self.obs.max(axis=0)
        pad = np.where(hi - lo < 1e-9, SCALES, 0.0)
        in_box = np.all((x >= lo - pad - 1e-12) & (x <= hi + pad + 1e-12), axis=1)
        return in_box & inside_hull(x, self.obs)


def demonstrated_envelope(obs_coords: np.ndarray) -> Envelope:
    return Envelope(np.atleast_2d(np.asarray(obs_coords, dtype=float)).reshape(-1, 3))


def feasibility_status(envelope: Envelope, x: np.ndarray) -> list[str]:
    return [WITHIN if w else OUTSIDE for w in envelope.contains(x)]


@dataclass(frozen=True)
class CandidateSet:
    raw: np.ndarray  # (n, 3): o2 %, pressure kPa, airflow cm/s
    X: np.ndarray  # (n, 3) analysis coordinates
    status: list[str]
    nn_d: np.ndarray

    def __len__(self) -> int:
        return len(self.raw)

    def subset(self, idx: Any) -> CandidateSet:
        idx = np.asarray(idx, dtype=int)
        return CandidateSet(self.raw[idx], self.X[idx], [self.status[i] for i in idx], self.nn_d[idx])


def candidate_raw_grid(target_pressure_kpa: float | None = None) -> np.ndarray:
    pressures = sorted(
        {*PRESSURE_GRID_KPA, *([] if target_pressure_kpa is None else [float(target_pressure_kpa)])}
    )
    flows = np.geomspace(*FLOW_RANGE, N_FLOW)
    go, gp, gu = np.meshgrid(O2_GRID, np.array(pressures), flows, indexing="ij")
    return np.column_stack([go.ravel(), gp.ravel(), gu.ravel()])


def build_candidates(
    obs_coords: np.ndarray, raw: np.ndarray | None = None, target_pressure_kpa: float | None = None
) -> CandidateSet:
    """Candidate set with feasibility status and coverage gap against the observations."""
    if raw is None:
        raw = candidate_raw_grid(target_pressure_kpa)
    raw = np.asarray(raw, dtype=float).reshape(-1, 3)
    x = to_coords(raw[:, 0], raw[:, 1], raw[:, 2]) if len(raw) else np.zeros((0, 3))
    env = demonstrated_envelope(obs_coords)
    status = feasibility_status(env, x) if len(raw) else []
    return CandidateSet(raw, x, status, nn_distance(x, obs_coords) if len(raw) else np.zeros(0))
