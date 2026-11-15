# NASA PSI combustion investigations: catalog and role in Blind Spots

Compiled 2026-11-15 from the public PSI API. Machine-readable version: `data/manifests/psi_investigations.json` (24 records).
Nothing here is a claim that NASA has or has not studied a condition; "not integrated" means not represented in our integrated records.

## Method
1. `GET https://psi.nasa.gov/geode-py/ws/repo/search` with `ffield=Research Area&fvalue=Combustion Science` and an empty term returns 24 investigations (`hits.total` = 24). The same filter with the terms combustion, flame, fire, flammability, solid fuel, spread, ignition, extinction, SIBAL, PMMA, wire, droplet, smoke, soot returns only subsets of those 24; "smolder" returns 0. An unfiltered listing of all 133 PSI records has exactly 24 with this research area, and no record in another research area has a combustion/fire/flame/burn word in its title or keywords.
2. Per investigation: `GET .../repo/investigations/<PSI-ID>` (counts, sizes, DOI, licence, hardware, dates, publications, file list `added`).
3. Tabular files under 5 MB and every "Experimental table" CSV were downloaded through the presigned-URL endpoint into the session scratchpad only (35 files, 5.5 MB; none in the repo). Local snapshots in `data/raw/psi/` were read for BASS, BASS-II and the SAFFIRE ReadMe.
4. Roles: `integrated_model` (per-test O2/flow/outcome for solid fuel), `integrated_context` (large-scale solid-fuel tests, context only), `catalogued_not_integrated` (everything else).

## Integrated investigations
| ID | Acronym | DOI | Platform | Files (listed) | Role | Why |
|---|---|---|---|---|---|---|
| PSI-25 | BASS-II | 10.60555/4qc4-de67 | ISS Microgravity Science Glovebox | 694: 296 mp4, 265 zip, 127 pdf, 2 xlsx (274.6 GB) | integrated_model | Test matrices with calibrated O2 %, flow schedule, outcomes; no per-test pressure |
| PSI-26 | BASS | 10.60555/58h4-dy80 | ISS Microgravity Science Glovebox | 211: 114 mp4, 60 zip, 32 pdf, 2 xlsx (163.6 GB) | integrated_model | As-run matrix with O2 %, pressure atm, flow, free-text outcomes |
| PSI-98 | SAFFIRE-I | 10.60555/0t15-1z43 | Saffire enclosure in Cygnus | 74: 61 zip, 6 pdf, 4 xlsx, 3 docx (12.3 GB) | integrated_context | 2 SIBAL samples (40.6 x 94 cm), 20 cm/s, O2 ~21.5-21.7 %; telemetry only |
| PSI-99 | SAFFIRE-II | 10.60555/2chp-m469 | Cygnus Pressurized Cargo Module | 0 listed (16.9 GB reported) | integrated_context | 9 samples, one condition (20 cm/s, ~21.5-22.1 % O2); table has burn time, spread rates. Newly identified |
| PSI-100 | SAFFIRE-III | 10.60555/040q-4h36 | Saffire enclosure in Cygnus | 85: 67 zip, 7 pdf, 6 xlsx, 3 docx, 2 csv (35.2 GB) | integrated_context | 2 SIBAL samples, 30 cm/s; no O2 or outcome columns |

Variables found: BASS-II table/matrices: investigator, test no., date, GMT, sample no., material text, flow restrictor, fan display, air display (cm/s), radiometer gain, frames, calibrated initial/final O2 % vol, initial/final CO2 % vol, CO ppm. BASS as-run matrix: the same flow fields plus GN2 pot, O2 % vol, pressure atm, CO2 mm Hg and free-text observations. BASS "Experimental table" CSV has only date, test numbers, sample, material (no O2/flow/outcome). SAFFIRE-I/II/III tables: material, dimensions, flow cm/s, direction (II and I also O2 %, ignition power/time, burn time). SAFFIRE-I telemetry (RawData, 9750 x 48) and SAFFIRE-III raw telemetry CSV contain radiometers, anemometers, fan tach, igniter V/I, cabin pressure and temperature, smoke detector, attitude; no O2 column.

