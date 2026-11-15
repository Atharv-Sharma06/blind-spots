# Data sources

Every number in the product traces to a file listed here. Source files under `data/raw/` are never modified; interpretations are stored in separate tables with cell-level provenance.
Counts below are from `data/normalized/dataset_report.json` (dataset `4fe55f76142a`).

## 1. Integrated investigations

| id | name | role | experiments | flow-step observations | DOI |
|---|---|---|---|---|---|
| NTRS-20030111833 | DARTFire | integrated_context | 8 | 0 | n/a |
| NTRS-20080034883 | Glenn 5.18 s drop tower flammability limits | integrated_context | 6 | 0 | n/a |
| NTRS-20210011521 | Saffire-IV, Saffire-V | integrated_context | 5 | 0 | n/a |
| NTRS-20240002981 | Saffire-VI | integrated_context | 3 | 0 | n/a |
| PSI-25 | BASS-II | integrated_model | 129 | 431 | 10.60555/4qc4-de67 |
| PSI-26 | BASS | integrated_model | 121 | 318 | 10.60555/58h4-dy80 |
| PSI-98 | SAFFIRE-I | integrated_context | 2 | 0 | 10.60555/0t15-1z43 |
| PSI-99 | SAFFIRE-II | integrated_context | 0 | 0 | 10.60555/2chp-m469 |
| PSI-100 | SAFFIRE-III | integrated_context | 2 | 0 | 10.60555/040q-4h36 |

Roles: `integrated_model` investigations supply training data; `integrated_context` investigations are shown on the map as documented conditions and never enter a model;
`catalogued_not_integrated` investigations are in the PSI catalogue only (19 of them; no data used). All PSI records carry the licence stated in PSI metadata (CC0-1.0 where stated; "not stated in PSI metadata" otherwise).
Landing pages follow `https://psi.nasa.gov/physci/repo/data/investigations/<PSI-ID>`; the `remote_url` host in PSI metadata does not resolve publicly and is never linked (D-002).

### Model data: BASS-II (PSI-25) and BASS (PSI-26)

- ISS Microgravity Science Glovebox, solid-fuel flammability. Public as-run test matrices record O2, flow schedule (fan display, pot setting or duct air display), material and free-text outcome notes.
- 129 experiments / 431 flow-step observations (PSI-25) and 121 experiments / 318 observations (PSI-26) in the current build.
- Free text is interpreted into `data/curation/tests/*.csv` and `data/curation/steps/*.csv` by two independent transcriptions per chunk that are adjudicated (D-004). Each step records the exact `raw_token`,
  its column and its row; the build re-reads the original workbook and rejects any token that is not an exact substring of the cited cell (0 provenance failures in this build).
- Outcome evidence for BASS-II is cross-checked against NASA/TM-20210011385 (the BASS-II Summary Report, NTRS 20210011385), Appendix A, transcribed to `data/curation/evidence/bass2_tm_appendix_a.csv`
  (126 rows, each observation text verified as a substring of its PDF column). In this build 213 steps in 106 tests carry TM evidence (209 of those steps are in training) and 126 experiments carry TM notes.
  Applying the TM labels changed 0 flame-configuration labels relative to the previous build (); conflicts with the ReadMe were resolved conservatively to `unknown`.
- Flow conversion: duct "air display" values use U = 1.0066 x AIR (note in the PSI-25 fan-calibration workbook); fan and pot settings are converted with the PSI-25 fan calibration (same restrictor count and day when possible, otherwise nearest day), with linear extrapolation below the calibrated range (flagged `below_calibration_range`).
  BASS (PSI-26) has no fan calibration in the integrated files, so its fan/pot values borrow the BASS-II calibration (flag `calibration_borrowed_from_bass2`, confidence low).
- Pressure: BASS records pressure per test (measured). BASS-II records none: the ISS cabin nominal 101.353 kPa from the atmosphere profile is stored in `pressure_assumed_kpa` (flag `pressure_assumed`), never in a measurement field (D-006).
- Training-eligible observations: 565 of 749 (see section 5 for exclusions).

### Context records (not modelled)

