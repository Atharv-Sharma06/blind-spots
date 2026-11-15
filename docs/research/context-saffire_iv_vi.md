# Context table: Saffire-IV, -V and -VI per-sample conditions

Task `context-saffire_iv_vi`, 2026-11-15. Output: `data/curation/context_microgravity/saffire_iv_vi.csv` (8 rows, 22 columns per the context-file format).
These are documented NASA microgravity tests that are NOT integrated into the model; they are shown on the map as context only.

## Sources
| Paper | NTRS | PDF read | Printed table |
|---|---|---|---|
| Urban et al., "Fire Safety Implications of Preliminary Results from Saffire IV and V Experiments on Large Scale Spacecraft Fires", ICES-2021-266 | 20210011521 (https://ntrs.nasa.gov/citations/20210011521) | `ICES 2021-266 0503-2021 final.pdf` | Table 1 "Saffire IV-V Sample Test Conditions", PDF p.3 (printed p.3): IV-1, IV-2, V-2, V-3, V-4 |
| Urban et al., "Preliminary Results from the Saffire VI Experiment", ICES-2024-365 | 20240002981 (https://ntrs.nasa.gov/citations/20240002981) | `Saffire-ICES-2024-ICES-365-accepted final.pdf` | Table 1 "Saffire IV-VI Sample Test Conditions considered in this paper", PDF p.3: IV-1, V-2, VI-2, VI-3, VI-4. Table 2 (PDF p.6) has heat release, burn duration, CO, CO2 |

Saffire-IV does have a printed per-sample table (in the ICES-2021-266 paper, shared with Saffire-V), so it is included.

## What was transcribed
All numbers (length, air flow, flow direction, ambient pressure, O2 mol %) were read from the text layer and checked against the rendered 150 dpi page images of both Table 1 pages (all values match; the two tables agree on the rows they share, IV-1 and V-2).
IV-1 and V-2 appear in both tables with identical values; they are stored once (source: ICES-2021-266), so the CSV has 8 rows (IV-1, IV-2, V-2, V-3, V-4, VI-2, VI-3, VI-4), context_id unique.
- Pressure is printed in kPa, so `total_pressure_kpa` equals the printed value; no unit conversion was needed. Airflow is printed in cm/s.
- `flame_configuration`: as printed ("Concurrent"/"Opposed"; V-4 is opposed).
- `sample_dimensions`: length is from the table row. Thickness (IV-2 1 cm, V-3 0.5 cm, V-4 1 cm) comes from the Fig. 2 labels of ICES-2021-266; VI-3 10 mm and VI-4 5 mm from the text of ICES-2024-365 (PDF p.4); width 41 cm for Saffire-VI from its abstract ("all 41 cm wide"). Widths for Saffire-IV/V are not stated in the pages read and are left out.
- `specimen_geometry` is descriptive text built from the printed material labels and the "flat, cast" / "structured ... grooves and ridges" wording; it is not a contract enum.
- `outcome_text` holds verbatim sentences from the paragraphs describing the sample (checked as exact substrings of the extracted text, whitespace-normalised), separated by " | ". IV-1 has no sample-specific outcome statement, so it is empty. The V-3 / V-4 sentences are shared between the two samples. These are descriptions of flame behaviour under flow changes, not flammability-limit outcomes.
- `years` for IV and V is "2020-2021" because ICES-2021-266 says the experiments were conducted "in May of 2020 and January of 2021 on the NG-13 and NG-14 flights"; which flight is which year is not stated in the table. Saffire-VI date is not printed in the pages read, so `years` is empty (a prior note already records conflicting dates in other documents).

## Caveats
- Every printed test has the single flow value 20 cm/s; these rows have no flow-step structure and cannot be placed on a BASS-style flow boundary. Later flow reductions (5 cm/s for V-3, V-4, VI-3; off after) are only in outcome_text.
- Not transcribed because the table does not include them: Saffire-IV samples 3 and 4 and Saffire-V sample 1 (two samples on Saffire IV and one on Saffire V were "not ignited"; the paper does not give their conditions), and Saffire-VI VI-1 (Nomex, "did not ignite"). Absence of a row is not a claim about those tests' conditions.
- Table 2 values (burn duration, heat release, CO, CO2) were not transcribed (no column in the context format). Not verified beyond reading PDF p.6 text.
- Saffire-IV/V pressures and O2 are the printed per-test values; the O2/CO2 gas sensors on IV and V are noted by an earlier research note as not useful, so these are targeted/set atmosphere values as the paper reports them; how they were measured was not checked here.
- Platform string omits the NG-13/NG-14 flight mapping, which is inferred, not printed in the table.
