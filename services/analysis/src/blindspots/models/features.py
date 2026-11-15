"""Analysis coordinates (CONTRACTS section 4) and training-set construction (section 3 columns)."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from numpy.typing import ArrayLike, NDArray

FloatArray = NDArray[np.float64]

P_REF_KPA = 101.325
COORD_NAMES = ("z_o2", "z_flow", "z_p")


def to_coords(o2_percent: ArrayLike, airflow_cm_s: ArrayLike, pressure_kpa: ArrayLike) -> FloatArray:
    """Return an (n, 3) array [z_o2, z_flow = ln(1 + flow), z_p = ln(p / 101.325)]."""
    o2, flow, p = np.broadcast_arrays(
        np.atleast_1d(np.asarray(o2_percent, dtype=float)),
        np.atleast_1d(np.asarray(airflow_cm_s, dtype=float)),
        np.atleast_1d(np.asarray(pressure_kpa, dtype=float)),
    )
    if np.any(flow <= -1.0):
        raise ValueError("airflow_cm_s must be > -1")
    if np.any(p <= 0.0):
        raise ValueError("pressure_kpa must be > 0")
    return np.column_stack([o2, np.log1p(flow), np.log(p / P_REF_KPA)]).astype(float)


def flow_to_z(airflow_cm_s: ArrayLike) -> FloatArray:
    return np.asarray(np.log1p(np.asarray(airflow_cm_s, dtype=float)), dtype=float)


def z_to_flow(z_flow: ArrayLike) -> FloatArray:
    return np.asarray(np.expm1(np.asarray(z_flow, dtype=float)), dtype=float)


def pressure_to_z(pressure_kpa: ArrayLike) -> FloatArray:
    return np.asarray(np.log(np.asarray(pressure_kpa, dtype=float) / P_REF_KPA), dtype=float)


def z_to_pressure(z_p: ArrayLike) -> FloatArray:
    return np.asarray(P_REF_KPA * np.exp(np.asarray(z_p, dtype=float)), dtype=float)


def from_coords(Z: ArrayLike) -> tuple[FloatArray, FloatArray, FloatArray]:
    """Inverse of to_coords: returns (o2_percent, airflow_cm_s, pressure_kpa)."""
    Z = np.atleast_2d(np.asarray(Z, dtype=float))
    return Z[:, 0].copy(), z_to_flow(Z[:, 1]), z_to_pressure(Z[:, 2])


@dataclass(frozen=True)
class TrainingSet:
    X: FloatArray  # (n, 3) coordinates
    y: NDArray[np.int64]  # (n,) labels in {0, 1}
    groups: NDArray[np.str_]  # experiment_id per row (resampling / CV unit)
    campaign_group: NDArray[np.str_]
    observation_ids: NDArray[np.str_]
    family: str
    configuration: str | None = None
    n_dropped_missing_coords: int = 0

    @property
    def n(self) -> int:
        return int(self.X.shape[0])

    @property
    def n_groups(self) -> int:
        return int(np.unique(self.groups).size)

    def subset(self, idx: ArrayLike) -> TrainingSet:
        ii = np.asarray(idx, dtype=int)
        return TrainingSet(
            X=self.X[ii],
            y=self.y[ii],
            groups=self.groups[ii],
            campaign_group=self.campaign_group[ii],
            observation_ids=self.observation_ids[ii],
            family=self.family,
            configuration=self.configuration,
            n_dropped_missing_coords=self.n_dropped_missing_coords,
        )


_REQUIRED = (
    "observation_id",
    "experiment_id",
    "campaign_group",
    "material_family",
    "flame_configuration",
    "oxygen_percent",
    "airflow_cm_s",
    "pressure_for_analysis_kpa",
    "label",
    "included_in_training",
)


def build_training_set(
    observations_df: pd.DataFrame, family: str, configuration: str | None = None
) -> TrainingSet:
    """Select training rows of one material family (and optionally flame configuration).

    Rows are kept when included_in_training is True and label is not null. Rows with a missing
    coordinate cannot be mapped to the analysis space and are dropped (counted, never imputed).
    Pressure is pressure_for_analysis_kpa (measured, else the flagged documented assumption).
    """
    missing = [c for c in _REQUIRED if c not in observations_df.columns]
    if missing:
        raise KeyError(f"observations table is missing columns: {missing}")
    df = observations_df
    mask = (
        (df["material_family"] == family)
        & df["included_in_training"].fillna(False).astype(bool)
        & df["label"].notna()
    )
    if configuration is not None:
        mask &= df["flame_configuration"] == configuration
    sel = df.loc[mask]
    coord_cols = ["oxygen_percent", "airflow_cm_s", "pressure_for_analysis_kpa"]
    complete = sel[coord_cols].notna().all(axis=1)
    n_dropped = int((~complete).sum())
    sel = sel.loc[complete]
    sort_cols = ["experiment_id", "step_index"] if "step_index" in sel.columns else ["observation_id"]
    sel = sel.sort_values(sort_cols, kind="mergesort")
    X = to_coords(
        sel["oxygen_percent"].to_numpy(dtype=float),
        sel["airflow_cm_s"].to_numpy(dtype=float),
        sel["pressure_for_analysis_kpa"].to_numpy(dtype=float),
    ).reshape(-1, 3)
    y = sel["label"].to_numpy(dtype=float).astype(np.int64)
    if not np.isin(y, (0, 1)).all():
        raise ValueError("labels must be 0/1")
    return TrainingSet(
        X=X,
        y=y,
        groups=sel["experiment_id"].to_numpy(dtype=str),
        campaign_group=sel["campaign_group"].to_numpy(dtype=str),
        observation_ids=sel["observation_id"].to_numpy(dtype=str),
        family=family,
        configuration=configuration,
        n_dropped_missing_coords=n_dropped,
    )