- Saffire-I and Saffire-III (PSI-98, PSI-100): four tests in `data/curation/saffire_tests.csv`; O2 and pressure are sensor medians over a radiometer-defined flame window; large-scale apparatus.
- Context tables transcribed from NASA documents (`data/curation/context_microgravity/*.csv`): DARTFire (NTRS 20030111833, Table 1), Glenn 5.18 s drop-tower flammability limits (NASA/TM-2008-215260, NTRS 20080034883),
  Saffire-IV/V (ICES-2021-266, NTRS 20210011521) and Saffire-VI (ICES-2024-365, NTRS 20240002981). Records by source in this build: NTRS-20030111833 (DARTFire): 8; NTRS-20080034883 (Glenn 5.18 s drop tower flammability limits): 6; NTRS-20210011521 (Saffire-IV): 2; NTRS-20210011521 (Saffire-V): 3; NTRS-20240002981 (Saffire-VI): 3 (22 in total).
  Each row keeps the source title, URL, page and table, and was re-checked against a rendered page image.
- Ground (normal-gravity) flammability thresholds (`data/curation/ground_flammability/*.csv`; NTRS 20070005041, 20070018178, 20100015582, 20160001047): context only, never joined to microgravity data.
- `data/curation/publication_points.csv`: points printed in publications for cross-checking BASS / BASS-II (reference only, not training data).

## 2. Investigations catalogued but not integrated

`data/manifests/known_investigations_not_integrated.json` lists NASA and partner work that exists but is not integrated here, each with a documented envelope, a data-availability statement and the reason it is not integrated.
Some of these (DARTFire, the Glenn drop-tower limits, Saffire-IV/V/VI) also appear as context records in section 1; context records are shown on the map but never modelled.
Because of this file, Blind Spots reports gaps as "not represented in the integrated records" and never as "NASA has not studied this".

