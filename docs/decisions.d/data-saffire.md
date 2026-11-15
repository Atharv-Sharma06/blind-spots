# data-saffire decisions (2026-11-15)

- SAFFIRE-I/-III are stored as context records in `data/curation/saffire_tests.csv`, not as training data (different apparatus and scale).
- O2 and total pressure come from the calibrated sensor workbooks (`Calibrated Data`), as the median over a radiometer-defined flame window. The "Telemetry Data" workbooks have no O2 channel and contain sentinel placeholder rows, so they are not used for values.
- `oxygen_percent` holds the sensor median; the differing PSI-98 table value (21.5 to 21.7 / ~21.5) is kept in notes. Not reconciled.
- `airflow_cm_s` holds the stated nominal value (20 / 30) with the readme quote; the anemometer medians (about 20 and about 25 cm/s) are in notes. SAFFIRE-III anemometers disagree with the stated 30 cm/s.
- `total_pressure_kpa` uses the Saffire `Ambient Pressure` sensor; Cygnus PCM pressure is 2.4 to 3.1 kPa lower and is noted.
- Sample length 940 mm, width 406 mm (PSI-98 table has the axes swapped; the paper, operations docs and PSI-100 table agree on 0.94 x 0.4 m). Thickness left out because units are inconsistent.
- No spread rate recorded: no source read states one. Opposed tests: extent of spread not established.
- Ignition power and time in the PSI-98 table are not transcribed (contract rule 4).
- Raw downloads and the two experimental-table CSVs are in `data/raw/psi/<ID>/large/` (gitignored).