## Catalogued, not integrated
| ID | Acronym | Sub-area | Files (listed; total size) | Tabular | Reason |
|---|---|---|---|---|---|
| PSI-10 | ACME/Flame Design | Gaseous fuels | 3807; 2180 GB | 1631 (txt/csv) | Gaseous spherical diffusion flames; licence field empty in metadata |
| PSI-20 | ACME BRE | Gaseous fuels | 1; 2036 GB | table only | Gaseous porous burner emulating solid burning rate; not solid fuel |
| PSI-21 | ACME CLD Flame | Gaseous fuels | 1; 2006 GB | table only | Coflow gaseous flames |
| PSI-22 | ACME E-FIELD | Laminar flames | 0; 950 GB | table only | Electric field, gaseous |
| PSI-23 | ACME s-Flame | Gaseous fuels | 4163; 782 GB | 1541 | Gaseous flame structure |
| PSI-39 | CFI | Droplets | 2831; 719 GB | 1794 | Liquid droplet cool flames |
| PSI-47 | DAFT/DAFT-2 | Spacecraft fire safety | 32; 42 MB | 18 (xls/txt) | Dust aerosol sensor test, no flames |
| PSI-60 | (none) | Gaseous | 1; 8 KB | none | Soot modelling; metadata zip only |
| PSI-62 | (none) | Spacecraft fire safety | 1; 10 KB | none | Concurrent flame-spread modelling (flamelet manifolds); metadata zip only, no data |
| PSI-68 | FLEX-2 | Spacecraft fire safety | 0; 1225 GB | table only | Liquid droplets |
| PSI-69 | FLEX | Spacecraft fire safety | 0; 924 GB | table only | Liquid droplets, suppressants |
| PSI-101 | SAME-R | Spacecraft fire safety | 342; 6.3 GB | 136 | Smoke aerosol sizes from heated materials |
| PSI-102 | SAME | Spacecraft fire safety | 104; 0.66 GB | 61 | Smoke aerosol sizes |
| PSI-106 | SLICE | (empty) | 1; 72.9 GB | table only | Gaseous jet flames |
| PSI-107 | SPICE | Fire safety | 186; 6.9 GB | 35 | Gaseous smoke point |
| PSI-115 | (none) | Smoke aerosol | 47; 0.26 GB | 44 (.dat) | Smoke growth simulation, modelling-only |
| PSI-117 | (none) | Droplet | 15; 71 MB | 10 csv/xlsx | Ground analysis of FLEX droplet cool flames |
| PSI-142 | (none) | Spacecraft fire safety | 2; 0.7 MB | 2 | Counterflow cool-flame study |
| PSI-159 | ACME CFI-G | Gaseous fuels | 3756; 2086 GB | 1703 | Gaseous cool flames |

Licence is CC0-1.0 for all except PSI-10 (not stated). DOIs and landing URLs for all 24 are in the JSON. Landing URL pattern: `https://psi.nasa.gov/physci/repo/data/investigations/<PSI-ID>`.

## Possibly missed or notable
- PSI-99 (SAFFIRE-II) has a per-sample table with O2, flow, flow direction, burn time and spread rates for silicone, SIBAL, PMMA and PMMA/Nomex. It is not a boundary dataset (one flow, ~one O2) but it is the only other solid-fuel table with O2 and outcome. Suggest adding as context. Its cells contain typos ("037 mm", "?-g") that must be kept as published.
- No other PSI investigation in the Combustion Science area has solid-fuel test matrices with per-test O2 and flow. PSI-62 is solid-fuel modelling with no PSI data.
- BASS-II ReadMe/SRD and the "Fan calibration data" workbook are the only BASS-II tabular support files; BASS (PSI-26) has no fan calibration (consistent with CONTRACTS section 2.4).
- Most bytes in PSI-25/26 are video and image archives (zip, mp4, per-test PDFs); we did not open them.

## Caveats
- The public AWS bucket `s3://nasa-psi` holds only DSI/, OASIS/ and pk4/ prefixes (listed 2026-11-15) and none of these PSI combustion data; PSI files come from the API's presigned URLs.
- `remote_url` values (host psi.ndc.nasa.gov) in the metadata do not resolve publicly and are not cited.
- File lists come from the `added` field and are the current listing; PSI-22, 68, 69 and 99 list no files although total sizes are large (unverified whether files exist or are hidden). The "removed" lists were ignored.
- Metadata inconsistencies: PSI-98 dates 2001-2008 contradict telemetry timestamps (2016-06-14 UTC); SAFFIRE records say flightProgram ISS but hardware Cygnus; PSI-106/107 have no dates; PSI-98 and PSI-102 share identical dates.
- Counts of tabular files include instrument and telemetry files, not only test tables; "under 5 MB" tabular files were opened only for solid-fuel and small ground investigations. PSI-101/102/107 data files, PSI-47 xls and PSI-115 .dat were not opened.
- One additional planned-matrix workbook in PSI-26 was neither downloaded nor used (project rule).
- Whether SAFFIRE-I/III O2 values exist elsewhere (e.g. PDFs) was not checked; the telemetry has no O2 column.
