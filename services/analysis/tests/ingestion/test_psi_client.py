from __future__ import annotations

import hashlib
from pathlib import Path

import httpx
import pytest

from blindspots.ingestion.psi_client import PSIClient, PSIError

PRESIGNED = "https://example-bucket.invalid/file.bin?signature=fixture"


def make_client(handler: httpx.MockTransport, **kw: object) -> PSIClient:
    return PSIClient(client=httpx.Client(transport=handler), sleep=lambda _s: None, **kw)  # type: ignore[arg-type]


def test_search_sends_repeated_filters() -> None:
    seen: list[httpx.URL] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url)
        return httpx.Response(200, json={"hits": {"total": 0}})

    client = make_client(httpx.MockTransport(handler))
    client.search("flame", size=5, filters=[("Research Area", "combustion science"), ("Platform", "ISS")])
    q = seen[0].params
    assert q["term"] == "flame" and q["size"] == "5"
    assert q.get_list("ffield") == ["Research Area", "Platform"]
    assert q.get_list("fvalue") == ["combustion science", "ISS"]
    assert seen[0].path.endswith("/repo/search")


def test_investigation() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/repo/investigations/PSI-25")
        return httpx.Response(200, json={"doi": "10.60555/4qc4-de67"})

    assert make_client(httpx.MockTransport(handler)).investigation("PSI-25")["doi"] == "10.60555/4qc4-de67"


def test_retries_then_succeeds() -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(503) if calls["n"] < 3 else httpx.Response(200, json={"ok": True})

    assert make_client(httpx.MockTransport(handler)).investigation("PSI-25") == {"ok": True}
    assert calls["n"] == 3


def test_gives_up_after_retries() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom")

    with pytest.raises(PSIError):
        make_client(httpx.MockTransport(handler), retries=2).investigation("PSI-25")


def test_client_error_is_not_retried() -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(404)

    with pytest.raises(httpx.HTTPStatusError):
        make_client(httpx.MockTransport(handler)).investigation("PSI-999")
    assert calls["n"] == 1


def test_presigned_url_plain_and_json() -> None:
    def plain(request: httpx.Request) -> httpx.Response:
        assert request.url.params["file"] == "PSI-25_x y.xlsx" and request.url.params["redirect"] == "false"
        return httpx.Response(200, text=PRESIGNED)

    assert make_client(httpx.MockTransport(plain)).presigned_url("PSI-25", "PSI-25_x y.xlsx") == PRESIGNED
    as_json = httpx.MockTransport(lambda r: httpx.Response(200, json={"url": PRESIGNED}))
    assert make_client(as_json).presigned_url("PSI-25", "a.xlsx") == PRESIGNED
    bad = httpx.MockTransport(lambda r: httpx.Response(200, text="<html>login</html>"))
    with pytest.raises(PSIError):
        make_client(bad).presigned_url("PSI-25", "a.xlsx")


def test_download_returns_sha256_and_size(tmp_path: Path) -> None:
    payload = b"fixture bytes" * 1000

    def handler(request: httpx.Request) -> httpx.Response:
        if "studies" in request.url.path:
            return httpx.Response(200, text=PRESIGNED)
        return httpx.Response(200, content=payload)

    dest = tmp_path / "sub" / "f.bin"
    digest, size = make_client(httpx.MockTransport(handler)).download("PSI-25", "f.bin", dest)
    assert digest == hashlib.sha256(payload).hexdigest() and size == len(payload)
    assert dest.read_bytes() == payload and not dest.with_name("f.bin.part").exists()


def test_blocked_file_is_never_requested() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("no request may be sent")

    with pytest.raises(PSIError):
        make_client(httpx.MockTransport(handler)).presigned_url(
            "PSI-26", "PSI-26_Science Documents_Planned_Test Matrix.xlsx"
        )
