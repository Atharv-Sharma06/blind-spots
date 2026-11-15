"""Deterministic export of the normalized dataset (parquet, csv, json) and the dataset VERSION."""

from __future__ import annotations

import csv
import datetime as dt
import hashlib
import json
import re
import types
import typing
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import pyarrow as pa  # type: ignore[import-untyped]
import pyarrow.parquet as pq  # type: ignore[import-untyped]
from pydantic import BaseModel

from blindspots.schemas import ExperimentRecord, Investigation, Observation

SIG_DIGITS = 12
_NATURAL = re.compile(r"(\d+)")


def norm_float(x: float) -> float:
    """Stable float formatting: 12 significant digits."""
    return float(f"{x:.{SIG_DIGITS}g}")


def _normalize(obj: Any) -> Any:
    if isinstance(obj, float):
        return norm_float(obj)
    if isinstance(obj, dict):
        return {k: _normalize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_normalize(v) for v in obj]
    return obj


def records_json(models: Sequence[BaseModel]) -> list[dict[str, Any]]:
    return [_normalize(m.model_dump(mode="json")) for m in models]


def natural_key(text: str) -> list[Any]:
    return [int(p) if p.isdigit() else p for p in _NATURAL.split(text)]


def sort_investigations(rows: Sequence[Investigation]) -> list[Investigation]:
    return sorted(rows, key=lambda r: natural_key(r.investigation_id))


def sort_experiments(rows: Sequence[ExperimentRecord]) -> list[ExperimentRecord]:
    return sorted(
        rows,
        key=lambda e: (
            natural_key(e.investigation_id),
            e.source_file or "",
            e.source_sheet or "",
            e.source_row or 0,
            e.experiment_id,
        ),
    )


def sort_observations(rows: Sequence[Observation], experiment_order: dict[str, int]) -> list[Observation]:
    return sorted(
        rows, key=lambda o: (experiment_order.get(o.experiment_id, 10**9), o.experiment_id, o.step_index)
    )


def _arrow_type(annotation: Any) -> pa.DataType:
    origin = typing.get_origin(annotation)
    args = typing.get_args(annotation)
    if origin in (typing.Union, types.UnionType):
        non_none = [a for a in args if a is not type(None)]
        return _arrow_type(non_none[0])
    if origin is typing.Literal:
        return pa.string()
    if origin is list:
        return pa.list_(_arrow_type(args[0]))
    if annotation is bool:
        return pa.bool_()
    if annotation is int:
        return pa.int64()
    if annotation is float:
        return pa.float64()
    if annotation is dt.date:
        return pa.date32()
    return pa.string()


def arrow_schema(model: type[BaseModel]) -> pa.Schema:
    hints = typing.get_type_hints(model)
    return pa.schema([pa.field(name, _arrow_type(hints[name])) for name in model.model_fields])


def write_parquet(models: Sequence[BaseModel], model_cls: type[BaseModel], path: Path) -> None:
    schema = arrow_schema(model_cls)
    columns: dict[str, list[Any]] = {name: [] for name in model_cls.model_fields}
    for m in models:
        for name in columns:
            v = getattr(m, name)
            columns[name].append(norm_float(v) if isinstance(v, float) else v)
    table = pa.table(columns, schema=schema)
    pq.write_table(table, path, compression="zstd", use_dictionary=False, write_statistics=False)


def _csv_cell(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float):
        return repr(norm_float(v))
    if isinstance(v, (list, dict)):
        return json.dumps(_normalize(v), ensure_ascii=False, separators=(",", ":"))
    return str(v)


def write_csv(rows: list[dict[str, Any]], columns: Sequence[str], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(columns)
        for r in rows:
            w.writerow([_csv_cell(r[c]) for c in columns])


def canonical_json(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def dataset_version(content: dict[str, Any]) -> str:
    """First 12 hex chars of sha256 over the canonical JSON of the normalized content."""
    return hashlib.sha256(canonical_json(content).encode("utf-8")).hexdigest()[:12]


def write_json(obj: Any, path: Path) -> None:
    path.write_text(json.dumps(obj, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def export_dataset(
    out_dir: Path,
    investigations: Sequence[Investigation],
    experiments: Sequence[ExperimentRecord],
    observations: Sequence[Observation],
    profiles: dict[str, Any] | None,
    report: dict[str, Any],
) -> str:
    """Write all normalized outputs into ``out_dir`` and return the dataset version."""
    out_dir.mkdir(parents=True, exist_ok=True)
    inv_sorted = sort_investigations(investigations)
    exp_sorted = sort_experiments(experiments)
    order = {e.experiment_id: i for i, e in enumerate(exp_sorted)}
    obs_sorted = sort_observations(observations, order)
    content: dict[str, Any] = {
        "investigations": records_json(inv_sorted),
        "experiments": records_json(exp_sorted),
        "observations": records_json(obs_sorted),
        "atmosphere_profiles": _normalize(profiles) if profiles is not None else None,
    }
    version = dataset_version(content)
    for name, models, cls in (
        ("investigations", inv_sorted, Investigation),
        ("experiments", exp_sorted, ExperimentRecord),
        ("observations", obs_sorted, Observation),
    ):
        write_parquet(models, cls, out_dir / f"{name}.parquet")
        write_csv(content[name], list(cls.model_fields), out_dir / f"{name}.csv")
        write_json(content[name], out_dir / f"{name}.json")
    if profiles is not None:
        write_json(content["atmosphere_profiles"], out_dir / "atmosphere_profiles.json")
    report = {**report, "dataset_version": version}
    write_json(report, out_dir / "dataset_report.json")
    (out_dir / "VERSION").write_text(version + "\n", encoding="utf-8")
    return version
