from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

from blindspots.api.app import create_app


def test_health_degraded_without_artifacts(fake_root: Path) -> None:
    resp = TestClient(create_app()).get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {
        "status": "degraded",
        "dataset_version": None,
        "model_version": None,
        "artifacts": {"dataset": False, "models": False, "validation": False},
        "api_version": "1",
    }


def test_health_ok_with_artifacts(fake_root: Path) -> None:
    norm = fake_root / "data" / "normalized"
    norm.joinpath("VERSION").write_text("abc123def456\n")
    for name in ("experiments", "observations", "investigations"):
        norm.joinpath(f"{name}.json").write_text("[]")
    (fake_root / "models" / "LATEST").write_text("m-1\n")
    body = TestClient(create_app()).get("/api/health").json()
    assert body["status"] == "ok"
    assert body["dataset_version"] == "abc123def456"
    assert body["model_version"] == "m-1"
    assert body["artifacts"] == {"dataset": True, "models": True, "validation": False}


def test_cors_allows_local_web_origin(fake_root: Path) -> None:
    resp = TestClient(create_app()).get("/api/health", headers={"Origin": "http://localhost:3000"})
    assert resp.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_error_envelopes(fake_root: Path) -> None:
    class Body(BaseModel):
        x: int

    app = create_app()

    @app.post("/api/_t/validate")
    def validate(body: Body) -> dict[str, int]:
        return {"x": body.x}

    @app.get("/api/_t/missing")
    def missing() -> None:
        raise HTTPException(status_code=404, detail="nope")

    @app.get("/api/_t/boom")
    def boom() -> None:
        raise RuntimeError("secret internals")

    client = TestClient(app, raise_server_exceptions=False)

    r = client.post("/api/_t/validate", json={"x": "abc"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"
    assert r.json()["error"]["details"]["errors"]

    r = client.get("/api/_t/missing")
    assert r.status_code == 404
    assert r.json() == {"error": {"code": "not_found", "message": "nope", "details": {}}}

    r = client.get("/api/nonexistent")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"

    r = client.get("/api/_t/boom")
    assert r.status_code == 500
    assert r.json()["error"] == {"code": "internal", "message": "Internal server error.", "details": {}}
