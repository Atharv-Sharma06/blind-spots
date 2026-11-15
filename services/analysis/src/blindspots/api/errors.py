"""Error envelope (CONTRACTS section 8) and exception handlers."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

logger = logging.getLogger("blindspots.api")

_STATUS_CODES = {
    400: "validation_error",
    404: "not_found",
    422: "validation_error",
    503: "artifact_missing",
}


class ApiError(Exception):
    """Raise from route code to produce the standard envelope."""

    def __init__(
        self, status_code: int, code: str, message: str, details: dict[str, Any] | None = None
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}


def error_response(
    status_code: int, code: str, message: str, details: dict[str, Any] | None = None
) -> JSONResponse:
    body = {"error": {"code": code, "message": message, "details": details or {}}}
    return JSONResponse(status_code=status_code, content=jsonable_encoder(body))


async def _api_error_handler(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ApiError)
    return error_response(exc.status_code, exc.code, exc.message, exc.details)


async def _http_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, HTTPException)
    code = _STATUS_CODES.get(exc.status_code, "internal" if exc.status_code >= 500 else "validation_error")
    message = exc.detail if isinstance(exc.detail, str) else "Request failed."
    details: dict[str, Any] = {} if isinstance(exc.detail, str) else {"detail": exc.detail}
    return error_response(exc.status_code, code, message, details)


async def _validation_handler(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    return error_response(
        422, "validation_error", "Request validation failed.", {"errors": jsonable_encoder(exc.errors())}
    )


async def _unexpected_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error", exc_info=exc)
    return error_response(500, "internal", "Internal server error.")


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _api_error_handler)
    app.add_exception_handler(HTTPException, _http_exception_handler)
    app.add_exception_handler(RequestValidationError, _validation_handler)
    app.add_exception_handler(Exception, _unexpected_handler)
