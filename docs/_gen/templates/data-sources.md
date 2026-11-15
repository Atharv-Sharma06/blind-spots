# Data sources

Every number in the product traces to a file listed here. Source files under `data/raw/` are never modified; interpretations are stored in separate tables with cell-level provenance.
Counts below are from `data/normalized/dataset_report.json` (dataset `{{DV}}`).

## 1. Integrated investigations

{{INV_TABLE}}

Roles: `integrated_model` investigations supply training data; `integrated_context` investigations are shown on the map as documented conditions and never enter a model;
`catalogued_not_integrated` investigations are in the PSI catalogue only ({{N_CATALOGUED_ONLY}} of them; no data used). All PSI records carry the licence stated in PSI metadata (CC0-1.0 where stated; "not stated in PSI metadata" otherwise).
Landing pages follow `https://psi.nasa.gov/physci/repo/data/investigations/<PSI-ID>`; the `remote_url` host in PSI metadata does not resolve publicly and is never linked (D-002).

### Model data: BASS-II (PSI-25) and BASS (PSI-26)

- ISS Microgravity Science Glovebox, solid-fuel flammability. Public as-run test matrices record O2, flow schedule (fan display, pot setting or duct air display), material and free-text outcome notes.
- {{N_PSI25}} experiments / {{N_PSI25_OBS}} flow-step observations (PSI-25) and {{N_PSI26}} experiments / {{N_PSI26_OBS}} observations (PSI-26) in the current build.
- Free text is interpreted into `data/curation/tests/*.csv` and `data/curation/steps/*.csv` by two independent transcriptions per chunk that are adjudicated (D-004). Each step records the exact `raw_token`,
  its column and its row; the build re-reads the original workbook and rejects any token that is not an exact substring of the cited cell ({{N_PROVENANCE_FAIL}} provenance failures in this build).
- Outcome evidence for BASS-II is cross-checked against NASA/TM-20210011385 (the BASS-II Summary Report, NTRS 20210011385), Appendix A, transcribed to `data/curation/evidence/bass2_tm_appendix_a.csv`
  (126 rows, each observation text verified as a substring of its PDF column). In this build {{TM_STEPS}} steps in {{TM_TESTS}} tests carry TM evidence ({{TM_STEPS_TRAIN}} of those steps are in training) and {{TM_NOTES}} experiments carry TM notes.
  Applying the TM labels changed {{CFG_CHANGED}} flame-configuration labels relative to the previous build ({{CFG_TRANSITIONS}}); conflicts with the ReadMe were resolved conservatively to `unknown`.
- Flow conversion: duct "air display" values use U = 1.0066 x AIR (note in the PSI-25 fan-calibration workbook); fan and pot settings are converted with the PSI-25 fan calibration (same restrictor count and day when possible, otherwise nearest day), with linear extrapolation below the calibrated range (flagged `below_calibration_range`).
  BASS (PSI-26) has no fan calibration in the integrated files, so its fan/pot values borrow the BASS-II calibration (flag `calibration_borrowed_from_bass2`, confidence low).
- Pressure: BASS records pressure per test (measured). BASS-II records none: the ISS cabin nominal 101.353 kPa from the atmosphere profile is stored in `pressure_assumed_kpa` (flag `pressure_assumed`), never in a measurement field (D-006).
- Training-eligible observations: {{N_TRAIN_OBS}} of {{N_OBS}} (see section 5 for exclusions).

### Context records (not modelled)

- Saffire-I and Saffire-III (PSI-98, PSI-100): four tests in `data/curation/saffire_tests.csv`; O2 and pressure are sensor medians over a radiometer-defined flame window; large-scale apparatus.
- Context tables transcribed from NASA documents (`data/curation/context_microgravity/*.csv`): DARTFire (NTRS 20030111833, Table 1), Glenn 5.18 s drop-tower flammability limits (NASA/TM-2008-215260, NTRS 20080034883),
  Saffire-IV/V (ICES-2021-266, NTRS 20210011521) and Saffire-VI (ICES-2024-365, NTRS 20240002981). Records by source in this build: {{CONTEXT_BY_SOURCE}} ({{N_CONTEXT_RECORDS}} in total).
  Each row keeps the source title, URL, page and table, and was re-checked against a rendered page image.