| id | investigation | O2 % range | pressure kPa range | flow cm/s range | reason not integrated into the model |
|---|---|---|---|---|---|
| `sofie-gel` | SoFIE-GEL (Growth and Extinction Limit of Solid Fuels), PMMA spheres | 13 to 34 | 15.2 to 111.5 | 0.2 to 80 | No public per-test table covering the 0.15-1.1 atm and 13-34 % O2 envelope was found (only a figure and a 5-case table, all near 1 atm); sphere diffusion-flame extinction under O2 depletion is a different outcome definition from BASS flow-step outcomes; outside the PSI-based scope of D-001. |
| `sofie-mist` | SoFIE-MIST (Material Ignition and Suppression Test), PMMA cylinders with external radiant flux | n/a | n/a | n/a | No published per-test conditions or outcomes found; numeric O2, pressure and flow ranges are not stated in any source retrieved. |
| `sofie-other-smurf-nca-rtdfs` | SoFIE other sub-investigations: SMuRF (Olson), NCA (Miller), RTDFS (Bhattacharjee) | n/a | n/a | n/a | No public per-test results found; stated atmospheres are planned or motivating conditions, not documented test outcomes. |
| `saffire-iv` | Saffire-IV (Spacecraft Fire Experiment IV): SIBAL cloth and two-sided PMMA, concurrent flow | 22.0 to 22.0 | 100.0 to 100.0 | 0 to 20 | Large-scale (50 cm / 18 cm samples, 20 cm/s, 17.9-19 m3) spacecraft-fire apparatus, not flow-step boundary tests like BASS; no machine-readable per-test dataset; Saffire-IV itself is at 22.0 % O2 and 100 kPa (not reduced pressure). |
| `saffire-v` | Saffire-V (Spacecraft Fire Experiment V): cotton jersey, one-sided PMMA, structured PMMA at reduced pressure and elevated O2 | 25.4 to 26.2 | 70.7 to 72.6 | 0 to 20 | Large-scale spacecraft-fire apparatus with one flow (20 cm/s, later reduced) per sample and only 3 reduced-pressure data points; per-test numbers exist only as a table in papers; not in PSI per the catalog. |
| `saffire-vi` | Saffire-VI (Spacecraft Fire Experiment VI): SIBAL, two-sided and one-sided PMMA at 54-55 kPa and 29-31 % O2 | 28.8 to 31.0 | 54.1 to 55.2 | 0 to 20 | Large-scale spacecraft-fire apparatus at one flow (20 cm/s) per sample; only three conditions; per-test data are in a paper table, not a machine-readable dataset; recorded as an out-of-envelope context candidate rather than boundary data. |
| `ssce-thin-cellulose` | SSCE (Solid Surface Combustion Experiment), thin ashless filter paper in quiescent O2/N2 | 35 to 50 | 101.325 to 202.65 | 0 to 0 | Quiescent (no forced flow), all at or above 1 atm; spread rates not sustain/extinguish outcomes at a flow step; five data points; not in PSI. |
| `ssce-thick-pmma` | SSCE thick PMMA flights (STS-54, STS-63, STS-64) and STS-85 reflight, quiescent high-O2 | 50 to 70 | 101.325 to 202.65 | 0 to 0 | Three flights only, quiescent, at 1-2 atm and 50-70 % O2 (far from cabin-relevant O2 and reduced pressure); results are spread-rate/extinction behaviour, not tabulated; not in PSI. |
| `fffft-usmp3` | FFFT (Forced Flow Flame Spreading Test), part of SIBAL ground/flight precursor | n/a | n/a | 1 to 8 | Air only (about 21 % O2, pressure not stated), cellulose, abstract-level data; no elevated-O2 or reduced-pressure conditions stated; not in PSI. |
| `ritsi-usmp3` | RITSI (Radiative Ignition and Transition to Spread Investigation) | n/a | n/a | 0 to 6.5 | Air at ambient pressure (O2 and pressure not stated numerically), ignition-transition outcomes, no flow-step flammability data; not in PSI. |
| `dartfire` | DARTFire (Diffusive and Radiative Transport in Fires), opposed-flow flame spread over PMMA with external radiant flux | 35 to 70 | 101.325 to 101.325 | 1 to 10 | Elevated O2 only (all at 1 atm), only 8 tests, spread-rate rather than flow-step sustain/extinguish outcomes; the table is in a paper (transcription would be manual); not in PSI. |
| `glenn-zgrf-drop-exploration-atmospheres` | NASA Glenn Zero Gravity Research Facility drop-tower flammability in exploration atmospheres (Olson, Ruff, Miller; NASA/TM-2008-215260), 0g vs NASA-STD-6001 Test 1 | 16 to 85 | 24.8 to 101.4 | 0 to 30 | Drop-tower 5.18 s limits criterion ('lowest O2 where flame survived to end of drop') differs from flame-sustained-at-flow-step outcomes in ISS tests; only Table 1 is tabular (3 fuels, 2 pressures); 40 Kimwipes tests are in figures; different materials from the BASS/BASS-II integrated set. |
| `glenn-drop-lunar-martian-gravity` | NASA Glenn drop-tower flammability limits at Martian and Lunar gravity vs 0g and NASA-STD-6001 Test 1 (Olson, Ferkul) | 14.1 to 22.0 | 70.3 to 101.4 | n/a | Partial gravity (and drop-tower limit criteria that differ from 1g) rather than microgravity ISS flow-step data; only limit values, not per-test outcomes; the 0g column duplicates the Glenn 2008 table. |
| `jaxa-flare-scem-iss` | JAXA FLARE (Flammability Limits at Reduced-g Experiment), Solid Combustion Experiment Module on ISS/Kibo | n/a | 100 to 100 | n/a | No machine-readable per-test data located; the published tests so far (filter paper) are at 100 kPa; limiting-oxygen maps are figures; JAXA and not in PSI. |
| `zarm-flare-g1-drop-tower` | ZARM Bremen drop-tower tests on thin PMMA sheets (FLARE-G I, ESA/DLR-supported, part of JAXA FLARE) | n/a | n/a | n/a | No numeric conditions or per-test results published on the page retrieved; short-duration drop tower; no public machine-readable data found. |
| `olson-2013-ir-thin-cellulose` | Olson, Lee, Fujita, Kikuchi, Kashiwagi: infrared analysis of simultaneous upstream/downstream flame spread over thin cellulose in low-speed forced flow | 21 to 50 | 101.325 to 101.325 | 2 to 20 | Elevated O2 at 1 atm only; the microgravity platform was not confirmed from the retrieved text; spread-rate and heat-flux analysis, not flammability-limit outcomes; not in PSI. |

## 3. Target atmosphere profiles

`data/manifests/atmosphere_profiles.json` holds 12 profiles; every profile carries verbatim NASA quotes that were machine-checked against the downloaded documents. Nominal values may be null where a source gives only a bound:

