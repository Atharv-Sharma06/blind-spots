# research-ground-flammability decisions (2026-11-15)

- Ground-based thresholds are stored under `data/curation/ground_flammability/`, one CSV per source document, labelled normal-gravity CONTEXT; never to be joined to microgravity training data.
- Only table values were transcribed. Scanned docs (NTRS 20070005041, 20070018178, 20100015582) have OCR text layers with errors, so each value was verified against the rendered page image.
- Three extra columns (`qualifier`, `pressure_basis`, `value_note`) were appended after the 13 requested ones; bounds such as `< 30` are stored as oxygen_percent=30 with qualifier `<`.
- Pressure unit conversions (psia <-> kPa) are derived values and flagged in `pressure_basis`; printed units are kept as printed.
- Derived MOP columns and normoxic/ISS reference rows were not transcribed.
- 99.8 % O2 values printed as "MOP (psia)" in NTRS 20160001047 are recorded as `MTP` because NTRS 20100015582 prints identical values as MTP; flagged in `result_definition`.
- Conflicting values across documents (Nomex HT90-40, Kydex 100) are kept as separate rows, not reconciled.
