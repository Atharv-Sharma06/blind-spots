"""Re-download manifest files from PSI into a temp directory and verify sha256 (needs network).

CLI ``blindspots fetch-raw``. Original files under ``data/raw`` are never modified. Set
``BLINDSPOTS_FETCH_FILTER`` to a substring to limit which manifest paths are fetched.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

from blindspots.config import MANIFESTS_DIR
from blindspots.ingestion.psi_client import PSIClient, PSIError
from blindspots.pipeline.raw_manifest import MANIFEST_NAME


def verify(
    manifest: dict[str, Any], client: PSIClient, tmp: Path, only: str | None = None
) -> list[dict[str, str]]:
    """Fetch each file with a PSI file name and compare its sha256. Returns one result per file."""
    results: list[dict[str, str]] = []
    for entry in manifest["files"]:
        if only and only not in entry["path"]:
            continue
        name = entry.get("psi_file_name")
        if not name:
            results.append({"path": entry["path"], "status": "skipped_not_in_psi_metadata"})
            continue
        dest = tmp / entry["accession"] / name
        try:
            digest, size = client.download(entry["accession"], name, dest)
        except (PSIError, OSError) as exc:
            results.append({"path": entry["path"], "status": f"error: {exc}"})
            continue
        ok = digest == entry["sha256"] and size == entry["size_bytes"]
        results.append({"path": entry["path"], "status": "ok" if ok else "MISMATCH"})
        dest.unlink(missing_ok=True)
    return results


def main() -> None:
    path = MANIFESTS_DIR / MANIFEST_NAME
    if not path.is_file():
        print(f"{path} not found; run `blindspots raw-manifest` first", file=sys.stderr)
        raise SystemExit(2)
    manifest = json.loads(path.read_text(encoding="utf-8"))
    only = os.environ.get("BLINDSPOTS_FETCH_FILTER")
    with tempfile.TemporaryDirectory(prefix="blindspots-fetch-") as tmp, PSIClient() as client:
        results = verify(manifest, client, Path(tmp), only)
    bad = [r for r in results if r["status"] not in ("ok", "skipped_not_in_psi_metadata")]
    for r in results:
        print(f"{r['status']:>34}  {r['path']}")
    print(f"{len(results) - len(bad)} ok/skipped, {len(bad)} failed")
    if bad:
        raise SystemExit(1)
