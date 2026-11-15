from __future__ import annotations

import importlib
import sys
import types
from typing import Any

import pytest
from typer.testing import CliRunner

from blindspots import cli

runner = CliRunner()

COMMANDS = {
    "build-dataset": "build_dataset",
    "raw-manifest": "raw_manifest",
    "fetch-raw": "fetch_raw",
    "train": "train",
    "export-artifacts": "export_artifacts",
}


def test_help_lists_commands() -> None:
    result = runner.invoke(cli.app, ["--help"])
    assert result.exit_code == 0
    for name in [*COMMANDS, "serve"]:
        assert name in result.output


@pytest.mark.parametrize(("command", "module"), COMMANDS.items())
def test_missing_pipeline_module_exits_2(command: str, module: str, monkeypatch: pytest.MonkeyPatch) -> None:
    full = f"blindspots.pipeline.{module}"

    def fake_import(name: str, *a: Any, **k: Any) -> Any:
        raise ModuleNotFoundError(f"No module named {name!r}", name=name)

    monkeypatch.setattr(importlib, "import_module", fake_import)
    result = runner.invoke(cli.app, [command])
    assert result.exit_code == 2
    assert f"not implemented yet: {full}" in result.output


@pytest.mark.parametrize(("command", "module"), COMMANDS.items())
def test_existing_pipeline_module_main_called(
    command: str, module: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[str] = []
    fake = types.ModuleType(f"blindspots.pipeline.{module}")
    fake.main = lambda: calls.append(module)  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, f"blindspots.pipeline.{module}", fake)
    result = runner.invoke(cli.app, [command])
    assert result.exit_code == 0
    assert calls == [module]


def test_serve_uses_factory(monkeypatch: pytest.MonkeyPatch) -> None:
    import uvicorn

    captured: dict[str, Any] = {}
    monkeypatch.setattr(uvicorn, "run", lambda *a, **k: captured.update(args=a, kwargs=k))
    result = runner.invoke(cli.app, ["serve"])
    assert result.exit_code == 0
    assert captured["args"] == ("blindspots.api.app:create_app",)
    assert captured["kwargs"] == {"factory": True, "host": "127.0.0.1", "port": 8000}
