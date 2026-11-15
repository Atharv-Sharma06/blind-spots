"""Regenerate README.md, docs/*.md and the submission drafts from the generated artifacts.

One command, from the repository root, after any dataset rebuild, retrain or retrospective run:

    cd services/analysis && PYTHONPATH=src uv run python ../../docs/_gen/build.py --install

Options: --root (default: this repository), --out (default: a temporary directory), --install (copy README.md to the
repository root, templates/submission/*.md to submission/ and the rest to docs/), --check (exit 1 if an installed file
differs from the generated one). Links: fill docs/_gen/links.json (DEPLOYED_URL, GITHUB_URL, VIDEO_URL).
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import facts  # noqa: E402
import frag  # noqa: E402
import headline  # noqa: E402
import refs  # noqa: E402
import validation_doc  # noqa: E402


def _keys(root: Path) -> dict:
    F = facts.load(root)
    X = frag.build(F)
    frag.extras(F, X)
    X["RETRO_SECTION"] = validation_doc.retro_section(X)
    X["MAJ_MIN"] = frag.pct(min(g["majority_class_fraction"] for g in F["val"]["groups"]))
    X["MAJ_MAX"] = frag.pct(max(g["majority_class_fraction"] for g in F["val"]["groups"]))
    X["MDIR"] = F["mdir"]
    X["RETRO_PATH"] = F["retro_path"]
    ts = X["ts"]
    X["P_MIN"], X["P_MAX"] = f"{ts['p_min']:.1f}", f"{ts['p_max']:.1f}"
    X["O2_MIN"], X["O2_MAX"] = f"{ts['o2_min']:.1f}", f"{ts['o2_max']:.1f}"
    X["U_MIN"], X["U_MAX"] = f"{ts['u_min']:.2f}", f"{ts['u_max']:.1f}"
    X["BASIS_N"] = ts["basis"]
    for k in ("below_cal", "o2_interp", "o2_initial_only", "calib_borrowed", "pressure_assumed"):
        X["T_" + k.upper()] = ts[k]
    # flow provenance (D5) and the integrated envelope, computed from data/normalized
    fp = facts.flow_provenance(F)
    X["FP_N"], X["FP_RECORDED"], X["FP_CONVERTED"] = fp["n"], fp["recorded"], fp["converted"]
    X["FP_AIR"], X["FP_STATED"], X["FP_BORROWED_ALL"] = fp["air"], fp["stated"], fp["borrowed_all"]
    borrowed = (
        "none use a borrowed calibration"
        if fp["borrowed"] == 0
        else f"{fp['borrowed']} use a borrowed calibration"
    )
    calib = (
        "with the BASS-II calibration"
        if fp["converted_investigations"] == ["PSI-25"]
        else "with the fan and pot calibration (" + ", ".join(fp["converted_investigations"]) + ")"
    )
    X["FLOW_PROVENANCE"] = (
        f"{fp['recorded']} of {fp['n']} training steps use a recorded airflow (duct reading or a value stated in the "
        f"source); {fp['converted']} are converted from fan or pot settings {calib}; {borrowed}."
    )
    env = facts.integrated_envelope(F)
    X["ENV_O2"] = f"{env['o2_min']:.1f} to {env['o2_max']:.1f}"
    X["ENV_P"] = f"{env['p_min']:.1f} to {env['p_max']:.1f}"
    X["ENV_N_EXP"] = env["n_exp"]
    X["ENV_N_OBS"] = env["n_obs"]
    X["N_PSI_SURVEYED"] = len(F["psi_catalog"])
    X["N_INV_RECORDS"] = len(F["inv"])
    X.update(headline.compute(root))
    X["DEMO_TOP_SENTENCE"] = (
        "The top-ranked candidate sits at the target conditions themselves; this follows from the model's "
        "distance-based (stationary) correlation assumption, because no integrated observation constrains that region."
        if X["TC_AT_TARGET"]
        else "The top-ranked candidate lies away from the target conditions."
    )
    X["LICENSE_LINE"] = (
        "The project's own code is licensed as stated in [LICENSE](LICENSE)."
        if (root / "LICENSE").exists()
        else "No licence file for the project's own code is included yet."
    )
    lunar = [
        src
        for p in F["profiles"]["profiles"]
        for src in p["sources"]
        if "20220000245" in (src.get("url") or "") and "SH is assumed" in (src.get("quote") or "")
    ]
    X["LUNAR_SENTENCE"] = (
        f'NASA\'s lunar Surface Habitat study states: "{lunar[0]["quote"]}" (NTRS 20220000245, {lunar[0]["page"]}).'
        if lunar
        else "Moon and Mars habitat atmospheres are not finalized; NASA's exploration designs consider reduced pressure "
        "and raised oxygen."
    )
    X["REF_NASA_DATA"] = refs.nasa_data(F)
    X["REF_PUBLICATIONS"] = refs.publications(F)
    X["REF_SOFTWARE"] = refs.software(F)
    X.update(json.loads((HERE / "links.json").read_text()))
    return X


def _render(text: str, X: dict, missing: set) -> str:
    def rep(m: re.Match) -> str:
        k = m.group(1)
        if k not in X:
            missing.add(k)
            return m.group(0)
        return str(X[k])

    return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", rep, text)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("root_pos", nargs="?", help=argparse.SUPPRESS)
    ap.add_argument("out_pos", nargs="?", help=argparse.SUPPRESS)
    ap.add_argument("--root", default=None)
    ap.add_argument("--out", default=None)
    ap.add_argument("--install", action="store_true")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    root = Path(a.root or a.root_pos or HERE.parents[1]).resolve()
    out = Path(a.out or a.out_pos or tempfile.mkdtemp(prefix="blindspots-docs-"))
    (out / "submission").mkdir(parents=True, exist_ok=True)

    X = _keys(root)
    F = facts.load(root)
    (out / "validation.md").write_text(validation_doc.build_validation(F, X))
    missing: set = set()
    tdir = HERE / "templates"
    for t in sorted(tdir.glob("*.md")):
        (out / t.name).write_text(_render(t.read_text(), X, missing))
    for t in sorted((tdir / "submission").glob("*.md")):
        (out / "submission" / t.name).write_text(_render(t.read_text(), X, missing))
    if missing:
        print("MISSING KEYS:", sorted(missing))
        return 1

    pairs = []
    for p in sorted(out.glob("*.md")):
        pairs.append((p, root / ("README.md" if p.name == "README.md" else f"docs/{p.name}")))
    for p in sorted((out / "submission").glob("*.md")):
        pairs.append((p, root / "submission" / p.name))
    if a.check:
        stale = [
            str(d.relative_to(root)) for s, d in pairs if not d.exists() or d.read_text() != s.read_text()
        ]
        print("stale:", stale or "none")
        return 1 if stale else 0
    if a.install:
        for s, d in pairs:
            shutil.copyfile(s, d)
            print("installed", d.relative_to(root))
    left = sorted({k for k, v in json.loads((HERE / "links.json").read_text()).items() if v == f"<{k}>"})
    if left:
        print("placeholders still unfilled (edit docs/_gen/links.json, then rerun):", ", ".join(left))
    snap = root / "apps/web/public/snapshot/manifest.json"
    if snap.exists():
        m = json.loads(snap.read_text())
        if (
            m.get("dataset_version") != F["dataset_version"]
            or m.get("model_version") != F["manifest"]["model_version"]
        ):
            print("WARNING: apps/web/public/snapshot is from another dataset/model version; re-export it.")
    print("ok", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
