"""Reference lists for the project page, read from the manifests, curation tables and lockfiles."""

from __future__ import annotations

import csv
import importlib.metadata as md
import json
import re
import tomllib
from pathlib import Path

# Well-known licences of tools that are not installed as Python or npm packages.
TOOLS = "Python 3.12 (PSF License); Node.js (MIT); uv (MIT or Apache-2.0); hatchling build backend (MIT)."


def _csv_sources(paths: list[Path]) -> list[tuple[str, str, str]]:
    seen: dict[str, tuple[str, str, str]] = {}
    for p in paths:
        with p.open() as fh:
            for r in csv.DictReader(fh):
                url = (r.get("source_url") or r.get("url") or "").strip()
                title = (r.get("source_title") or "").strip()
                if url and url not in seen:
                    seen[url] = (title, url, (r.get("ntrs_id") or "").strip())
    return list(seen.values())


def nasa_data(F: dict) -> str:
    root: Path = F["root"]
    out = ["**NASA Physical Sciences Informatics (PSI)** (`data/normalized/investigations.json`):", ""]
    for i in F["inv"]:
        if i["investigation_id"].startswith("PSI-") and i["role"] != "catalogued_not_integrated":
            role = "model data" if i["role"] == "integrated_model" else "context only"
            out.append(
                f"- {i['investigation_id']} {i['acronym']}: {i['title']}. https://doi.org/{i['doi']} ; "
                f"{i['landing_url']} ({i['license']}; {role}: {i['n_experiments']} experiments, "
                f"{i['n_observations']} flow-step observations)"
            )
    out += [
        "",
        f"The PSI catalogue of {len(F['psi_catalog'])} combustion investigations was surveyed to decide what to "
        "integrate (`data/manifests/psi_investigations.json`).",
        "",
        "**NASA Technical Reports Server (NTRS) documents used for data** (context records, outcome cross-check, ground "
        "thresholds, publication cross-check points):",
        "",
    ]
    cur = root / "data/curation"
    files = sorted((cur / "context_microgravity").glob("*.csv")) + sorted(
        (cur / "ground_flammability").glob("*.csv")
    )
    files += [cur / "publication_points.csv"]
    for title, url, _ in _csv_sources(files):
        out.append(f"- {title}. {url}")
    out += [
        "",
        "**Atmosphere-profile and ventilation sources** (`data/manifests/atmosphere_profiles.json`):",
        "",
    ]
    seen = set()
    srcs = [s for p in F["profiles"]["profiles"] for s in p["sources"]] + F["profiles"]["ventilation"][
        "sources"
    ]
    for s in srcs:
        if s["url"] in seen:
            continue
        seen.add(s["url"])
        doc = f" ({s['doc_number']})" if s.get("doc_number") else ""
        out.append(f"- {s['title']}{doc}. {s['url']}")
    return "\n".join(out)


def publications(F: dict) -> str:
    out = [
        "**Methods.** Rasmussen, C. E. and Williams, C. K. I. (2006). Gaussian Processes for Machine Learning. MIT Press "
        "(GP classification with the Laplace approximation).",
        "",
        "**Documented work catalogued but not integrated** (shown as context only; full entries in "
        "`data/manifests/known_investigations_not_integrated.json`):",
        "",
    ]
    for x in F["not_integrated"]:
        s = json.dumps(x)
        dois = sorted(set(re.findall(r"10\.\d{4,9}/[^\s\"),;]+", s)))
        urls = sorted({u.rstrip(".") for u in re.findall(r"https?://[^\s\"),;]+", s) if "doi.org" not in u})
        refs = [f"doi {d.rstrip('.')}" for d in dois] + urls
        out.append(f"- {x['name']}: " + ("; ".join(refs) if refs else "see the catalogue entry"))
    return "\n".join(out)


def _py_licence(name: str) -> str:
    try:
        d = md.metadata(name)
    except md.PackageNotFoundError:
        return "licence: see package metadata"
    lic = d.get("License-Expression") or ""
    if not lic:
        cls = [c.split(" :: ")[-1] for c in (d.get_all("Classifier") or []) if c.startswith("License ::")]
        lic = ", ".join(cls) or (d.get("License") or "").splitlines()[0][:40]
    return lic or "licence: see package metadata"


def software(F: dict) -> str:
    root: Path = F["root"]
    py = tomllib.loads((root / "services/analysis/pyproject.toml").read_text())
    lock = tomllib.loads((root / "services/analysis/uv.lock").read_text())
    ver = {p["name"]: p.get("version", "") for p in lock.get("package", [])}

    def pyname(spec: str) -> str:
        return re.split(r"[<>=!~\[ ;]", spec, maxsplit=1)[0]

    deps = [pyname(d) for d in py["project"]["dependencies"]]
    dev = [pyname(d) for d in py.get("dependency-groups", {}).get("dev", [])]

    def fmt(names: list[str]) -> str:
        return "; ".join(f"{n} {ver.get(n, '')} ({_py_licence(n)})".replace("  ", " ") for n in names)

    out = [f"- Python runtime: {fmt(deps)}.", f"- Python development: {fmt(dev)}."]
    web = root / "apps/web"
    pkg = json.loads((web / "package.json").read_text())
    plock = json.loads((web / "package-lock.json").read_text()).get("packages", {})

    def npm(names: list[str]) -> str:
        parts = []
        for n in names:
            meta = web / "node_modules" / n / "package.json"
            j = json.loads(meta.read_text()) if meta.exists() else plock.get(f"node_modules/{n}", {})
            lic = j.get("license") or "licence: see package metadata"
            parts.append(f"{n} {j.get('version', '')} ({lic})")
        return "; ".join(parts)

    out.append(f"- Web runtime: {npm(sorted(pkg.get('dependencies', {})))}.")
    out.append(f"- Web development and testing: {npm(sorted(pkg.get('devDependencies', {})))}.")
    out.append(f"- Tools: {TOOLS}")
    return "\n".join(out)
