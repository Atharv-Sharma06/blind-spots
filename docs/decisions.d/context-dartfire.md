## context-dartfire (2026-11-15)
- Wrote `data/curation/context_microgravity/dartfire.csv` (8 rows) from DARTFire Table 1, NTRS 20030111833 PDF p.45, checked against a 150 dpi render.
- `total_pressure_kpa` = 101.325 (raw "1 atmosphere", from text p.5, not from the table); same for all rows. Flux (0/1/2 W/cm2) has no contract column, kept in `raw_text` only.
- `specimen_geometry`=slab and `flame_configuration`=opposed from the paper's sample description and abstract.
- 1A conflict (2003 text: ignited then extinguished; 1997 table: no ignition) stated, not resolved; the 2003 table cell is used.
- Years taken from the abstract of NTRS 20050192123, not from the preprint itself.

## verify-context-dartfire (2026-11-15)
- Independent re-check of all 8 rows against a fresh download and 150 dpi render of PDF p.45: no value errors, CSV unchanged. Log: `data/curation/audit/context_dartfire_verify.md`.
