"""FastAPI application factory."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from blindspots import __version__
from blindspots.api import routes_data, routes_findings, routes_model
from blindspots.api.errors import install_error_handlers

CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]


def create_app() -> FastAPI:
    app = FastAPI(title="Blind Spots analysis API", version=__version__)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)
    app.include_router(routes_data.router)
    app.include_router(routes_model.router)
    app.include_router(routes_findings.router)
    return app