| profile | status | O2 % | total pressure kPa | NASA sources |
|---|---|---|---|---|
| `iss_cabin_nominal` | documented_nasa | nominal 21, max 24.1 | nominal 101.353, min 96.527, max 102.732 | 5 |
| `iss_materials_worst_case` | documented_nasa | nominal 24.1 | nominal 101.353 | 3 |
| `shuttle_nominal` | documented_nasa | nominal 21 | nominal 101.353 | 2 |
| `shuttle_staged_pre_eva` | documented_nasa | nominal 26.5 | nominal 70.327 | 3 |
| `exploration_atmosphere_8p2_34` | nasa_design_recommendation | nominal 34 | nominal 56.537 | 6 |
| `artemis_surface_habitat_10p2_26p5` | nasa_design_recommendation | nominal 26.5 | nominal 70.327 | 1 |
| `eawg_2006_8p0_32` | nasa_design_recommendation | nominal 32 | nominal 55.158 | 3 |
| `orion_cm_lunar_design_10p2` | nasa_design_recommendation | max 30 | nominal 70.327 | 2 |
| `orion_cm_14p7_o2_limit` | historical_nasa | max 25.6 | nominal 101.353 | 1 |
| `nasa_std_3001_crew_envelope` | documented_nasa | max 70 | min 34.5, max 103 | 3 |
| `skylab` | historical_nasa | nominal 70 | nominal 34.474 | 3 |
| `apollo_cm` | historical_nasa | nominal 100 | nominal 34.474 | 3 |

- `nasa_std_3001_crew_envelope` is an envelope (context / sources only), not an analysis target.
- For null nominals the analysis uses the documented bound and flags it (`documented_upper_bound_used`, `documented_bound_used`); it never invents a nominal.
- Airflow: a profile's own band if present; otherwise [0.5, 60.96] cm/s, where the documented ventilation band is 7.62 to 60.96 cm/s (NASA-STD-3001 Vol. 2 Rev F and the Human Integration Design Handbook).
  The extension below 7.62 down to 0.5 cm/s is an analysis choice (ventilation loss or dead zones; microgravity flame extinction occurs at low flow) and is reported as `airflow_band_source = ventilation_standard_with_near_quiescent_extension`.
- Sources include NASA-STD-3001 (Vol. 2 Rev F; OCHMO-TB-003), NASA/TM-2013-217377, JSC-CN-34806, ICES-2015-146, ICES-2025-126, NTRS 20140000417, 20220011152, 20070021378, 20090012334 and NASA TN D-6718 (Apollo ECS); exact titles, pages and quotes are in the JSON.
- Independent verification found 10 profiles confirmed and 1 corrected (an incorrect SAE reference and a status change); see `docs/decisions.d/apply-profile-verdicts.md`.

## 4. Files deliberately not used

- One planned-test-matrix workbook of PSI-26 is excluded from the repository and pipeline because a header cell appears to contain legacy credentials; the as-run matrix supersedes it (D-003). The PSI client refuses to request it.
- The BASS Final Report and the SPICE report could not be downloaded (storage returns NoSuchKey) and are not used.
- Journal PDFs behind paywalls were not downloaded; the BASS-II Summary Report reproduces the same PI papers and is cited with TM page numbers.

## 5. What was used and what was excluded

Of 749 flow-step observations, 565 are training observations and 184 are excluded (label 1 (sustained) 584, label 0 (not sustained) 150, no label 15):

| reason (observations) | count |
|---|---|
| low_confidence | 165 |
| not_ignited | 13 |
| no_numeric_airflow | 4 |
| n2_suppression | 2 |

Of 276 experiments, 210 contribute at least one training observation; 66 are excluded:

| reason (experiments) | count |
|---|---|
| context only: different apparatus or test duration | 22 |
| low_confidence | 19 |
| not_ignited | 12 |
| no_curated_flow_steps | 9 |
| different apparatus and scale: context only | 4 |

Excluded rows stay in the records with their reason. Low-confidence curated steps are added back only in a sensitivity analysis (D-008).

## 6. Quality flags worth knowing

- 431 observations carry `pressure_assumed`; 232 carry `below_calibration_range`; 154 use a borrowed calibration; 396 have linearly interpolated O2.
- 26 observations are `flow_off_transient` (flow turned off; not a physical quench) and 27 are `no_sustained_propagation` (brief flame).
- Possible duplicate pairs (flag only; nothing is dropped): PSI-26:24/12-R vs PSI-26:24/12-R2, PSI-26:26 vs PSI-26:27.
- Full per-field missing-value table: `data/normalized/dataset_report.json` (`missing_values`).

## 7. Licence and attribution

NASA PSI data are CC0-1.0. NTRS documents are cited by identifier and used for transcribed tables with page references. This project is not endorsed by NASA and uses no NASA branding.
