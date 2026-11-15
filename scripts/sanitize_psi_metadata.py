"""Remove personal contact details from the stored PSI metadata snapshots.

`data/raw/psi/<ID>/inv_<ID>.json` are snapshots of the public PSI API response
(`GET https://psi.nasa.gov/geode-py/ws/repo/investigations/<ID>`). The pipeline never uses the
`contacts` block, so the committed copies keep investigator names and roles but blank their email,
phone, fax and address fields. Fetch the API for the full original record.

Usage (repo root):  python scripts/sanitize_psi_metadata.py [repo_root]
Idempotent; rewrites a file only when something changes.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

PERSONAL_FIELDS = ("email", "phone", "fax", "address")


def scrub(obj: object) -> bool:
    changed = False
    if isinstance(obj, dict):
        for key in PERSONAL_FIELDS:
            if obj.get(key):
                obj[key] = ""
                changed = True
        for value in obj.values():
            changed |= scrub(value)
    elif isinstance(obj, list):
        for value in obj:
            changed |= scrub(value)
    return changed


def main(root: Path) -> int:
    n = 0
    for path in sorted(root.glob("data/raw/psi/*/inv_*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        contacts = data.get("contacts") if isinstance(data, dict) else None
        if contacts is not None and scrub(contacts):
            path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            n += 1
    print(f"sanitized {n} metadata snapshot(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]))
