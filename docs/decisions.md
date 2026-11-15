# Implementation decisions and open limitations

Append-only log. Format: `D-NNN (date, author): decision. Why. Consequence.`

- D-001 (2026-11-15, lead): Data scope starts from NASA PSI investigations BASS (PSI-26) and BASS-II
  (PSI-25), whose as-run test matrices are public, CC0-licensed and record per-test O2, flow schedule,
  material and outcome notes. Saffire-I/III (PSI-98/PSI-100) are context records. Why: these are the only
  PSI combustion records found with per-test solid-fuel flammability conditions in machine-readable form.
- D-002 (2026-11-15, lead): The public AWS bucket `s3://nasa-psi` holds only DSI, OASIS and pk4 data, so
  PSI files are retrieved through the PSI web service (`/geode-py/ws/studies/<ID>/download?file=...&redirect=false`
  returns a presigned S3 URL; no login). The `remote_url` host `psi.ndc.nasa.gov` in PSI metadata does not
  resolve publicly (NXDOMAIN) and is never used for links.
- D-003 (2026-11-15, lead): `PSI-26_Science Documents_Planned_Test Matrix.xlsx` is excluded from the repo and
  pipeline: cell B1 contains what look like legacy credentials. It is not needed (the as-run matrix supersedes it).
- D-004 (2026-11-15, lead): Free-text flow schedules are interpreted in curation tables with cell-level
  provenance; two independent transcriptions per chunk are adjudicated, and the pipeline verifies every
  quoted token against the original cell. Why: reproducibility and auditability of the main manual step.
- D-005 (2026-11-15, lead): Unit of observation = one flow step of one test (flame sustained or not at a
  recorded airflow and O2). Steps of one test are correlated, so all validation is grouped by experiment
  (and by campaign group for leave-one-group-out).
- D-006 (2026-11-15, lead): BASS-II test matrices do not record total pressure. Measurement fields stay null;
  a documented ISS cabin nominal is stored separately as `pressure_assumed_kpa` (flagged) and used only to
  place points in pressure-axis views and coverage computations.
- D-007 (2026-11-15, lead): Analysis group = material family + flame configuration (`models/groups.py`). A group is
  modelled only with ≥ 6 training experiments, ≥ 3 sustained and ≥ 3 not-sustained observations, and not-sustained
  outcomes in ≥ 2 experiments; otherwise coverage is shown but predictions are not (`insufficient_data`). Why: grouped
  cross-validation needs several independent experiments and both outcomes.
- D-008 (2026-11-15, lead): Primary training filter keeps confidence high + medium; low-confidence curated steps stay
  in the records and are added back only in a sensitivity analysis. Why: conservative default for interpreted text.
- D-009 (2026-11-15, lead): Pressure enters the GP with a fixed, assumed length scale (0.3 in ln-pressure units) because
  every integrated observation is at ~1 atm, so the scale cannot be learned. All pressure extrapolation is therefore
  assumption-driven; the API reports a sensitivity check (0.15 / 0.3 / 0.6) and flags assumption-dependent candidates.
- D-010 (2026-11-15, lead): The submission deadline (Space Apps 2026 "Flame in Freefall", 2026-11-15 23:59 local) sets
  scope: the public deployment serves a precomputed snapshot produced by the same Python code (docs/API.md); custom
  targets need the live analysis service. No 3D view.
