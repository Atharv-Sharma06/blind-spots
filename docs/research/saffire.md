# SAFFIRE-I (PSI-98) and SAFFIRE-III (PSI-100): test-level context records

Task id: data-saffire. Output table: `data/curation/saffire_tests.csv` (4 rows). Date of extraction: 2026-11-15.

## Role in Blind Spots

These are **context records only**. SAFFIRE-I and -III burned a single large SIBAL sample (about 0.94 m x 0.4 m) in a
Cygnus vehicle after it left the ISS. The apparatus (a flow duct with fans), the scale (about 10x larger than any prior
low-gravity flame spread sample), the cabin-scale atmosphere and the measurement set differ from the BASS/BASS-II
Glovebox tests. They must not be mixed into the training data of the BASS/BASS-II models. They can be shown as
context markers (large-scale tests exist near 19.8 to 22.4 % O2 and about 99.4 to 102.6 kPa) and in the coverage view
with a distinct symbol. Nothing here is a feasibility, safety or NASA-endorsed statement.

## Sources (all public, CC0)

| item | source |
|---|---|
| SAFFIRE-I | PSI-98, DOI https://doi.org/10.60555/0t15-1z43, landing https://psi.nasa.gov/physci/repo/data/investigations/PSI-98 |
| SAFFIRE-III | PSI-100, DOI https://doi.org/10.60555/040q-4h36, landing https://psi.nasa.gov/physci/repo/data/investigations/PSI-100 |
| Readme | `PSI-98_Science Documents_SAFFIRE-I and SAFFIRE-III Readme.docx` (same file in PSI-100) |
| Experimental tables | `PSI-98_Experimental table_SAFFIRE-1.csv`, `PSI-100_Experimental table_SAFFIRE-3.csv` (downloaded through the PSI download API; listed in `experimentalTable` of the investigation metadata) |
| Paper | `PSI-98_Science Documents_SAFFIRE Objectives, Development and Status.pdf` (Schoren, Ruff, Urban; NTRS 20170001636 stamped on the page) |
| Operations | `PSI-98_Engineering Documents_SAFFIRE-I Operations.pdf`, `PSI-100_Engineering Documents_SAFFIRE-III Operations.pdf` |
| Sensor data (used for values) | `PSI-98_Raw Data_Saffire-I Sample {1,2} Sensor Data Complete TM graphs.xlsx`; `PSI-100_Raw Data_Saffire III Sample {1,2} Sensors.xlsx`; sheet `Calibrated Data` |
| Telemetry (inspected, cross-check only) | `PSI-98_Raw Data_Saffire-I Telemetry Data Good Process Version.xlsx`; `PSI-100_Raw Data_Saffire-III Telemetry Data.xlsx`; `PSI-100_Raw Data_Saffire_Data_Table2017.161.00.42.03-EU.csv`; `PSI-100_Raw Data_Saffire-III 1 Hz Telemetry Data.xlsx`; `PSI-100_Raw Data_Raw telemetry file.csv` (downloaded, not parsed beyond headers) |
| TM figure captions | the four `... TM graphs.docx` / `... Figure for TM.docx` files (captions confirm Sample 1 = concurrent, Sample 2 = opposed for both flights) |

All downloads are in `data/raw/psi/PSI-98/large/` and `data/raw/psi/PSI-100/large/` (gitignored). The PSI presentation
PDFs (ICES 45/46/47) could not be fetched (the download API returns NoSuchKey for the 47th and a 332-byte XML error for the
others), so they were not used. `PSI-26_Science Documents_Planned_Test Matrix.xlsx` was not touched.

## What the sources say

- Material: SIBAL, "composite fabric consisting of cotton on a fiberglass substrate (75% cotton, 25% fiberglass by weight)"
  (readme and paper). Contract family `sibal_fabric`; geometry `flat_sheet`.
- Size: "approximately 0.94 meters long and 0.4 meters wide" (paper); "approx. 0.4 m wide by 0.94 m tall" (operations
  docs); PSI-100 table: length 94 cm, width 40.6 cm; PSI-98 table lists length 40.6 and width 94 (axes swapped relative to the
  other sources). The CSV uses length 940 mm (along the duct) and width 406 mm. The 406 mm figure is the table value; the
  paper says 0.4 m.
- Airflow: "SAFFIRE-I will be conducted at an air flow velocity of 20 cm/s while SAFFIRE-III will be run at a flow velocity
  of 30 cm/s." Both experimental tables repeat 20 and 30 cm/s.
- Flow direction: Sample 1 concurrent, Sample 2 opposed in both flights (experimental tables; TM captions). PSI-100 `approach`:
  "The flow was either concurrent or opposed."
- Oxygen: the PSI-98 table gives "21.5 - 21.7" (S1) and "~ 21.5" (S2). The PSI-100 table has no O2 column.
- Burn time (PSI-98 table only): S1 420 s, S2 70 s.
- Ignition power and time are also in the PSI-98 table. They are deliberately not transcribed (contract rule 4).
- No source read states a flame spread rate. None is reported or computed here.

## Channels and windows

Sheet `Calibrated Data` (about 30 Hz, columns with units in row 2) has the channels needed:

| quantity | channel (unit) | note |
|---|---|---|
| O2 | `O2` (%) | solid-state sensor, inlet of the avionics bay per the paper |
| total pressure | `Ambient Pressure` (PSIA) | x 6.894757 = kPa |
| flow | `Anemometer 1`, `Anemometer 2` (cm/sec) | mean reported in notes only |
| flame | `Radiometer 1..4` (mW/cm2), `Sample Temp 1..6 (TC7..TC12)` (C) | |

