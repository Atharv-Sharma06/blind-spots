"""Usage: python build.py <repo_root> <out_dir> [--install]

Run with the analysis venv python and PYTHONPATH=services/analysis/src (needed for the model-structure table):
  cd services/analysis && PYTHONPATH=src .venv/bin/python ../../docs/_gen/build.py ../.. /tmp/docs_out --install
Writes generated docs to <out_dir>; with --install copies README.md to the repo root and the rest to docs/."""
import sys, re
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import facts, frag, validation_doc

root = Path(sys.argv[1]).resolve(); out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
F = facts.load(root)
X = frag.build(F)
frag.extras(F, X)
(out / "validation.md").write_text(validation_doc.build_validation(F, X))

X["RETRO_SECTION"] = validation_doc.retro_section(X)
# template docs: templates/<name>.md with {{KEY}} placeholders
tdir = Path(__file__).parent / "templates"
X["MAJ_MIN"] = frag.pct(min(g["majority_class_fraction"] for g in F["val"]["groups"]))
X["MAJ_MAX"] = frag.pct(max(g["majority_class_fraction"] for g in F["val"]["groups"]))
X["MDIR"] = F["mdir"]; X["RETRO_PATH"] = F["retro_path"]
X["P_MIN"] = f"{X['ts']['p_min']:.1f}"; X["P_MAX"] = f"{X['ts']['p_max']:.1f}"
X["O2_MIN"] = f"{X['ts']['o2_min']:.1f}"; X["O2_MAX"] = f"{X['ts']['o2_max']:.1f}"
X["U_MIN"] = f"{X['ts']['u_min']:.2f}"; X["U_MAX"] = f"{X['ts']['u_max']:.1f}"
X["BASIS_N"] = X["ts"]["basis"]
for k in ("below_cal","o2_interp","o2_initial_only","calib_borrowed","pressure_assumed"):
    X["T_"+k.upper()] = X["ts"][k]
missing = set()
if tdir.exists():
    for t in sorted(tdir.glob("*.md")):
        s = t.read_text()
        def rep(m):
            k = m.group(1)
            if k not in X:
                missing.add(k); return m.group(0)
            return str(X[k])
        (out / t.name).write_text(re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", rep, s))
if missing:
    print("MISSING KEYS:", sorted(missing)); sys.exit(1)
if "--install" in sys.argv:
    import shutil
    for p in out.glob("*.md"):
        dst = root / ("README.md" if p.name == "README.md" else f"docs/{p.name}")
        shutil.copyfile(p, dst)
        print("installed", dst)
print("ok", sorted(p.name for p in out.glob("*.md")))
