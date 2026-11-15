# Context table: DARTFire sounding rocket

Output: `data/curation/context_microgravity/dartfire.csv` (8 rows, one per printed row of Table 1). Context only: not integrated into the model.

## Source
Olson, Hegde, Bhattacharjee, Deering, Tang, Altenkirch, "Sounding Rocket Microgravity Experiments Elucidating Diffusive and Radiative
Transport Effects on Flame Spread over Thermally-Thick Solids", manuscript preprint for Combustion Science and Technology,
NTRS 20030111833 (https://ntrs.nasa.gov/citations/20030111833, public). Table 1 "DARTFire Test Matrix" is on PDF page 45 of 47.
The page was rendered at 150 dpi and every number below was checked against the image.

## What was transcribed (Table 1)
Columns printed: Flight-Tunnel, Molar Oxygen Concentration %, Bulk Flow Velocity cm/s, Imposed Radiant Flux W/cm2, Measured spread rate cm/s.

| id | O2 % | flow cm/s | flux W/cm2 | result as printed |
|---|---|---|---|---|
| 1A | 35 | 1 | 1 | Extinguished |
| 1B (baseline) | 50 | 1 | 0 | 0.020 |
| 2A | 50 | 1 | 1* | 0.019 on / 0.010 off |
| 2B | 50 | 5 | 0 | 0.032 |
| 3A | 50 | 1 | 2+ | 0.033 on / 0.020 off |
| 3B | 50 | 10 | 0 | 0.045 |
| 4A | 50 | 1 | 1 | No Ignition |
| 4B | 70 | 1 | 0 | 0.040 |

Footnotes: * "selected to ~ offset surface radiative loss"; + "selected to ~offset surface+ gas-phase radiative loss".

## Field sources
- Pressure (101.325 kPa, raw "1 atmosphere"): not in the table; text p.5 "Pressure in the duct was maintained at 1 atmosphere." Same for all rows.
- Material and sample: text p.4 "Black PMMA samples, 20 mm long x 20 mm thick x 6.35 mm wide". Geometry coded `slab` (thermally thick).
- Flame configuration `opposed`: abstract and keywords ("opposed flow flame spread over thermally-thick PMMA").
- Years "June 1996 to September 1997": not in this preprint; from the abstract of NTRS 20050192123 ("the four launches of this program (June 1996 to September 1997)").
- Gravity environment: sounding rocket, "6-minute microgravity" (abstract). Table-1 rows are tunnel tests; two tunnels fly per launch.
- outcome_text: table cell as printed; spread-rate cells are prefixed "Measured spread rate, cm/s:" (column header). The imposed radiant flux has no column in the contract; it is kept only in `raw_text` (format: id | O2 | flow | flux | result).

## Caveats
- Conflict, not resolved: text p.6 says that in Test 1A "the sample ignited, but the flame extinguished when the igniter was turned off"; the 1997 table (NTRS 19970020610) lists 1A as "no ignition". The 2003 table cell "Extinguished" is used.
- 4A: text (p.6 and the discussion of test 4A) says the sample failed to ignite under 1 W/cm2 imposed flux only (no spread data).
- Flux is a third controlled variable (0, 1, 2 W/cm2) that the model has no coordinate for; rows with flux are not directly comparable to no-flux rows.
- Spread rates are rates of the flame, not flammability limits; a spread rate is not a pass/fail outcome.
- Source is a preprint ("will not be cited or reproduced without the permission of the author" appears on its cover); the page is publicly served by NTRS. Cite it as an unrefereed NTRS manuscript.
- Tables 2 and 3 (mass loss, heat flux) were not transcribed.
- Elevated-O2 only (35 to 70 %); do not read it as evidence about air-like or reduced-pressure atmospheres.