The cygnus-side telemetry workbooks (the "Telemetry Data" files) have **no O2 channel**; they hold Cygnus PCM pressure and
temperature (PCM = Cygnus pressurised cargo module, per the sheet names), radiometers, anemometers and igniter signals in
raw or partly calibrated form, with sentinel placeholder rows (for example radiometer -4002.47 and tach 77938) in merged tables. They were
not used for values.

**Flame window** (documented computation, same rule for all four): baseline of each radiometer = median over t < 45 s;
signal = sum over the four radiometers of (reading minus baseline); rolling median over 61 samples (about 2 s); window =
first to last time the signal exceeds 8 mW/cm2. Times are seconds on the file's own elapsed clock. The window start falls
within the ignition event; medians are insensitive to this. O2 and pressure are the median of all samples in the window.

| test | window (s) | length | O2 median % (p5-p95) | P median kPa | stated airflow | anemometer mean median |
|---|---|---|---|---|---|---|
| SAFFIRE-I S1 concurrent | 64.55-484.87 | 420.3 | 22.38 (22.30-22.67) | 102.53 | 20 | 19.99 |
| SAFFIRE-I S2 opposed | 63.59-138.76 | 75.2 | 22.30 (22.25-22.36) | 102.61 | 20 | 19.99 |
| SAFFIRE-III S1 concurrent | 64.02-420.59 | 356.6 | 19.99 (19.66-20.04) | 99.66 | 30 | 24.98 |
| SAFFIRE-III S2 opposed | 64.61-131.04 | 66.4 | 19.77 (19.73-20.00) | 99.40 | 30 | 25.01 |

The SAFFIRE-I S1 window length (420 s) equals the PSI table burn time; the S2 window (75 s) is close to the table 70 s.

## Outcomes (as supported by the data, not by a stated source)

- Concurrent tests (SAFFIRE-I S1, SAFFIRE-III S1): upstream radiometers peak before downstream ones, and all six embedded
  sample thermocouples heated (peaks 329 to 1092 C), so the flame passed all instrumented positions. In SAFFIRE-III S1 the
  flame signal ended at 420.6 s with flow still on until about 665 s. In SAFFIRE-I S1 the signal ended when flow
  stopped (485.8 s) with the radiometers still reading well above baseline.
- Opposed tests (SAFFIRE-I S2, SAFFIRE-III S2): only a weak radiometer signal (summed excess 36 and 25 mW/cm2 at peak against 376 and 468
  for the concurrent tests), and no embedded sample thermocouple rose above 25 C. The extent of spread is therefore **not
  established** from telemetry. In SAFFIRE-I S2 the signal ended at 139 s while flow continued to about 486 s; in
  SAFFIRE-III S2 the signal was still rising when flow stopped at about 135 s and the file ends at 160 s. Thermocouple
  positions are in an image-only PDF (`SFSDP-VIS-0295 ... Thermocouple Placement.pdf`), so the thermocouple evidence is not mapped to distance.

## Discrepancies and unverified items

1. SAFFIRE-I O2: sensor median 22.30 to 22.38 % against the table's 21.5 to 21.7 %. The sensor value is stored in
   `oxygen_percent` (channel data); the table value is quoted here and in the CSV notes. Which is correct is not resolved.
   Sensor accuracy is not documented in the files read.
2. SAFFIRE-III airflow: anemometers read about 25 cm/s while the stated value is 30 cm/s. `airflow_cm_s` holds the stated value;
   the measured value is in the notes. SAFFIRE-I anemometers (about 20 cm/s) agree with the stated value.
3. Total pressure: the Saffire `Ambient Pressure` sensor reads 99.4 to 102.6 kPa; the Cygnus PCM channel in the telemetry
   workbooks reads about 100.1 kPa (SAFFIRE-I) and 96.5 to 96.8 kPa (SAFFIRE-III), 2.4 to 3.1 kPa lower. The Saffire sensor is used (co-located with O2, calibrated sheet).
4. Sample thickness is not recorded in the CSV: the PSI-98 table says 0.37 and the PSI-100 table ".33", labelled cm
   (almost certainly mm; the paper gives SIBAL as 0.33 mm for SAFFIRE-II samples only). Not verified for SAFFIRE-I/-III.
5. Test dates come from epoch times inside the sensor files (2016-06-14 UTC for SAFFIRE-I, 2017-06-04 UTC for SAFFIRE-III), not
   from a dated source document. The paper (as of 2016-04-30) lists planned operation dates only.
6. In `Saffire_Data_Table2017.161...EU.csv` the `CygnusTimestamp` column is about one day later than the `SaffireTimestamp`
   column for the same samples. `SaffireTimestamp` matches the sensor files; the CSV radiometer 1 peak (148.3) agrees with the
   sensor file (about 149 in the telemetry workbook). Used only as a cross-check.
7. The spread rate, the O2 sensor calibration and the anemometer location relative to the sample are not stated in the files read.

## Reproducing the values

```python
# per sample: d = pandas.read_excel(file, sheet_name="Calibrated Data", header=0, skiprows=[1])
# d = d[d["Elapsed Time (s)"].notna() & d["O2"].notna()]; t = d["Elapsed Time (s)"].to_numpy()
# R = d[["Radiometer 1","Radiometer 2","Radiometer 3","Radiometer 4"]].to_numpy()
# ex = (R - np.median(R[t < 45], axis=0)).sum(axis=1)
# ex = pd.Series(ex).rolling(61, center=True, min_periods=1).median().to_numpy()
# on = np.where(ex > 8.0)[0]; w = (t >= t[on[0]]) & (t <= t[on[-1]])
# O2 = np.median(d.loc[w, "O2"]); P_kpa = np.median(d.loc[w, "Ambient Pressure"]) * 6.894757
```
