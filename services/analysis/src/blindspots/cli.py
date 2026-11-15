"""Command line interface: `blindspots <command>`."""

from __future__ import annotations

import importlib
from collections.abc import Callable
from pathlib import Path
from typing import Any

import typer

app = typer.Typer(help="Blind Spots analysis service.", no_args_is_help=True, add_completion=False)


def _run_pipeline(module: str, *args: Any) -> None:
    """Import blindspots.pipeline.<module> lazily and call its main()."""
    name = f"blindspots.pipeline.{module}"
    try:
        mod = importlib.import_module(name)
    except ModuleNotFoundError as exc:
        if exc.name == name:
            typer.echo(f"not implemented yet: {name}", err=True)
            raise typer.Exit(code=2) from exc
        raise
    main: Callable[..., Any] | None = getattr(mod, "main", None)
    if main is None:
        typer.echo(f"not implemented yet: {name}", err=True)
        raise typer.Exit(code=2)
    main(*args)


@app.command("build-dataset")
def build_dataset() -> None:
    """Build the normalized dataset in data/normalized."""
    _run_pipeline("build_dataset")


@app.command("raw-manifest")
def raw_manifest() -> None:
    """Write the raw file manifest."""
    _run_pipeline("raw_manifest")


@app.command("fetch-raw")
def fetch_raw() -> None:
    """Fetch raw NASA PSI files."""
    _run_pipeline("fetch_raw")


@app.command("train")
def train() -> None:
    """Train and validate models."""
    _run_pipeline("train")


@app.command("export-artifacts")
def export_artifacts(
    snapshot: Path | None = typer.Option(
        None, "--snapshot", help="Directory for the static JSON snapshot (default apps/web/public/snapshot)."
    ),
) -> None:
    """Export the static snapshot of every API response (docs/API.md "Static snapshot")."""
    _run_pipeline("export_artifacts", *([] if snapshot is None else [snapshot]))


@app.command("retrospective")
def retrospective() -> None:
    """Retrospective evaluation of target-aware acquisition against baselines."""
    _run_pipeline("retrospective")


@app.command("serve")
def serve() -> None:
    """Run the API on 127.0.0.1:8000."""
    import uvicorn

    uvicorn.run("blindspots.api.app:create_app", factory=True, host="127.0.0.1", port=8000)


if __name__ == "__main__":
    app()
