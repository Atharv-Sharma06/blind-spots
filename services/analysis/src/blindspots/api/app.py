"""FastAPI application factory."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from blindspots import __version__, config
from blindspots.api.errors import install_error_handlers

CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]


def health_payload() -> dict[str, Any]:
    dataset = config.dataset_version()
    model = config.model_version()
    artifacts = {"dataset": dataset is not None, "models": model is not None}
    return {
        "status": "ok" if all(artifacts.values()) else "degraded",
        "dataset_version": dataset,
        "model_version": model,
        "artifacts": artifacts,
    }


def create_app() -> FastAPI:
    app = FastAPI(title="Blind Spots analysis API", version=__version__)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        return health_payload()

    return app
