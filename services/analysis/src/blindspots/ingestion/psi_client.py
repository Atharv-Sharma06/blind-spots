"""Thin httpx client for the public NASA PSI (Physical Sciences Informatics) web service.

Verified endpoints (no login):
* ``GET {BASE}/repo/search?term=<t>&size=<n>[&ffield=<f>&fvalue=<v>...]``
* ``GET {BASE}/repo/investigations/<PSI-ID>``: metadata incl. the ``added`` file list
* ``GET {BASE}/studies/<PSI-ID>/download?file=<exact file_name>&redirect=false``: returns a presigned
  S3 URL as the response body; the file itself is then fetched from that URL.

Presigned URLs contain credentials-like tokens and are never logged or stored.
"""

from __future__ import annotations

import hashlib
import json
import time
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import Any

import httpx

BASE_URL = "https://psi.nasa.gov/geode-py/ws"
LANDING_URL = "https://psi.nasa.gov/physci/repo/data/investigations/{id}"
RETRY_STATUS = {429, 500, 502, 503, 504}
#: files that must never be downloaded (CONTRACTS section 0, rule 7)
BLOCKED_FILE_MARKERS = ("Planned_Test Matrix",)
CHUNK = 1 << 20
Params = list[tuple[str, str | int | float | bool | None]]


class PSIError(RuntimeError):
    """Raised for non-recoverable PSI access errors."""


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(CHUNK), b""):
            h.update(block)
    return h.hexdigest()


class PSIClient:
    def __init__(
        self,
        base_url: str = BASE_URL,
        *,
        timeout: float = 30.0,
        retries: int = 3,
        backoff: float = 1.0,
        client: httpx.Client | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.retries = retries
        self.backoff = backoff
        self._sleep = sleep
        self._client = client or httpx.Client(
            timeout=httpx.Timeout(timeout, connect=10.0), follow_redirects=True
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> PSIClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # ------------------------------------------------------------------ plumbing
    def _get(self, url: str, params: Params | None = None) -> httpx.Response:
        last: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                resp = self._client.get(url, params=params)
            except httpx.TransportError as exc:
                last = exc
            else:
                if resp.status_code not in RETRY_STATUS:
                    resp.raise_for_status()
                    return resp
                last = PSIError(f"HTTP {resp.status_code}")
            if attempt < self.retries:
                self._sleep(self.backoff * (2**attempt))
        raise PSIError(f"GET failed after {self.retries + 1} attempts: {type(last).__name__}") from last

    # ------------------------------------------------------------------ API
    def search(
        self, term: str, size: int = 20, filters: Sequence[tuple[str, str]] | Mapping[str, str] | None = None
    ) -> dict[str, Any]:
        """Search investigations. ``filters`` are (field, value) pairs sent as repeated ffield/fvalue."""
        params: Params = [("term", term), ("size", str(size))]
        items = filters.items() if isinstance(filters, Mapping) else (filters or [])
        for field_name, value in items:
            params += [("ffield", field_name), ("fvalue", value)]
        result: dict[str, Any] = self._get(f"{self.base_url}/repo/search", params).json()
        return result

    def investigation(self, psi_id: str) -> dict[str, Any]:
        result: dict[str, Any] = self._get(f"{self.base_url}/repo/investigations/{psi_id}").json()
        return result

    def presigned_url(self, psi_id: str, file_name: str) -> str:
        """Presigned S3 URL for an exact PSI file name (never logged)."""
        if any(marker in file_name for marker in BLOCKED_FILE_MARKERS):
            raise PSIError(f"refusing to download blocked file: {file_name!r}")
        resp = self._get(
            f"{self.base_url}/studies/{psi_id}/download", [("file", file_name), ("redirect", "false")]
        )
        body = resp.text.strip()
        url = body
        if body.startswith(("{", '"')):
            try:
                parsed = json.loads(body)
            except json.JSONDecodeError:
                parsed = body
            if isinstance(parsed, dict):
                parsed = parsed.get("url") or parsed.get("link") or ""
            url = str(parsed)
        if not url.startswith("https://"):
            raise PSIError(f"unexpected download response for {psi_id}/{file_name!r}")
        return url

    def download(self, psi_id: str, file_name: str, dest: Path) -> tuple[str, int]:
        """Download a file to ``dest`` and return (sha256, size). Writes atomically via ``.part``."""
        url = self.presigned_url(psi_id, file_name)
        dest.parent.mkdir(parents=True, exist_ok=True)
        part = dest.with_name(dest.name + ".part")
        h = hashlib.sha256()
        size = 0
        last: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                with self._client.stream("GET", url) as resp:
                    if resp.status_code in RETRY_STATUS:
                        last = PSIError(f"HTTP {resp.status_code}")
                    else:
                        resp.raise_for_status()
                        h = hashlib.sha256()
                        size = 0
                        with part.open("wb") as fh:
                            for block in resp.iter_bytes(CHUNK):
                                fh.write(block)
                                h.update(block)
                                size += len(block)
                        part.replace(dest)
                        return h.hexdigest(), size
            except httpx.TransportError as exc:
                last = exc
            if attempt < self.retries:
                self._sleep(self.backoff * (2**attempt))
        part.unlink(missing_ok=True)
        raise PSIError(f"download failed for {psi_id}/{file_name!r}: {type(last).__name__}") from last
