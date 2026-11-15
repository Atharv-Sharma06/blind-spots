# api-data decisions (2026-11-15)

- Coverage evidence for `/api/coverage` = the group's training observations with complete coordinates (o2, airflow, analysis pressure); `observations_in_slice` and `n_evidence_observations` refer to that set. Slice membership: |z_slice - z(slice value)| / scale <= 1 (z_p scale 0.1 for the o2_flow plane, z_flow scale 0.5 for o2_pressure).
- Non-finite grid values (no evidence in the group) are returned as `null`.
- Unknown `group` on list/coverage endpoints is a 404 `not_found`; dataset missing is 503 `artifact_missing` (data endpoints) while targets/context/sources/methodology/health stay up (degraded mode).
- Model registry is read from `models/LATEST` -> `models/<v>/manifest.json` (as written by `models.registry.save_registry`); its per-group `model_status` overrides the modelability rule in `/api/groups`. `validation` artifact flag = `models/<v>/validation.json` exists.
- `/api/experiments/{experiment_id:path}` accepts ids containing `/` (BASS labels such as `85/117`).
- `/api/export/experiments.csv`: header = ExperimentRecord fields; list fields JSON-encoded, null as empty.
- `/api/sources` publications = integrated investigations with a DOI (PSI dataset DOIs) plus unique papers cited in `data/curation/publication_points.csv`; no DOIs invented.
- Added `coverage/grid.py` (nx/ny and axis ranges, slice membership) instead of editing `coverage/coverage.py`.
- Resolved target models add `flags`, `profile_id`, `kind`, `airflow_band_note`; `airflow_band_source` also allows `ventilation_standard_with_near_quiescent_extension` (lead note 5).
