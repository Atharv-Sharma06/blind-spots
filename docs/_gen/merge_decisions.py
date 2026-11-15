"""Append docs/decisions.d/*.md to docs/decisions.md as D-011.. (idempotent: files already merged are skipped)."""
import os, re, sys
from pathlib import Path
root = Path(sys.argv[1]); dd = root / "docs/decisions.d"; dec = root / "docs/decisions.md"
TITLES = {
"research-psi-catalog":"PSI catalogue scope and classification of context investigations",
"research-atmosphere-profiles":"Atmosphere profiles: verbatim-quote rule, null nominals, ventilation band",
"research-ground-flammability":"Ground flammability thresholds stored as normal-gravity context only",
"research-other-microgravity-evidence":"Other microgravity evidence: ranges, conflicts and quote checks",
"research-publication-crosscheck":"Publication cross-check points kept as reference data",
"research-space-apps":"Space Apps 2026 \"Flame in Freefall\" treated as the target challenge",
"scaffold-backend":"Backend scaffold: build system, typing, CLI and error envelope",
"scaffold-web":"Web scaffold: framework versions, design tokens and API client behaviour",
"lib-ingestion":"Ingestion and processing: flow calibration, matrices, labels, training filter",
"lib-ml-core":"ML core: GP priors, gradients, baselines and missing coordinates",
"lib-acquisition-coverage":"Acquisition and coverage: coordinates, hull, envelope, greedy batch, baselines",
"data-saffire":"Saffire-I/III stored as context records",
"transcribe-bass2_bhattacharjee_ferkul-A":"Transcription rules for BASS-II Bhattacharjee/Ferkul (transcription A)",
"adjudicate-bass1_2012a":"Adjudication: BASS 2012 first chunk",
"adjudicate-bass1_2012b":"Adjudication: BASS 2012 rows 47-90",
"adjudicate-bass1_2013":"Adjudication: BASS 2013",
"adjudicate-bass2_bhattacharjee_ferkul":"Adjudication: BASS-II Bhattacharjee/Ferkul",
"adjudicate-bass2_fernandez_pello":"Adjudication: BASS-II Fernandez-Pello",
"adjudicate-bass2_miller":"Adjudication: BASS-II Miller",
"adjudicate-bass2_olson":"Adjudication: BASS-II Olson",
"adjudicate-bass2_tien":"Adjudication: BASS-II T'ien",
"audit-bass1_2012b":"Audit of BASS 2012 samples 24 and 25",
"reconcile-bass2_bhattacharjee_ferkul":"Reconciliation with TM-20210011385 Appendix A: Bhattacharjee/Ferkul",
"reconcile-bass2_fernandez_pello":"Reconciliation with TM-20210011385 Appendix A: Fernandez-Pello",
"reconcile-bass2_miller":"Reconciliation with TM-20210011385 Appendix A: Miller",
"reconcile-bass2_olson":"Reconciliation with TM-20210011385 Appendix A: Olson",
"evidence-tm-appendix-a":"TM-20210011385 Appendix A extraction and verification",
"evidence-integrate":"Integration of context investigations and TM evidence into the build",
"context-dartfire":"Context records: DARTFire",
"context-droptower_tm2008_215260":"Context records: Glenn 5.18 s drop-tower limits",
"context-saffire_iv_vi":"Context records: Saffire-IV, V and VI",
"apply-profile-verdicts":"Atmosphere profile verification verdicts applied",
"assemble-dataset":"Dataset assembly check",
"model-study":"Model study: versioning, mean function, CIs, sensitivity and blind-spot test",
"acquisition-retrospective":"Retrospective evaluation of target-aware acquisition",
"api-data":"API data endpoints",
"api-model":"API model endpoints: targets, ranking, brief and snapshot",
"web-data-layer":"Web data layer and snapshot keys",
"web-map":"Web parameter map",
}
text = dec.read_text()
merged = set(re.findall(r"decisions\.d/([A-Za-z0-9_.\-]+)\.md", text))
ids = [int(x) for x in re.findall(r"^- D-(\d+)", text, flags=re.M)]
nxt = max(ids) + 1
files = sorted(f[:-3] for f in os.listdir(dd) if f.endswith(".md"))
order = [k for k in TITLES if k in files] + [f for f in files if f not in TITLES]
out = []
for name in order:
    if name in merged:
        continue
    body = (dd / f"{name}.md").read_text().strip().splitlines()
    body = [l for l in body if not re.match(r"^#{1,3} ", l)]  # drop headings, keep bullets and prose
    title = TITLES.get(name, name.replace("-", " ").replace("_", " "))
    out.append(f"- D-{nxt:03d} (2026-11-15, {name}): {title}. Source: `docs/decisions.d/{name}.md` (kept; text below is copied from it).")
    for l in body:
        if l.strip():
            out.append("  " + l if not l.startswith("  ") else l)
    nxt += 1
if out:
    if not text.endswith("\n"):
        text += "\n"
    dec.write_text(text + "\n".join(out) + "\n")
print("appended", sum(1 for l in out if l.startswith("- D-")), "entries; last id", nxt - 1)
