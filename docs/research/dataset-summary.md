# Dataset summary (dataset_version fe21a21fddc8, built 2026-11-15)

Source: `data/normalized/dataset_report.json`, `observations.csv`, `experiments.csv`. Curation checker: 0 provenance errors on 250 tests and 684 steps. Pipeline: 0 provenance failures, 0 curation problems. Tests: 176 passed; ruff, ruff format and mypy clean. The acquisition test against the real GPLaplaceClassifier ran and passed (not skipped).

## Totals
- 254 experiments (PSI-25: 129, PSI-26: 121, PSI-98: 2 and PSI-100: 2 context only), 684 flow-step observations, 24 investigations catalogued.
- Training: 189 experiments, 481 observations (label 1 = 426, label 0 = 55; 88.6% sustained). Training confidence: medium 404, high 77, low 0.
- Observations by campaign (all / training): Bhattacharjee-Ferkul 50/36, Fernandez-Pello 109/107, Miller 79/76, Olson 104/92, T'ien 24/24, BASS 2012 199/99, BASS 2013 119/47.
- Training 0-labels by mode: flow_turned_off 21, quench_low_flow 12, blowoff 7, at_constant_flow 4, brief_flame_no_sustain 11.
- Exclusions (obs): low_confidence 178, not_ignited 16, no_numeric_airflow 7, n2_suppression 2. Experiments excluded: no_curated_flow_steps 30 (PSI-25 rows with no step), low_confidence 19, not_ignited 12, context only 4.
- Duplicates: possible duplicate pairs 24/12-R vs 24/12-R2 and 26 vs 27; 10 experiments carry `duplicate_as_run_number` (handled by suffix labels). No id errors.

## Family x configuration (training observations)
| family | config | tests (all) | obs (all) | train obs | sustained | not sust. | O2 % (train) | airflow cm/s (train) |
|---|---|---|---|---|---|---|---|---|
| pmma_rod | opposed | 21 | 109 | 107 | 96 | 11 | 16.3-20.9 | 0.25-22.2 |
| pmma_rod | stagnation | 25 | 104 | 92 | 84 | 8 | 13.6-22.2 | 0.25-37.2 |
| pmma_slab | opposed | 22 | 81 | 78 | 75 | 3 | 16.8-22.2 | 0.25-23.5 |
| pmma_slab | concurrent | 2 | 3 | 3 | 3 | 0 | 21.9 | 7-9 |
| pmma_slab | unknown | 4 | 5 | 4 | 1 | 3 | 22.0-22.4 | 4-10 |
| pmma_thin_film | opposed | 15 | 50 | 36 | 34 | 2 | 15.0-21.0 | 0.5-37.8 |
| pmma_sphere | stagnation | 19 | 58 | 28 | 20 | 8 | 17.3-22.1 | 0-10.1 |
| pmma_sphere | wake | 27 | 77 | 42 | 32 | 10 | 16.7-22.4 | 0-21.1 |
| pmma_sphere | unknown | 25 | 71 | 32 | 29 | 3 | 17.1-22.6 | 0-44 |
| sibal_fabric | concurrent | 17 | 21 | 21 | 21 | 0 | 16.9-20.8 | 1.0-11.1 |
| sibal_fabric | unknown | 10 | 22 | 16 | 16 | 0 | 21.5-22.7 | 1.5-44.3 |
| sibal_fabric | opposed | 2 | 2 | 2 | 1 | 1 | 21.9-22.2 | 9-10 |
| wax_candle | unknown | 7 | 27 | 10 | 10 | 0 | 15.9-22.2 | 1-10.1 |
| wax_candle | wake | 10 | 39 | 3 | 2 | 1 | 21.1-21.2 | 0-3.0 |
| nomex_fabric | unknown | 6 | 6 | 3 | 1 | 2 | 21.6-22.5 | 14.5-15 |
| paraffin_slab | concurrent / unknown | 1 / 5 | 2 / 5 | 2 / 1 | 1 / 0 | 1 / 1 | 21.9 | 3-6 |
| ultem_sheet | unknown | 2 | 2 | 1 | 0 | 1 | 22.5 | 8 |

## Pressure
PSI-25 (BASS-II) has no measured pressure; all 129 tests carry `pressure_assumed_kpa` = 101.353 (flagged `pressure_assumed`, source recorded). PSI-26 (BASS) has measured pressure per test: 98.3-102.2 kPa, covering sphere (70 of 72 tests), sibal (12), wax (17), slab (8), nomex (6), paraffin (6), ultem (2). Pressure is effectively constant (about 1 atm) in all data, so no pressure effect is learnable.

## Airflow basis (training obs)
air_display 196, pot_calibration 183, stated_cm_s 72, fan_calibration 30. 111 training observations are below the calibration range (linear extrapolation, flagged). 303 of 481 have linearly interpolated O2 (flagged); 78 have O2 initial only.

## Key scientific caveats
1. Strong class imbalance and ordering bias: 89% of training rows are "sustained". Most are sustained only by list order in a decreasing-flow schedule (no outcome token in the source). The final unrecorded setting is deliberately omitted, so 141 of 254 tests have terminal_event unknown. Boundary information is thin: only 55 label-0 rows, and 21 of those are flow-turned-off transients at ~0 flow (not a physical quench boundary).
2. O2 is nearly confounded with campaign: BASS-II is mostly 13.6-22 % (mean 18.0), BASS is 20.9-22.7 % except 2013 (15.9-21.1). Spheres and wax are essentially air-like. Grouped leave-campaign-out validation will be hard; O2 effects for sphere/wax/nomex are not identifiable.
3. Flow values are mostly derived, not measured: pot and fan settings are converted by borrowed calibration (day-nearest) and low flows are extrapolated; below ~1 cm/s the values are uncertain. BASS-II air display lags (~1 min) so steady-state is not guaranteed.
4. Configuration labels rest on weak evidence. All BASS-II opposed labels rest on publication titles; sibal "concurrent" rests on one 2017 title; 25 sphere tests are `unknown`. Treat configuration-specific models cautiously; pooling configurations is a modelling choice.
5. Pressure is constant, so z_p carries no information; PSI-25 pressure is an assumption. Interpretive flags from curators: B14/B18/B19 flow, M3 near-duplicate steps, O8a, P5/P13a pot 0, BASS 2013 tests 100 and 102 extinction mode, T'ien (all sustained by order alone).

## Environment note
The editable-install `.pth` in `services/analysis/.venv` gets the macOS `hidden` flag, so Python ignores it and `import blindspots` fails after `uv sync`. Run `chflags nohidden .venv/lib/python3.12/site-packages/_editable_impl_blindspots.pth` or set `PYTHONPATH=src`.
