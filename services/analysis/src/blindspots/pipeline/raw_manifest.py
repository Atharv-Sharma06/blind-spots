"""Raw file manifest: ``data/manifests/raw_files.json`` (CLI ``blindspots raw-manifest``).

Scans ``data/raw/psi/<PSI-ID>/`` (skipping ``large/`` and the ``inv_*.json`` snapshots), joins each file
with its entry in the investigation metadata snapshot (``added`` list) and records the sha256.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from blindspots.config import MANIFESTS_DIR, RAW_DIR, REPO_ROOT
from blindspots.ingestion.psi_client import BLOCKED_FILE_MARKERS, LANDING_URL, sha256_file

RETRIEVED_AT = "2026-11-15"
MANIFEST_NAME = "raw_files.json"
_SKIP_NAMES = {".DS_Store"}


def _load_inv(inv_path: Path) -> dict[str, Any]:
    if not inv_path.is_file():
        return {}
    data: dict[str, Any] = json.loads(inv_path.read_text(encoding="utf-8"))
    return data


def build_manifest(raw_dir: Path = RAW_DIR, repo_root: Path = REPO_ROOT) -> dict[str, Any]:
    psi_dir = raw_dir / "psi"
    files: list[dict[str, Any]] = []
    investigations: dict[str, dict[str, Any]] = {}
    for inv_dir in sorted(p for p in psi_dir.iterdir() if p.is_dir()) if psi_dir.is_dir() else []:
        acc = inv_dir.name
        inv_path = inv_dir / f"inv_{acc}.json"
        inv = _load_inv(inv_path)
        by_name = {a.get("file_name"): a for a in inv.get("added", []) if isinstance(a, dict)}
        doi = inv.get("doi") or None
        license_id = inv.get("licenseIdentifier") or None
        investigations[acc] = {
            "inv_snapshot": inv_path.relative_to(repo_root).as_posix() if inv_path.is_file() else None,
            "doi": doi,
            "landing_url": LANDING_URL.format(id=acc),
            "license": license_id,
            "license_name": inv.get("licenseName") or None,
        }
        for path in sorted(inv_dir.iterdir()):
            if not path.is_file() or path.name in _SKIP_NAMES or path.name.startswith("inv_"):
                continue
            if any(marker in path.name for marker in BLOCKED_FILE_MARKERS):
                continue  # never recorded (CONTRACTS section 0, rule 7)
            meta = by_name.get(path.name)
            files.append(
                {
                    "accession": acc,
                    "path": path.relative_to(repo_root).as_posix(),
                    "psi_file_name": meta.get("file_name") if meta else None,
                    "psi_file_size": meta.get("file_size") if meta else None,
                    "psi_legacy_s3_path": meta.get("psi_legacy_s3_path") if meta else None,
                    "in_psi_metadata": meta is not None,
                    "doi": doi,
                    "landing_url": LANDING_URL.format(id=acc),
                    "license": license_id,
                    "sha256": sha256_file(path),
                    "size_bytes": path.stat().st_size,
                    "retrieved_at": RETRIEVED_AT,
                }
            )
    files.sort(key=lambda f: f["path"])
    return {"retrieved_at": RETRIEVED_AT, "investigations": investigations, "files": files}


def write_manifest(manifest: dict[str, Any], out: Path | None = None) -> Path:
    target = out or (MANIFESTS_DIR / MANIFEST_NAME)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return target


def main() -> None:
    manifest = build_manifest()
    out = write_manifest(manifest)
    n_f, n_i = len(manifest["files"]), len(manifest["investigations"])
    print(f"raw manifest: {n_f} files in {n_i} investigations -> {out}")