- Ground (normal-gravity) flammability thresholds (`data/curation/ground_flammability/*.csv`; NTRS 20070005041, 20070018178, 20100015582, 20160001047): context only, never joined to microgravity data.
- `data/curation/publication_points.csv`: points printed in publications for cross-checking BASS / BASS-II (reference only, not training data).

## 2. Investigations catalogued but not integrated

`data/manifests/known_investigations_not_integrated.json` lists NASA and partner work that exists but is not integrated here, each with a documented envelope, a data-availability statement and the reason it is not integrated.
Some of these (DARTFire, the Glenn drop-tower limits, Saffire-IV/V/VI) also appear as context records in section 1; context records are shown on the map but never modelled.
Because of this file, Blind Spots reports gaps as "not represented in the integrated records" and never as "NASA has not studied this".

{{NOT_INTEGRATED_TABLE}}

## 3. Target atmosphere profiles

`data/manifests/atmosphere_profiles.json` holds {{N_PROFILES}} profiles; every profile carries verbatim NASA quotes that were machine-checked against the downloaded documents. Nominal values may be null where a source gives only a bound:

{{PROFILE_TABLE}}

- `nasa_std_3001_crew_envelope` is an envelope (context / sources only), not an analysis target.
- For null nominals the analysis uses the documented bound and flags it (`documented_upper_bound_used`, `documented_bound_used`); it never invents a nominal.
- Airflow: a profile's own band if present; otherwise [0.5, {{VENT_MAX}}] cm/s, where the documented ventilation band is {{VENT_MIN}} to {{VENT_MAX}} cm/s (NASA-STD-3001 Vol. 2 Rev F and the Human Integration Design Handbook).
  The extension below {{VENT_MIN}} down to 0.5 cm/s is an analysis choice (ventilation loss or dead zones; microgravity flame extinction occurs at low flow) and is reported as `airflow_band_source = ventilation_standard_with_near_quiescent_extension`.
- Sources include NASA-STD-3001 (Vol. 2 Rev F; OCHMO-TB-003), NASA/TM-2013-217377, JSC-CN-34806, ICES-2015-146, ICES-2025-126, NTRS 20140000417, 20220011152, 20070021378, 20090012334 and NASA TN D-6718 (Apollo ECS); exact titles, pages and quotes are in the JSON.
- Independent verification found 10 profiles confirmed and 1 corrected (an incorrect SAE reference and a status change); see `docs/decisions.d/apply-profile-verdicts.md`.

## 4. Files deliberately not used

- One planned-test-matrix workbook of PSI-26 is excluded from the repository and pipeline because a header cell appears to contain legacy credentials; the as-run matrix supersedes it (D-003). The PSI client refuses to request it.
- The BASS Final Report and the SPICE report could not be downloaded (storage returns NoSuchKey) and are not used.
- Journal PDFs behind paywalls were not downloaded; the BASS-II Summary Report reproduces the same PI papers and is cited with TM page numbers.

## 5. What was used and what was excluded

Of {{N_OBS}} flow-step observations, {{N_TRAIN_OBS}} are training observations and {{EXCL_OBS_TOTAL}} are excluded ({{LABEL_COUNTS_ALL}}):

{{EXCL_OBS_TABLE}}

Of {{N_EXP}} experiments, {{N_TRAIN_EXP}} contribute at least one training observation; {{EXCL_EXP_TOTAL}} are excluded:

{{EXCL_EXP_TABLE}}

Excluded rows stay in the records with their reason. Low-confidence curated steps are added back only in a sensitivity analysis (D-008).

## 6. Quality flags worth knowing

- {{FLAG_PRESSURE_ASSUMED_ALL}} observations carry `pressure_assumed`; {{FLAG_BELOW_CAL_ALL}} carry `below_calibration_range`; {{FLAG_BORROWED_ALL}} use a borrowed calibration; {{FLAG_O2_INTERP_ALL}} have linearly interpolated O2.
- {{FLAG_FLOW_OFF_ALL}} observations are `flow_off_transient` (flow turned off; not a physical quench) and {{FLAG_NOSUST_ALL}} are `no_sustained_propagation` (brief flame).
- Possible duplicate pairs (flag only; nothing is dropped): {{EXP_POSSIBLE_DUP}}.
- Full per-field missing-value table: `data/normalized/dataset_report.json` (`missing_values`).

## 7. Licence and attribution

NASA PSI data are CC0-1.0. NTRS documents are cited by identifier and used for transcribed tables with page references. This project is not endorsed by NASA and uses no NASA branding.
