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
