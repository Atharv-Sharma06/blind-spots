# Implementation decisions and open limitations

Append-only log. Format: `D-NNN (date, author): decision. Why. Consequence.`

- D-001 (2026-11-15, lead): Data scope starts from NASA PSI investigations BASS (PSI-26) and BASS-II
  (PSI-25), whose as-run test matrices are public, CC0-licensed and record per-test O2, flow schedule,
  material and outcome notes. Saffire-I/III (PSI-98/PSI-100) are context records. Why: these are the only
  PSI combustion records found with per-test solid-fuel flammability conditions in machine-readable form.
- D-002 (2026-11-15, lead): The public AWS bucket `s3://nasa-psi` holds only DSI, OASIS and pk4 data, so
  PSI files are retrieved through the PSI web service (`/geode-py/ws/studies/<ID>/download?file=...&redirect=false`
  returns a presigned S3 URL; no login). The `remote_url` host `psi.ndc.nasa.gov` in PSI metadata does not
  resolve publicly (NXDOMAIN) and is never used for links.
- D-003 (2026-11-15, lead): `PSI-26_Science Documents_Planned_Test Matrix.xlsx` is excluded from the repo and
  pipeline: cell B1 contains what look like legacy credentials. It is not needed (the as-run matrix supersedes it).
- D-004 (2026-11-15, lead): Free-text flow schedules are interpreted in curation tables with cell-level
  provenance; two independent transcriptions per chunk are adjudicated, and the pipeline verifies every
  quoted token against the original cell. Why: reproducibility and auditability of the main manual step.
- D-005 (2026-11-15, lead): Unit of observation = one flow step of one test (flame sustained or not at a
  recorded airflow and O2). Steps of one test are correlated, so all validation is grouped by experiment
  (and by campaign group for leave-one-group-out).
- D-006 (2026-11-15, lead): BASS-II test matrices do not record total pressure. Measurement fields stay null;
  a documented ISS cabin nominal is stored separately as `pressure_assumed_kpa` (flagged) and used only to
  place points in pressure-axis views and coverage computations.
- D-007 (2026-11-15, lead): Analysis group = material family + flame configuration (`models/groups.py`). A group is
  modelled only with ≥ 6 training experiments, ≥ 3 sustained and ≥ 3 not-sustained observations, and not-sustained
  outcomes in ≥ 2 experiments; otherwise coverage is shown but predictions are not (`insufficient_data`). Why: grouped
  cross-validation needs several independent experiments and both outcomes.
- D-008 (2026-11-15, lead): Primary training filter keeps confidence high + medium; low-confidence curated steps stay
  in the records and are added back only in a sensitivity analysis. Why: conservative default for interpreted text.
- D-009 (2026-11-15, lead): Pressure enters the GP with a fixed, assumed length scale (0.3 in ln-pressure units) because
  every integrated observation is at ~1 atm, so the scale cannot be learned. All pressure extrapolation is therefore
  assumption-driven; the API reports a sensitivity check (0.15 / 0.3 / 0.6) and flags assumption-dependent candidates.
- D-010 (2026-11-15, lead): The submission deadline (Space Apps 2026 "Flame in Freefall", 2026-11-15 23:59 local) sets
  scope: the public deployment serves a precomputed snapshot produced by the same Python code (docs/API.md); custom
  targets need the live analysis service. No 3D view.
- D-011 (2026-11-15, research-psi-catalog): PSI catalogue scope and classification of context investigations. Source: `docs/decisions.d/research-psi-catalog.md` (kept; text below is copied from it).
  - D-psi-1: Research Area = Combustion Science defines the catalog scope; 24 investigations, verified by filter and by a full 133-record listing.
  - D-psi-2: PSI-99 (SAFFIRE-II) classified integrated_context (proposed addition): its public table has per-sample O2, flow and burn outcomes, but only one flow/O2 condition. Lead to confirm.
  - D-psi-3: PSI-62 (modelling-only, PMMA rod/flame-spread relevant) and PSI-20 (gaseous burner emulating solid burning rate) are catalogued_not_integrated.
  - D-psi-4: Files and counts use the investigation `added` list; `removed` lists and `remote_url` hosts are ignored/not cited.
  - D-psi-5: The PSI-26 planned test-matrix workbook is counted in file totals by the API but not named, downloaded or used.
  - D-psi-6: PSI metadata dates for PSI-98 are flagged as unreliable (telemetry timestamps say 2016); the JSON keeps the published dates plus a metadata_notes entry.
- D-012 (2026-11-15, research-atmosphere-profiles): Atmosphere profiles: verbatim-quote rule, null nominals, ventilation band. Source: `docs/decisions.d/research-atmosphere-profiles.md` (kept; text below is copied from it).
  - Only profiles with a verbatim NASA quote are included (11 profiles). Quotes were machine-checked against text extracted from the downloaded PDFs/pages (whitespace, line breaks and hyphenation ignored); the `page` field is the PDF page index where the quote starts, not the printed page, except where noted.
  - `nominal` is null for profiles whose sources give only an upper bound (orion_cm_lunar_design_10p2, orion_cm_14p7_o2_limit, nasa_std_3001_crew_envelope). The contract `Range.nominal: float` must tolerate null for these, or the lead should exclude them from the target selector.
  - `o2_partial_pressure_kpa.nominal` is computed (O2 fraction x total pressure in psia x 6.894757); only the ISS min/max (146-178 mmHg, x 0.1333224 kPa/mmHg) come from a source.
  - Ventilation band 7.62-60.96 cm/s is 15-120 ft/min x 0.508 cm/s per ft/min. The NASA text bounds the time-averaged velocity in the crew-occupied space (HIDH: two-thirds of velocities within the band). It is far wider than the contract default [0.5, 20.3] cm/s; 20.3 cm/s (0.2 m/s, 40 ft/min) in HIDH is a separate limit on airflow near ventilator inlets, not the cabin band.
  - Shuttle nominal marked documented_nasa (not historical_nasa) because the lead's task text reserves historical_nasa for Skylab/Apollo; the profile is still a past-program condition.
  - Gateway, Artemis lander/HLS and surface-habitat profiles omitted: no NASA document retrieved states design numbers (see docs/research/atmosphere-profiles.md).
- D-013 (2026-11-15, research-ground-flammability): Ground flammability thresholds stored as normal-gravity context only. Source: `docs/decisions.d/research-ground-flammability.md` (kept; text below is copied from it).
  - Ground-based thresholds are stored under `data/curation/ground_flammability/`, one CSV per source document, labelled normal-gravity CONTEXT; never to be joined to microgravity training data.
  - Only table values were transcribed. Scanned docs (NTRS 20070005041, 20070018178, 20100015582) have OCR text layers with errors, so each value was verified against the rendered page image.
  - Three extra columns (`qualifier`, `pressure_basis`, `value_note`) were appended after the 13 requested ones; bounds such as `< 30` are stored as oxygen_percent=30 with qualifier `<`.
  - Pressure unit conversions (psia <-> kPa) are derived values and flagged in `pressure_basis`; printed units are kept as printed.
  - Derived MOP columns and normoxic/ISS reference rows were not transcribed.
  - 99.8 % O2 values printed as "MOP (psia)" in NTRS 20160001047 are recorded as `MTP` because NTRS 20100015582 prints identical values as MTP; flagged in `result_definition`.
  - Conflicting values across documents (Nomex HT90-40, Kydex 100) are kept as separate rows, not reconciled.
- D-014 (2026-11-15, research-other-microgravity-evidence): Other microgravity evidence: ranges, conflicts and quote checks. Source: `docs/decisions.d/research-other-microgravity-evidence.md` (kept; text below is copied from it).
  - Range fields hold only values a source states. Unit conversions are arithmetic only (1 atm = 101.325 kPa; 1 psia = 6.894757 kPa; rounded to 0.1 kPa for converted atm/psia ranges). Instrument capability (JAXA SCEM 0-45 % O2, 0-101.3 kPa, 0-25 cm/s) is not written into the tested-range fields; it is quoted in `conditions_quotes` and `data_availability`.
  - "Quiescent" SSCE tests are recorded as flow range [0, 0] because the sources state no imposed flow; Saffire flow ranges are [0, 20] because the sources state 20 cm/s, a reduction to 5 cm/s and fan-off periods.
  - SSCE STS-50 conflict (35 % O2 at 1.5 atm in NTRS 19930011017 vs 1.0 atm in the dedicated USML-1 paper NTRS 19950007798): the later, dedicated paper is used; the conflict is stated in `data_availability`. DARTFire test 1A conflict (no ignition in the 1997 table vs ignited then extinguished in the 2003 text) is stated, not resolved.
  - Saffire-VI dates conflict between NASA's article and the ICES slide; both are given, neither chosen.
  - Every quote was checked by script as an exact substring of the downloaded text (whitespace-normalised; for the Japanese FLARE paper, ignoring the spurious spaces PDF extraction inserts). The 6 quotes taken from web-fetch tool output (NASA SoFIE pages, ZARM page) are listed in the research note as unchecked against files.
  - Open-access abstracts of Elsevier papers were read from OpenAlex because publisher pages redirect; quotes cite the DOI.
  - The partial-gravity (Martian/Lunar) drop-tower entry is included for the NASA-STD-6001 correlation question but carries an O2 range of its Martian and Lunar columns only [14.1, 22.0]; its 0g columns repeat the Glenn 2008 entry. Partial gravity is labelled, never presented as microgravity.
  - The JSON keeps exactly the schema requested (no extra keys); caveats live in `data_availability`, `reason_not_integrated` and the research note.
  - No state-changing git commands were run and only the three owned files were written.
- D-015 (2026-11-15, research-publication-crosscheck): Publication cross-check points kept as reference data. Source: `docs/decisions.d/research-publication-crosscheck.md` (kept; text below is copied from it).
  - Publication points live in `data/curation/publication_points.csv` (reference only; not training data). Journal PDFs behind paywalls were not downloaded; the BASS-II Summary Report (NTRS 20210011385) reproduces the same PI papers and is cited with TM page numbers.
  - Appendix A of the Summary Report was parsed with pdfplumber. Only O2, configuration label, material and the observation clause were taken; per-step flow strings were not extracted because blank cells shift columns (the PSI-25 xlsx is the source for flows).
  - `matched_psi_test_label` is filled only when the label is printed (Appendix A, Table 5.1, Table 7.1 via GMT day + T number, O4) or marked "(inferred ...)" when matched by calibrated O2 and rod size.
  - "1 atm" printed in sources is converted to 101.325 kPa in `pressure_kpa` and noted in `raw_text`; the measured 99.2-99.5 kPa range (Bhattacharjee Fire Saf. J. comparison) is stored as the printed range string. No pressure is invented for rows that print none.
  - BASS Final Report (`PSI-26_Reports_BASS_FinalReport.pdf`) could not be downloaded (S3 NoSuchKey, also for the SPICE report); not used.
- D-016 (2026-11-15, research-space-apps): Space Apps 2026 "Flame in Freefall" treated as the target challenge. Source: `docs/decisions.d/research-space-apps.md` (kept; text below is copied from it).
  - 2026-11-15: Treated the 2026 challenge "Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data" as the target; the 2026 hackathon (Nov 14-15) is in progress and submission closes Nov 15 11:59 PM local time.
  - Did not query the Space Apps GraphQL API (permission denied); read the challenge body from the page's server-rendered payload via curl instead.
  - Documented the SI (AI) disclosure rule and no-NASA-branding rule as submission requirements for the product and demo.
  - Did not claim any 2027 call; none was found.
- D-017 (2026-11-15, scaffold-backend): Backend scaffold: build system, typing, CLI and error envelope. Source: `docs/decisions.d/scaffold-backend.md` (kept; text below is copied from it).
  - Build backend is hatchling (src layout); `requires-python = ">=3.12,<3.13"`; deps unpinned in pyproject, pinned by uv.lock.
  - mypy: `disallow_untyped_defs` applied to `blindspots.*` only; third-party stubs ignored for scipy, sklearn, openpyxl, docx. Pydantic mypy plugin enabled.
  - CLI exits 2 with `not implemented yet: blindspots.pipeline.<name>` only when that exact module is missing (a missing dependency inside an existing module still raises).
  - Health: `status` is "ok" only when both VERSION and LATEST files exist; otherwise "degraded" with null versions.
  - Error envelope handles ApiError (helper for routes), Starlette/FastAPI HTTPException (404->not_found, 422/400->validation_error, 503->artifact_missing, other 5xx->internal), RequestValidationError, and any other exception (500 internal, no internals leaked).
  - Extra Literal aliases beyond section 3 exist in schemas.py (FlowQualifier, AirflowBasis, ProfileStatus, InvestigationRole); ExperimentRecord/Observation keep material_family etc. as `str | None` per contract.
- D-018 (2026-11-15, scaffold-web): Web scaffold: framework versions, design tokens and API client behaviour. Source: `docs/decisions.d/scaffold-web.md` (kept; text below is copied from it).
  - Next 16.4.6 / React 19.3 / Tailwind 4.3 (CSS-first `@theme`, no tailwind.config). ESLint pinned to 9 (eslint-config-next 16 plugins target it); TypeScript pinned to ~5.9 (7.x native compiler not yet supported by Next's type check).
  - Geist fonts come from the `geist` npm package (next/font/local), not Google Fonts: no network at build.
  - Hue discipline: status chip uses dot shape, not colour; Callout "warning" uses the warn tint (red), "insufficient" uses the plum uncertainty scale; `--gap-fg` (#8A5200) added as an AA text colour for amber badges because `--gap` (#C97A06) alone fails AA as text.
  - Radii capped at 6 px via theme overrides so `rounded-xl` etc. cannot exceed the contract.
  - API client: no-envelope 5xx or network failure -> `backend_unavailable`; 404 -> `not_found`; 400/422 -> `validation_error`; other -> `internal`. Health is not retried (fast "unavailable"), polled every 30 s.
  - e2e builds with `ANALYSIS_API_ORIGIN=http://127.0.0.1:9` (closed port) so "API down" is deterministic; healthy/envelope cases use `page.route` fixtures (`fixture_health`) in tests only.
  - Playwright 1.65 needs chromium headless shell build 1255 (cached 1248 was stale); installed via `npx playwright install chromium` (headless shell only is used).
  - `lib/types.ts` field types for `/api/families`, `/api/health.artifacts` are provisional.
- D-019 (2026-11-15, lib-ingestion): Ingestion and processing: flow calibration, matrices, labels, training filter. Source: `docs/decisions.d/lib-ingestion.md` (kept; text below is copied from it).
  - Layout verified on the sheet: day blocks start at columns A (5 wide, with `U cm/s*`) and then every 4 columns from G; row 3 = date, row 4 = GMT `2014-<day>[-note]`. Each block has three vertical sections separated by `decr`/`Air`/`Fan V` rows. Column D of the first block labels them `no restrictor` (row 4), `1 restrictor` (row 14), `2 resrictor` (row 23); the section order 0/1/2 is applied to every block. A stray single `pot 0` row after the third section is merged into it.
  - Matrix "Flow restrictor" 0/1/2 = calibration "no/1/2 restrictor" sections. Evidence: for the 31 BASS-II tests with a parseable fan list and an equally long air list (fan >= 42, no zero air), the calibration section whose predicted air best matches the recorded air is section 1 for 13/13 tests with matrix restrictor 1 and section 2 for 13/18 tests with restrictor 2 (the rest are near ties or days without 2-restrictor data). Restrictor 0 could not be checked this way (no overlapping test): numbering for 0 is the same mapping but unverified.
  - Days 2014-212/213/216 only have air readings in the 1-restrictor section; the sheet's first block (`GMT 2014-043`, date cell 2014-04-01) disagrees between date and GMT: the GMT cell is used. Blocks with the same GMT day (188 a/b, 212 a.m./p.m.) are pooled in the public `tables[(gmt_day, n)]`; the lookup keeps per-year, per-day pooled points and averages duplicates at equal x.
  - A day needs >= 2 distinct non-zero air readings for a restrictor count to define a curve (e.g. day 216 has a single "max air only" reading and is not used).
  - Day choice: same (year, GMT day) if its curve reaches down to the requested value, else the nearest day (in days) whose curve does (flags `calibration_nearest_day`, `calibration_same_day_not_covering_value`, `calibration_day_gap_over_30_days`), else the day with the lowest calibrated non-zero point and the below-range rule. This refines CONTRACTS 2.4 ("same day else nearest") so that sparse blocks do not turn pot 1.4 into "half of the pot-2 flow".
  - Below range = value below the lowest calibrated non-zero point: U = 0.5 x 1.0066 x AIR_low, uncertainty = same value, flag `below_calibration_range`. Above the highest point: clamp, flag `above_calibration_range`. Fan `max` without value = fan display 122 (pot 10), flag `flow_max_taken_as_fan_display_122`.
  - BASS (PSI-26): fan/pot use BASS-II calibration with the day of year of the test date (nearest day of year), flags `calibration_borrowed_from_bass2`, observation confidence forced to `low`. `air display` values also use U = 1.0066 x AIR (flag `air_factor_from_bass2_note`); values the source states in cm/s (`stated_cm_s`) are not multiplied.
  - BASS-II tests dated 2016 (Olson O20-O22, T'ien T9/T18 in the data) are looked up with year 2016, so only calibration days of 2014 can be "nearest" (gap flag set).
  - BASS-II: `date_year_mismatch` when the date year differs from the year in the GMT column header (`GMT 2014-`); 5 tests are flagged (the "last 3 tests from 2016" in the Olson header plus T9/T18). Dates are kept as stored.
  - BASS: sheet `as run matrix`, header row 3. Duplicated as-run numbers get `<as run>/<Test no.>` for every member of the group (24/12-R, 24/12-R2, 85/117, 85/117a, 89/26, 89/87, 90/27, 90/103, 91/28, 91/104). Row 117 has date 2103-05-15 (implausible): `test_date = None`, flag `date_year_implausible`, campaign year taken from the text `GMT-13 135` (flag `campaign_year_from_gmt_text`).
  - Continuation rows (BASS): a non-test row directly below a test row whose only filled cell is the observation cell is appended to `notes_raw`. The sheet currently has none (the free text in column C of rows 130-134 is camera settings notes, not an observation, and is not attributed to a test; the SOOT/STOW/SETUP/dilution rows are not tests).
  - CO2 (BASS) % vol = mmHg / (P_atm x 760) x 100 with the test's own pressure (flag `co2_percent_from_mmhg_formula`); not computed when pressure is missing.
  - Pressure: BASS measured kPa kept with raw atm; BASS-II `total_pressure_kpa = None`, `pressure_assumed_kpa` = nominal of profile `iss_cabin_nominal` (id contains "iss" and "nominal") from `atmosphere_profiles.json` (101.353 kPa) with its source refs, flag `pressure_assumed`; without such a profile 101.325 + `pressure_assumption_unsourced`.
  - Training filter order: no label (reason from the label rule) > `provenance_mismatch` > `no_numeric_airflow` > `no_material_family` > `no_oxygen` (added: a model row needs O2) > `low_confidence`. Low-confidence rows are kept in records for sensitivity analyses. Observation confidence = the step's curated confidence (forced `low` for borrowed BASS calibration); the test-level confidence is only on the experiment (`extraction_confidence`, plus flag `test_confidence_low`) and does not exclude steps. Extinguished steps without a mode are excluded (`extinction_mode_missing`).
  - A test whose test-level provenance (label at the cited row) fails flags all its steps `provenance_mismatch`. Curation rows whose `source_row` differs from the matrix row get `curation_source_row_mismatch` + `provenance_mismatch`.
  - Experiment `included_in_training` = any of its observations included; `exclusion_reason` = most frequent observation reason (alphabetical ties), or `no_curation_record` / `no_curated_flow_steps`.
  - `possible_duplicate` is a flag only (same sample + date + identical O2/pressure/restrictor/material/config/flow range/step count); nothing is dropped. Duplicate `experiment_id` is a build error (exit 1).
  - Range checks only flag (`*_out_of_range`): O2 10-40 %, pressure 20-150 kPa, airflow 0-60 cm/s, CO2 0-5 %, CO 0-2000 ppm.
  - `saffire_tests.csv` columns are those written by data-saffire (investigation_id, test_label, sample, material_family, ..., oxygen_percent, total_pressure_kpa, outcome, notes); records are `derived_computation`, medium confidence, never training.
  - `atmosphere_profiles.json` is copied to `data/normalized/` verbatim (extra keys such as `total_pressure_psia` kept; the schema model ignores them for validation and the report lists them). Profiles that fail the Pydantic `Range` model (null nominal values) are reported in `dataset_report.json` under `atmosphere_profiles.errors`, not fixed.
  - Investigations: all 24 catalogue entries are exported (those without a snapshot have 0 experiments); license falls back to "not stated in PSI metadata".
  - `raw_files.json` skips `large/`, `inv_*.json`, `.DS_Store` and never lists the planned-test-matrix workbook. `psi_client` refuses to request that file name.
  - Environment note: on this Mac the editable-install `.pth` in `.venv` carries the macOS `hidden` flag so `import blindspots` fails after `uv sync`; `chflags nohidden .venv/lib/python3.12/site-packages/*.pth` fixes it (or run with `PYTHONPATH=src`).
- D-020 (2026-11-15, lib-ml-core): ML core: GP priors, gradients, baselines and missing coordinates. Source: `docs/decisions.d/lib-ml-core.md` (kept; text below is copied from it).
  - GP mean parameters (b0, b1) are learned by MAP-II like other hyperparameters, with N(0,3^2)/N(0,1^2) priors; all hyperparameter priors are Gaussian in log space (log-normal), no Jacobian term, so the MAP is in log space.
  - Analytic LML gradient derived for the non-zero mean (explicit a'dm plus implicit mode term); verified against finite differences. Sign of the third-derivative term follows dW/df = W(1-2pi).
  - `GPLaplaceClassifier.default()` gives the project defaults (l=(3,1,0.3), l_p fixed, signal var 4); the bare constructor fixes nothing unless `fixed` is passed.
  - Latent predictive variance clipped at 1e-12; Newton mode solved cold-start (deterministic) with backtracking line search; jitter 1e-8 on K.
  - MajorityClass predicts Laplace-smoothed prevalence ((n1+1)/(n+2)); one-class training data in the logistic baselines degrade to the same constant.
  - Training rows with a missing coordinate are dropped and counted (TrainingSet.n_dropped_missing_coords), never imputed.
  - Ensemble epistemic uncertainty from logistic baselines is not expected to grow far from data (logistic members extrapolate confidently).
- D-021 (2026-11-15, lib-acquisition-coverage): Acquisition and coverage: coordinates, hull, envelope, greedy batch, baselines. Source: `docs/decisions.d/lib-acquisition-coverage.md` (kept; text below is copied from it).
  - Analysis coordinates are (n,3) `[z_o2, z_flow, z_p]`; `coverage.to_coords(o2, p_kpa, u_cm_s)` converts raw values. Candidate raw arrays are `[o2, pressure_kpa, airflow_cm_s]`.
  - Target/EVR weights are always normalized to sum 1. EVR fraction = EVR / weighted current target latent variance.
  - `inside_hull`: Delaunay on varying dims; degenerate dims checked |delta|/s <= 1; collinear/degenerate hulls return False (conservative).
  - Demonstrated envelope = observed bounding box (degenerate dims padded by 1 scale) AND hull.
  - Greedy batch: Gaussian surrogate rank-1 downdates; F_c recomputed from the updated candidate variance with the latent mean unchanged (the older wbar form is superseded by the outcome-averaged F_c, see decisions.d/lead-review-fixes.md). Ties go to the lowest candidate index.
  - Baselines (`random`, `uncertainty_sampling`, `nearest_gap`) take k and report sequential marginal EVR via the same downdates; empty/ineligible sets return `{"status": "no_eligible_candidates"}`.
  - Explanation thresholds (documented defaults): sparse < 3 comparable; fold_spread threshold 0.15 (placeholder, not calibrated); outcome_variability aleatoric/total > 0.6 and ratio < 0.5.
  - Feasibility strings: within = "Inside conditions already run in the integrated investigations (not an engineering feasibility assessment)."; outside = "Feasibility not verified; requires qualified review."
- D-022 (2026-11-15, data-saffire): Saffire-I/III stored as context records. Source: `docs/decisions.d/data-saffire.md` (kept; text below is copied from it).
  - SAFFIRE-I/-III are stored as context records in `data/curation/saffire_tests.csv`, not as training data (different apparatus and scale).
  - O2 and total pressure come from the calibrated sensor workbooks (`Calibrated Data`), as the median over a radiometer-defined flame window. The "Telemetry Data" workbooks have no O2 channel and contain sentinel placeholder rows, so they are not used for values.
  - `oxygen_percent` holds the sensor median; the differing PSI-98 table value (21.5 to 21.7 / ~21.5) is kept in notes. Not reconciled.
  - `airflow_cm_s` holds the stated nominal value (20 / 30) with the readme quote; the anemometer medians (about 20 and about 25 cm/s) are in notes. SAFFIRE-III anemometers disagree with the stated 30 cm/s.
  - `total_pressure_kpa` uses the Saffire `Ambient Pressure` sensor; Cygnus PCM pressure is 2.4 to 3.1 kPa lower and is noted.
  - Sample length 940 mm, width 406 mm (PSI-98 table has the axes swapped; the paper, operations docs and PSI-100 table agree on 0.94 x 0.4 m). Thickness left out because units are inconsistent.
  - No spread rate recorded: no source read states one. Opposed tests: extent of spread not established.
  - Ignition power and time in the PSI-98 table are not transcribed (contract rule 4).
  - Raw downloads and the two experimental-table CSVs are in `data/raw/psi/<ID>/large/` (gitignored).
- D-023 (2026-11-15, transcribe-bass2_bhattacharjee_ferkul-A): Transcription rules for BASS-II Bhattacharjee/Ferkul (transcription A). Source: `docs/decisions.d/transcribe-bass2_bhattacharjee_ferkul-A.md` (kept; text below is copied from it).
  - Single-setting rows with no outcome token (B1-B5, B7, B12, F1-F3) get a test record but no step: the source does not state the flame state (ReadMe: outcomes only from tokens in Fan/Air cells).
  - F4 (candle, Air display "3 ign") gets no step: "ign" marks the ignition setting only; whether the flame persisted is not stated.
  - Ramp lists (B6, B8-B11, B13-B20, B22) use the control setting (pot or fan display) for every step, not Air display: the air reading lags ~1 min during ramps and the air list length often differs from the fan list. Air values are kept in step notes.
  - Final setting of a multi-setting list with no outcome token: sustained, confidence low, noted. Earlier settings: sustained, medium (a later setting was applied during the same burn).
  - B14 and B21 extinguished steps have flow_value null / flow_unit none: the source gives "ext" / "down to ext" without a numeric flow at extinction.
  - B18/B19 blowoff steps carry the pot value from "incr to 7.0" / "incr to pot 6.0" (blowoff at or before that setting); raw_token is "blowoff" from the Air display cell.
  - Bhattacharjee configuration is "opposed", medium, from the attached publication titles only (no sheet/ReadMe statement). Ferkul configuration is "unknown".
- D-024 (2026-11-15, adjudicate-bass1_2012a): Adjudication: BASS 2012 first chunk. Source: `docs/decisions.d/adjudicate-bass1_2012a.md` (kept; text below is copied from it).
  - Test 3: dropped B's extra "sustained at air 0" step (wake flame with air off but N2 still flowing is confounded); kept A's flow_turned_off extinction.
  - Test 22: omitted the fan-41 step (both A and B had it): obs does not show the flame state at 41, only "just before extinction". Single step at air 5.
  - Test 39 (PMMA slab): flame_configuration left unknown (A: stagnation, B: concurrent; text supports both).
  - Final settings with burn-time or flame description in the same row: confidence medium; only list-order-implied final settings (tests 2, 6, 7, 17 fan 41) are low.
  - Fan "off"/38 extinctions are recorded as flow 0 air_cm_s (rule 7), not 38.
  - Tests 4-14 and 27-32, 42: stagnation/wake configuration inferred from igniter label/series; flagged in configuration_evidence.
  - Test 37 uses obs-stated cm/s (5.75, 3, 1.5) for sustained steps; final extinction at fan 41.
- D-025 (2026-11-15, adjudicate-bass1_2012b): Adjudication: BASS 2012 rows 47-90. Source: `docs/decisions.d/adjudicate-bass1_2012b.md` (kept; text below is copied from it).
  - Final curation for BASS 2012 rows 47-90 (39 tests, 98 steps) from transcriptions A and B, checked against the source dump.
  - Rows 59 and 64 (igniter broke before any ignition): terminal_event test_aborted (not ignition_failed); not_ignited step kept at low confidence.
  - Row 78 (as-run 73): fan cell '0.31 (out)' kept as extinguished at pot 0.31 (quench_low_flow, medium); obs 'stepped to 0 flow, went out' is ambiguous (alternative: flow turned off).
  - Row 72 (as-run 72): 'Extinguished/burned out at 0.31' kept as low-confidence quench_low_flow.
  - Rows 82-83 (77, 78): concurrent inferred from upstream ignition point (same setup as 76, which says 'spread downstream'); row 84 (79) left unknown as no flame established.
  - Rows 89-90 (80, 81): 'PMMA 2 cm' taken as sphere (diameter 20) by inference from neighbouring sample numbers; UNVERIFIED, low confidence.
  - Steps with both air and fan values: one step, air_cm_s preferred when a definite number; other value in note.
  - Sustained tokens cite observation text where it states flame presence; flow value from Air display.
- D-026 (2026-11-15, adjudicate-bass1_2013): Adjudication: BASS 2013. Source: `docs/decisions.d/adjudicate-bass1_2013.md` (kept; text below is copied from it).
  - Labels: as-run nos 85, 89, 90, 91 repeat, so they carry "/<Test no.>" suffixes; 92 occurs once and is labelled "92" (transcription A wrongly wrote "92/105").
  - Row 102 (89/87): "Candle out at flow change" gives no flow value or direction, so no extinction step is emitted (transcription B had a null-flow quench step); terminal_event unknown.
  - Row 116 (103): fan cell is identical to row 115 (likely copied) and the burn lasted 75 s, so only the stated extinction at flow 0.4 is a step.
  - Row 105 (92): fan 41 / air <1 is treated as one physical step with the flame out (sooty, all blue at 18:38, out 18:40).
  - Row 113 (100): flame-out timing is ambiguous, so extinction is recorded at the last scheduled pot 0.32 as quench_low_flow; configuration unknown because the source says "'concurrent' or stagnation".
  - Row 111 (98): config "stagnation" taken from where the flame burned; ignition location not stated; confidence low.
  - Rows 128/129: sphere diameter not stated, left empty.
  - Rows 130-134 are camera notes in column C, not tests.
- D-027 (2026-11-15, adjudicate-bass2_bhattacharjee_ferkul): Adjudication: BASS-II Bhattacharjee/Ferkul. Source: `docs/decisions.d/adjudicate-bass2_bhattacharjee_ferkul.md` (kept; text below is copied from it).
  - Single-setting rows (B1-B5, B7, B12, F1-F3, F4) get a test record but no step: the cells give a setting but no flame-state token; frames-shot counts do not show a flame. Transcription B had created low-confidence "sustained" steps; rejected as unsupported.
  - Flow unit: air_cm_s where the air cell holds a definite number for the step; pot/fan_display where air is '<1', 'approaching 10', or the lists cannot be aligned (B10, B11, B13, B22).
  - B14 air '5,3,2, ext': steps air 5, 3, 2 sustained (2 low confidence), then extinguished with no numeric flow.
  - B18/B19 blowoff step uses the pot upper setting from the fan cell (blowoff at or before it).
  - Configuration opposed for all Bhattacharjee rows is inferred from the attached publication title only (test-to-paper mapping not verified); Ferkul unknown.
  - Material cells without "pmma" (B3-B5, B7, B12, B13) taken as PMMA film from the sheet/ReadMe.
- D-028 (2026-11-15, adjudicate-bass2_fernandez_pello): Adjudication: BASS-II Fernandez-Pello. Source: `docs/decisions.d/adjudicate-bass2_fernandez_pello.md` (kept; text below is copied from it).
  - Final listed setting with no stated outcome is not emitted as a step (source does not show the flame burned there); earlier settings followed by a later setting are `sustained` (medium).
  - Trailing `off` (P4, P6) has no stated flame outcome: no step, terminal_event unknown.
  - Cycling `etc` schedules (P18, P20, P23, P24) and single-setting rows (P21a/b): no steps, row confidence low.
  - Extinction at pot 0 (P5, P13a) and `0.32 ext after some time` (P22a) kept as quench_low_flow.
  - P2 step 2 (air 2, pot .35) kept as sustained because a later setting (.33) is listed.
- D-029 (2026-11-15, adjudicate-bass2_miller): Adjudication: BASS-II Miller. Source: `docs/decisions.d/adjudicate-bass2_miller.md` (kept; text below is copied from it).
  - Final settings with no outcome token are not emitted as steps (flame state not shown by source). Earlier settings are emitted as sustained, medium, "implied by list order". (A's approach; B emitted finals as low-confidence sustained.)
  - M5 width left empty: cell says "2 cm thick" next to "3 mm thick" (contradictory).
  - Flame configuration "opposed" for all rows is from Miller publication titles/ReadMe, not from cells.
  - Unit choice per test: air when it aligns 1:1 with settings, else pot/fan; M8 mixes air and pot.
- D-030 (2026-11-15, adjudicate-bass2_olson): Adjudication: BASS-II Olson. Source: `docs/decisions.d/adjudicate-bass2_olson.md` (kept; text below is copied from it).
  - Olson rods ignited upstream: flame_configuration=stagnation (ReadMe + Olson & Ferkul 2017 title). Black rods (O11, O14) kept as stagnation, row confidence medium (ReadMe says Olson rods "mostly clear").
  - Unit policy: where a full pot list exists for the steps (O5a, O18, O20, O21, O10, O13a, O15, O17) pots are used throughout (air display responds slowly, ~1 min, reads 0 at low fan, so is not shown steady in stepped runs). Air cm/s is used where only air is listed (O1, O3a/b, O14, O19) and for the leading "5" ignition flow of O4/O6-O9/O11 (inferred air 5 cm/s; Air cell of O4/O11 says "5").
  - Final listed setting with no outcome is never emitted as a step (O1, O2, O3a, O5a, O10, O13a, O15a/b, O17, O18, O20, O21). O5b, O16 have no steps.
  - O16 diameter is 9.525 (3/8"), not 6.35.
  - O6 "out .275" read as extinguished at pot .275 (medium); O8a "extinguished" after .31 read as quench at .31 (medium).
  - O22 "blowoff pot 5, out at fan 87": one blowoff event, recorded as pot 5; fan 87 equivalence inferred, in note.
  - O12: four not_ignited steps at pots 1.4,3,0.9,0.7 assumed to be attempted flows.
- D-031 (2026-11-15, adjudicate-bass2_tien): Adjudication: BASS-II T'ien. Source: `docs/decisions.d/adjudicate-bass2_tien.md` (kept; text below is copied from it).
  - T'ien cells contain no flame-outcome tokens. Steps emitted only for non-final settings in a multi-setting list (sustained, medium, implied by list order). Final settings and single-setting tests get no step (flame state not stated); all terminal_event = unknown.
  - Flow unit: air_cm_s throughout (definite numbers in every row), fan/pot noted in test notes.
  - SIBAL config concurrent (medium) per Zhao et al. 2017 title; T23/T24 (moved igniter / top side ign) unknown, low.
  - T3/T7 PMMA sphere from ReadMe; diameter 40 mm from "4 cm".
  - Date 2018 on T9/T18 flagged in notes only (GMT 175 = 2014).
- D-032 (2026-11-15, audit-bass1_2012b): Audit of BASS 2012 samples 24 and 25. Source: `docs/decisions.d/audit-bass1_2012b.md` (kept; text below is copied from it).
  Sample 24 verified as 2 cm PMMA sphere from other as-run rows (5, 9-11); sample 25 as 2 cm sphere (rows 37-39). Details in data/curation/audit/bass1_2012b.md.
- D-033 (2026-11-15, reconcile-bass2_bhattacharjee_ferkul): Reconciliation with TM-20210011385 Appendix A: Bhattacharjee/Ferkul. Source: `docs/decisions.d/reconcile-bass2_bhattacharjee_ferkul.md` (kept; text below is copied from it).
  - Appendix A labels adopted for flame_configuration (Bhattacharjee: opposed; F1-F3: concurrent). F4 (label Stagnation) held `unknown` because TM Sec. 3.1 calls the candle test opposed flow.
  - Steps gained evidence_source/evidence_page/evidence_quote; outcomes corrected or added where the TM text states them (full log: data/curation/audit/bass2_bhattacharjee_ferkul_tm.md).
  - B14: sustained steps contradicted by "only brief ignition" were deleted; step 0 became brief_flame_no_sustain.
  - Conservative choices: intermediate F4 potentiometer settings not added; B22 TM pots paired with workbook fan values by order (medium confidence).
- D-034 (2026-11-15, reconcile-bass2_fernandez_pello): Reconciliation with TM-20210011385 Appendix A: Fernandez-Pello. Source: `docs/decisions.d/reconcile-bass2_fernandez_pello.md` (kept; text below is copied from it).
  - Reconciled Fernandez-Pello tests/steps with NASA/TM-20210011385 Appendix A Table A.3 (pp.106-107). Full change log: data/curation/audit/bass2_fernandez_pello_tm.md.
  - flame_configuration: 25 tests adopt Appendix A "Opposed" (consistent with ReadMe). P16 and P19 are labelled "Concurrent" in the TM but conflict with the ReadMe and Link et al. (opposed-flow use), so set to "unknown" (conservative).
  - Steps: evidence columns added; P5 and P13a extinction mode corrected to flow_turned_off (TM: flow turned to 0); P1 extinction flow filled from TM (pot 0.315); final extinction steps added for P3a, P12, P14, P16, P17, P18, P19, P20, P23, P24, P21a; sustained step added for P2 (pot 0.33).
  - P14 unit "pot" is inferred (TM prints no unit), confidence medium.
- D-035 (2026-11-15, reconcile-bass2_miller): Reconciliation with TM-20210011385 Appendix A: Miller. Source: `docs/decisions.d/reconcile-bass2_miller.md` (kept; text below is copied from it).
  - Adopted Appendix A label (Opposed) for M1-M20; no conflicting source, so flame_configuration = opposed.
  - Added steps only where the TM text states an outcome at a named flow; mechanism "at_constant_flow" unless text says flow was turned down to extinguish (M8) or off (M1, M17).
  - M17 corrected: TM says fan pot turned to 0 to extinguish (was quench_low_flow at pot 0.3).
  - M4/M13 TM text identical and mismatched with workbook: unused. M6/M12 pot plateaus not added (likely duplicates of fan 42/41).
  - Full change log: data/curation/audit/bass2_miller_tm.md
- D-036 (2026-11-15, reconcile-bass2_olson): Reconciliation with TM-20210011385 Appendix A: Olson. Source: `docs/decisions.d/reconcile-bass2_olson.md` (kept; text below is copied from it).
  Olson tests/steps reconciled with NASA/TM-20210011385 Appendix A (Tables A.5). Appendix A "Stagnation" adopted; "Concurrent" and "?" labels set flame_configuration unknown (conflict with BASS-II ReadMe stagnation, conservative). Steps gained evidence_source/evidence_page/evidence_quote. Full change log: data/curation/audit/bass2_olson_tm.md.
  Judgement calls: O12 steps not_ignited -> brief_flame_no_sustain (TM: flame with igniter died on removal); O16 outcome assigned to its sole recorded setting; O17, O13b, O1, O3b, O6 left unchanged (ambiguous or no text).
- D-037 (2026-11-15, evidence-tm-appendix-a): TM-20210011385 Appendix A extraction and verification. Source: `docs/decisions.d/evidence-tm-appendix-a.md` (kept; text below is copied from it).
  - Source: NASA/TM-20210011385 (NTRS 20210011385), PDF https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf (the task URL ".../20210011385.pdf" returns 404). Appendix A = pdf pages 111-121 (printed 103-113); printed = pdf - 8.
  - Output: data/curation/evidence/bass2_tm_appendix_a.csv (126 rows: Bhattacharjee 22, Ferkul 4, Fernandez-Pello 27, Miller 20, Olson 24, T'ien 29).
  - Extraction: pdfplumber table geometry (header cell x-ranges for Test number, Sample distance, observation column; rows delimited by test-label cells), words assigned by cell centre. Not cell-index based, so blank cells do not shift columns. Wrapped lines joined with single spaces.
  - Line-break hyphens: "self- extinguished" (M2) and "CSA- CP" (T1) joined without space ("self-extinguished", "CSA-CP"); noted in extraction_note.
  - configuration_label is the verbatim "Sample distance" column. O1/O2 = "?". T1, T2, T4, T15 print the number "1" in that column (not a configuration word); consumers must not treat it as a flow configuration. The research note saying these were "not printed" is imprecise.
  - Verification: every observation_text is a substring of the whitespace-normalized text of the observation column of its pdf_page (126/126). Whole-page extract_text interleaves wrapped lines across columns, so only 43/126 match there; the column-crop check was used instead. Spot-checked against rendered images of pages 111, 117, 119, 120.
  - Labels: all 126 exist in PSI-25 sheets under the same names; PSI-25 O20-O22 are absent from Appendix A.
  - scripts/check_curation_provenance.py: steps rows with raw_column == "TM Appendix A observation" are checked as substring of observation_text in the evidence CSV (matched on test_label and source_sheet if it equals a pi_sheet, else any sheet). Other rows unchanged. Tested on a temporary CSV (pass, fail, missing label) and on bass1_2012a.csv (0 errors).
- D-038 (2026-11-15, evidence-integrate): Integration of context investigations and TM evidence into the build. Source: `docs/decisions.d/evidence-integrate.md` (kept; text below is copied from it).
  - Context investigations are one per NTRS document (`NTRS-<id>`); Saffire-IV/V share NTRS-20210011521, acronym lists the shorts. Drop-tower rows keep the CSV's long `investigation_short` as experiment-id prefix and campaign_group (spec rule), so ids contain spaces and two colons.
  - Context geometry: `slab` for slab/flat PMMA, `fabric_strip` for fabric, `flat_sheet` for film, else null. Material family `pmma_slab` only for PMMA that is slab/flat; Cotton Jersey, Mylar, structured PMMA are `other`. Thickness/sample dimensions are not parsed (kept in notes_raw via raw_text only).
  - observed_outcome words: burns, extinguished (from extinguishes/extinguished), ignition_failed (from "No Ignition"); spread-rate cells stay `unknown` (not an explicit outcome).
  - Config-change report diffs against `data/normalized/experiments.json` as it stood before the build (no git use).
  - Step CSV loader accepts the three optional evidence columns only at the end; any other header deviation is still reported.
- D-039 (2026-11-15, context-dartfire): Context records: DARTFire. Source: `docs/decisions.d/context-dartfire.md` (kept; text below is copied from it).
  - Wrote `data/curation/context_microgravity/dartfire.csv` (8 rows) from DARTFire Table 1, NTRS 20030111833 PDF p.45, checked against a 150 dpi render.
  - `total_pressure_kpa` = 101.325 (raw "1 atmosphere", from text p.5, not from the table); same for all rows. Flux (0/1/2 W/cm2) has no contract column, kept in `raw_text` only.
  - `specimen_geometry`=slab and `flame_configuration`=opposed from the paper's sample description and abstract.
  - 1A conflict (2003 text: ignited then extinguished; 1997 table: no ignition) stated, not resolved; the 2003 table cell is used.
  - Years taken from the abstract of NTRS 20050192123, not from the preprint itself.
  - Independent re-check of all 8 rows against a fresh download and 150 dpi render of PDF p.45: no value errors, CSV unchanged. Log: `data/curation/audit/context_dartfire_verify.md`.
- D-040 (2026-11-15, context-droptower_tm2008_215260): Context records: Glenn 5.18 s drop-tower limits. Source: `docs/decisions.d/context-droptower_tm2008_215260.md` (kept; text below is copied from it).
  - One CSV row per 0g limit cell (6 rows), not per fuel row, because each cell has its own O2 and outcome. 1g columns (WSTF, 1 g) excluded.
  - outcome_text uses the table column header words ("burns" / "extinguishes"); this describes the limit definition, not a per-run test.
  - flame_configuration = concurrent (p. 7 text); sample_dimensions from p. 6 apparatus text; years = report year 2008 (test dates unknown).
  - Kimwipes spread tests and Figure 4 not transcribed (figures only).
- D-041 (2026-11-15, context-saffire_iv_vi): Context records: Saffire-IV, V and VI. Source: `docs/decisions.d/context-saffire_iv_vi.md` (kept; text below is copied from it).
  - Source tables: ICES-2021-266 Table 1 (NTRS 20210011521, PDF p.3) for IV-1, IV-2, V-2, V-3, V-4; ICES-2024-365 Table 1 (NTRS 20240002981, PDF p.3) for VI-2, VI-3, VI-4. Saffire-IV is included because its per-sample conditions are printed in ICES-2021-266.
  - IV-1 and V-2 are printed in both papers with identical values; stored once (2021 source). 8 rows total.
  - Values taken as printed, checked against rendered page images. Pressure already in kPa; no conversions.
  - outcome_text only from verbatim sentences describing the sample; empty for IV-1. No flammability-limit claim made.
  - years: IV/V "2020-2021" (paper states May 2020 and January 2021 for the two flights; per-flight mapping not printed); VI left empty (not printed in pages read).
  - Samples not in a printed table (unignited IV samples, V-1, VI-1 Nomex) are not transcribed. Table 2 heat-release/CO/CO2 not transcribed (not in the context format).
  - Context only: not integrated into the model; large-scale Cygnus apparatus, single 20 cm/s flow.
- D-042 (2026-11-15, apply-profile-verdicts): Atmosphere profile verification verdicts applied. Source: `docs/decisions.d/apply-profile-verdicts.md` (kept; text below is copied from it).
  - Verdicts applied: 10 confirmed, 1 corrected, 0 unverifiable (no profile removed).
  - SAE 2009-01-2490 was not in the NTRS record for 20090012334; replaced by "JSC-17943; 09ICES-0267" (JSON and research doc).
  - orion_cm_14p7_o2_limit status changed nasa_design_recommendation -> historical_nasa (verifier judgement: a 2009 conference analysis, not a design recommendation).
  - shuttle_staged_pre_eva notes: flagged Hirsch 2007 (30 % O2 at 70.1 kPa) vs 26.5 % conflict; attributed the 30 %/10.2 psia certification to Orion, not Shuttle.
  - Ventilation 7.62-60.96 cm/s re-verified against HIDH Rev 1 p. 368, STD-3001 Vol. 2 Rev F p. 61 and the nasa.gov web page; unchanged. The doc's 20.3 cm/s inlet-limit remark was not re-checked.
- D-043 (2026-11-15, assemble-dataset): Dataset assembly check. Source: `docs/decisions.d/assemble-dataset.md` (kept; text below is copied from it).
  - No code or curation CSV changes were needed; checker 0 errors, pipeline 0 provenance failures, all 176 tests, ruff and mypy pass.
  - Real-GP acquisition test (tests/acquisition/test_integration_gp.py) runs and passes.
  - Environment: editable-install .pth in services/analysis/.venv is flagged hidden by macOS and ignored by Python; unhide it or use PYTHONPATH=src.
  - Summary: docs/research/dataset-summary.md.
- D-044 (2026-11-15, model-study): Model study: versioning, mean function, CIs, sensitivity and blind-spot test. Source: `docs/decisions.d/model-study.md` (kept; text below is copied from it).
  - MS-001: model_version = `gp-laplace-v1+<dataset_version[:8]>.<sha256(canonical TrainConfig json)[:6]>`; manifest holds a sha256 per group file (`group_hashes`) and no timestamps inside group files, so identical config + data give identical hashes. `trained_at` and timings live only in the manifest.
  - MS-002: Mean function per group (constant vs linear_o2) by repeated grouped-CV log loss; linear_o2 only if the group-bootstrap 95% CI of (linear - constant) log loss is entirely below 0. Why: with 16-24 experiments per group, preferring the simpler mean avoids overfitting a selection step.
  - MS-003: Headline CV metrics pool the out-of-fold predictions of all 5 repeats; CIs come from a group bootstrap over experiments (1000 draws, all repeats of a resampled experiment kept together). Majority-class AUC is fixed at 0.5 (constant predictor); pooling per-fold constants gave a spurious AUC < 0.5.
  - MS-004: Sensitivity variants are evaluated on their own row sets (same CV, same mean function); `delta_vs_primary` = variant minus primary log loss and is therefore not like-for-like when the row set changes (stated in each row's `note`). Extra keys: delta_brier, delta_auc, n_experiments, n_not_sustained, majority_log_loss. Pressure length scale 0.15 / 0.6 variants are included as sensitivity rows. Variants with < 3 experiments or one class are reported as not evaluated (null metrics).
  - MS-005: `error_distribution.bins` are the 11 bin edges of |y - p| (0..1, 10 bins), `counts` has 10 entries, pooled over repeats. `reliability.bins[].count` is also pooled over repeats (5x the row counts).
  - MS-006: Blind-spot test uses repeat-averaged OOF epistemic uncertainty and mean per-repeat log loss for the point level, and full leave-one-experiment-out refits (hyperparameters refit per experiment; fallback to fixed full-data hyperparameters only if the projected time exceeds the 480 s budget; not triggered in the shipped run). p-values are one-sided permutation p-values (2000 permutations, seeded); the smallest reportable p is 1/2001. Diagnostics added beyond the spec: Spearman of aleatoric uncertainty vs loss and a rank partial correlation of epistemic vs loss given aleatoric, because epistemic and aleatoric uncertainty are both large near p = 0.5 and the verdict alone could be read as more than it shows.
  - MS-007: The three sphere groups' only negatives are flow_off_transient steps (flow turned off), so their GP-vs-majority gain is mostly "flow near 0 means label 0". Reported as such in docs/validation.md (the earlier draft was deleted).
  - MS-008: `ArtifactMissing` (FileNotFoundError subclass) lives in `blindspots.models.registry`.
  - MS-009: validation.json carries `not_modelled` (group -> reason) and `acquisition_retrospective` (copied from models/retrospective/<dataset_version>.json when present at training time; the API should prefer `Registry.retrospective`, which `load_registry` reads fresh).
- D-045 (2026-11-15, acquisition-retrospective): Retrospective evaluation of target-aware acquisition. Source: `docs/decisions.d/acquisition-retrospective.md` (kept; text below is copied from it).
  - Design: per modelled group with >= 12 training experiments, held-out pseudo-targets (lowest mean-O2 quartile,
  lowest minimum-airflow quartile unless >50% overlap, largest campaign when >= 2 campaigns). Pool needs >= 6
  experiments. Seeds 0..19; initial = 3 pool experiments with both labels (<= 50 redraws; scenarios with no valid seed
  are skipped and listed). Up to 10 rounds picking one whole experiment. Metric: log loss and Brier on held-out
  target observations; the output also reports a constant (initial prevalence) baseline for context.
  - EVR for an experiment = uniform-weight joint block variance reduction of the target latent values from observing all
  its points (W from current predictions). Baselines: uncertainty_sampling (mean epistemic MI), nearest_gap
  (centroid distance among experiments whose mean nn distance to training > 1, fallback closest), random.
  - Hyperparameters: MAP-II on the current training set only, 3 restarts initially, then warm-started single-restart
  refits (l_p fixed 0.3). Chosen for runtime (whole run ~5 s with 20 seeds, 8 workers); targets never enter fitting.
  - Curve CIs: normal approximation mean +/- 1.96 se over seeds. Paired differences use per-seed area under the log-loss
  curve (trapezoid over n_acquired), percentile bootstrap (2000) over seeds. Seeds vary initial sets only, so CIs
  understate uncertainty about the world; scenarios in one group are not independent.
  - Output: models/retrospective/<dataset_version>.json (API.md acquisition_retrospective plus paired_differences,
  brier curves, diagnostics, design/limitations).
  - Caveat: unit tests for src/blindspots/cli.py fail in this sandbox with a pydantic import error unrelated to this task.
- D-046 (2026-11-15, api-data): API data endpoints. Source: `docs/decisions.d/api-data.md` (kept; text below is copied from it).
  - Coverage evidence for `/api/coverage` = the group's training observations with complete coordinates (o2, airflow, analysis pressure); `observations_in_slice` and `n_evidence_observations` refer to that set. Slice membership: |z_slice - z(slice value)| / scale <= 1 (z_p scale 0.1 for the o2_flow plane, z_flow scale 0.5 for o2_pressure).
  - Non-finite grid values (no evidence in the group) are returned as `null`.
  - Unknown `group` on list/coverage endpoints is a 404 `not_found`; dataset missing is 503 `artifact_missing` (data endpoints) while targets/context/sources/methodology/health stay up (degraded mode).
  - Model registry is read from `models/LATEST` -> `models/<v>/manifest.json` (as written by `models.registry.save_registry`); its per-group `model_status` overrides the modelability rule in `/api/groups`. `validation` artifact flag = `models/<v>/validation.json` exists.
  - `/api/experiments/{experiment_id:path}` accepts ids containing `/` (BASS labels such as `85/117`).
  - `/api/export/experiments.csv`: header = ExperimentRecord fields; list fields JSON-encoded, null as empty.
  - `/api/sources` publications = integrated investigations with a DOI (PSI dataset DOIs) plus unique papers cited in `data/curation/publication_points.csv`; no DOIs invented.
  - Added `coverage/grid.py` (nx/ny and axis ranges, slice membership) instead of editing `coverage/coverage.py`.
  - Resolved target models add `flags`, `profile_id`, `kind`, `airflow_band_note`; `airflow_band_source` also allows `ventilation_standard_with_near_quiescent_extension` (lead note 5).
- D-047 (2026-11-15, api-model): API model endpoints: targets, ranking, brief and snapshot. Source: `docs/decisions.d/api-model.md` (kept; text below is copied from it).
  - D-api-model-1: Model-backed endpoints live in `api/routes_model.py` with helpers in `api/services/`
  (targets, modeling, context, assess, ranking, brief). Responses are memoised by endpoint, canonical request and
  dataset/model versions; they are deterministic (the random baseline is seeded by a hash of the request).
  - D-api-model-2: Target airflow band: profile band if both bounds exist; else `[0.5, ventilation.max_cm_s]` with
  `airflow_band_source = ventilation_standard_with_near_quiescent_extension` (the extension below 7.62 cm/s is an
  analysis choice and is stated in `airflow_band_note`); else the default band flagged `default_band`. Custom
  targets with an airflow range report `airflow_band_source = "custom"` (added to the API enum).
  Null O2 nominal uses the documented max (flag `documented_upper_bound_used`); null pressure nominal uses the
  documented bound (flag `documented_bound_used`). Envelope profiles are context only (422).
  - D-api-model-3: Model-based quantities (hull, verdict, nn distance, candidate envelope) use the fitted model's own
  training coordinates, so they are consistent with the posterior even when the dataset was rebuilt after training
  (a version note is added to the assumptions list in that case). Target coverage (nearest observations, ids) uses the
  current normalized dataset.
  - D-api-model-4: Target verdict aggregates per-point verdicts: supported if >= 75 % of target points are supported;
  insufficient_evidence if >= 50 % are; otherwise extrapolation. A reason is reported when it applies to >= 50 % of
  points (value = that fraction).
  - D-api-model-5: Candidate grid = `acquisition.candidates` grid; the target pressure joins it only when no grid
  pressure lies within 1 kPa (otherwise greedy batches pick near-duplicate points). EVR fraction = standalone EVR
  over the current weighted target latent variance; `marginal_evr_fraction` is the greedy marginal gain.
  Reason thresholds: high_target_covariance = weighted mean |posterior correlation| >= 0.5;
  high_candidate_uncertainty = latent std ratio >= 0.85; near_decision_boundary = 0.3 <= P <= 0.7;
  fills_coverage_gap = nn distance > 1; assumption_dependent = EVR fraction spread across pressure length scales
  {0.15, 0.3, 0.6} > 50 % of its maximum.
  - D-api-model-6: Compare is `indistinguishable` when the relative EVR difference < 15 % or the preference flips under
  any pressure length-scale setting. Unmodelled groups: rank returns `model_unavailable`; compare, counterfactual
  return 422; predict returns null numbers with reason `no_model`; brief and assess still work (coverage only).
  - D-api-model-7: Snapshot: keys follow docs/API.md; counterfactual entries use plane `o2_flow` with slice = the
  profile's nominal pressure and plane `o2_pressure` with slice 10 cm/s, for each of the 3 ranked candidates (candidate
  values are the rounded numbers from the rank response). Brief entries are written for `candidate: <top candidate>`
  and `candidate: null`. Rank has aliases without `assumptions` / `k`. Coverage/surface grids are rounded to 4
  decimals (counterfactual grids to 3). Envelope profiles are listed under `skipped_profiles`.
  - D-api-model-8: The brief test denylist omits the bare word "procedure" because the mandated disclaimer contains
  "established safety procedures"; operational phrases ("ignite the", "step 1", "test procedure", ...) are denied.
- D-048 (2026-11-15, web-data-layer): Web data layer and snapshot keys. Source: `docs/decisions.d/web-data-layer.md` (kept; text below is copied from it).
  - All `api.*` functions (except `api.health`) resolve to `ApiResponse<T> = {data, meta: {source, generated_at?, model_version?}}`. `api.health` keeps returning the plain payload because `hooks/use-health.ts` (not owned by this task) predates it; `api.healthWithMeta` returns meta.
  - Missing snapshot entry: `ApiError` with `code: "backend_unavailable"` and `snapshotUnavailable: true` (`isSnapshotUnavailable(e)`), NOT a new `snapshot_unavailable` code, because `ERROR_COPY: Record<ApiErrorCode, ...>` in `components/ui/error-state.tsx` (not owned) would stop type-checking. To switch: add the code to `ApiErrorCode` and an `ERROR_COPY` entry ("Requires the live analysis service").
  - Snapshot keys: `"<METHOD> <path>"` + `?k=v&...` (GET, sorted, empty omitted) or `" " + canonical JSON` (POST). Lookups fall back to: default axes stripped / default slice or plane filled (coverage, surface), explicit vs omitted `k` and default assumptions (rank), integral floats `10` vs `10.0`, decoded vs encoded experiment ids. The exporter and `snapshotKey` should still agree exactly; `node scripts/check-snapshot-keys.mjs` verifies round-tripping.
  - In `auto` mode the manifest is only fetched once the snapshot is actually used; after a live failure live is skipped for 15 s.
  - `Range.nominal` is `number | null` (profiles may document only a bound).
  - Unit tests: `node --test tests/unit/` (Node 26 type stripping; tested modules have no runtime relative imports).
- D-049 (2026-11-15, web-map): Web parameter map. Source: `docs/decisions.d/web-map.md` (kept; text below is copied from it).
  - ParameterMap: canvas (hatch/wash rasters per grid, memoised) under SVG overlay. d3-zoom is applied incrementally to the view domain (so anisotropic zoom and controlled viewDomain work); wheel zoom needs Ctrl/Cmd (or pinch) so the page still scrolls; views narrower than 2% of the full extent are refused.
  - Prediction is drawn only where verdict != insufficient_evidence; contours are clipped to supported cells; extrapolation cells get a lighter wash. If hypotheticalSurface is given it replaces the p / std-ratio grids and the map says so.
  - Context envelopes with null bounds extend to the xDomain/yDomain edges; labels truncate to the rectangle width.
  - Props contract is exactly as specified; MapObservation and ViewDomain types are additionally exported.
- D-050 (2026-11-15, web-methodology): web methodology. Source: `docs/decisions.d/web-methodology.md` (kept; text below is copied from it).
  - The page reads only existing hooks (methodology, validation, model metadata, sources, context, groups); no new hooks were needed. Validation fields beyond docs/API.md (gp_vs_majority, sensitivity n_not_sustained, paired_differences, not_modelled, majority_class_baseline) are typed as optional in `components/methodology/types.ts` and shown only when present.
  - Default validation group: `pmma_rod__stagnation` if it is validated and modelled, else the modelled group with the most training rows; the user can switch group.
  - Static prose describes implemented behaviour only (GP/Laplace, EVR formula, verdict thresholds 3 / 0.6 / 0.85, 75 % / 50 % target aggregation, 15 % compare tolerance). These thresholds are code constants, not API fields, and are labelled as implementation constants.
  - Small-sample callout fires when a group has fewer than 30 experiments or fewer than 20 not-sustained observations (UI constant). The "flow-turned-off" callout is data-driven from the sensitivity row.
  - Charts are dependency-free SVG in `components/charts/` and use design tokens only; the EVR curve is teal (research candidate), uncertainty sampling plum, the other baselines are ink/muted with distinct dashes.
- D-051 (2026-11-15, docs): docs. Source: `docs/decisions.d/docs.md` (kept; text below is copied from it).
  - Documentation numbers (validation.md, evidence-report.md, and every count or metric in README.md, data-sources.md, scientific-methodology.md, limitations.md, architecture.md, demo-script.md) are produced by a script from the
  generated artifacts (`data/normalized/*`, `models/<LATEST>/{manifest,validation}.json`, `models/retrospective/<dataset_version>.json`, snapshot manifest) instead of being typed by hand. The generator and its templates live in `docs/_gen/`
  so the docs can be regenerated after the lead's final dataset rebuild and retrain (command in `docs/_gen/build.py`). Hand-written commentary that depends on specific groups (the "Qualitative reading" block in evidence-report.md and the demo narration)
  is marked with the dataset version it was written for and must be re-read after a retrain.
  - The lead's task notes describe an earlier dataset (e55c2c98d9f8: 254 experiments, 684 observations, 481 training rows, 6 modelled groups). The artifacts at the time of writing are dataset 8783ff5aa6a2 (276 experiments, 749 observations,
  566 training rows, 9 modelled groups, after the TM-20210011385 Appendix A evidence and context records were integrated). The docs follow the artifacts.
  - `docs/validation-draft.md` (generated from an older dataset, da32b5c9ca7c) was superseded by `docs/validation.md` and deleted in the docs-refresh pass.
  - Docs refresh (2026-11-15): every number in README.md and docs/*.md is generated from the artifacts by `docs/_gen/build.py`; the default group is read with the `/api/groups` `is_default` rule (`pmma_thin_film__opposed` at dataset 8783ff5aa6a2); guided-demo numbers in `docs/_gen/extra.json` were re-read from the running app; computed caveat fragments were added (flow-off AUC before/after, below-calibration reliance, groups where the GP beats the majority class, pressure reversion, constant mean); README gained the Appendix A and context-record descriptions, a "<to be added>" deployed-URL placeholder and the AI-assistance disclosure; snapshot size is no longer stated. The GP is not claimed to beat the majority class for stagnation rods (paired CI includes 0).
  - Verification of commands: build-dataset, train, retrospective and export-artifacts were run against a scratch copy of the inputs (BLINDSPOTS_ROOT) so the repository artifacts were not overwritten; the rebuilt dataset, model and retrospective JSON matched the
  committed ones exactly (ignoring timestamps and runtimes). The API (uvicorn, port 8107) and the web app (Next dev, port 3207, `NEXT_DIST_DIR=.next-docs`) were started, exercised headlessly and stopped. `npm ci` was deliberately not run in the shared tree because it would delete `node_modules`.
  - The excluded planned-test-matrix workbook is described without naming the file (CONTRACTS section 0, rule 7).
  - Deployment claims are limited to what was run: no Vercel deployment, container build or Dockerfile exists, and the docs say so.
- D-052 (2026-11-15, web-story): web story. Source: `docs/decisions.d/web-story.md` (kept; text below is copied from it).
  - Demo scene 2 target = documented non-envelope profile with the fewest comparable observations for the current group (assessed live via /api/target/assess; first profile as fallback while loading).
  - Demo scene 3 caption adapts to the API verdict (supported / extrapolation / insufficient_evidence); gaps are phrased "not represented in the integrated records" and name not-integrated investigations (first two + count).
  - Brief page renders the API `sections` with a small text-only Markdown renderer (no HTML); "min None"/"max None" from the API is displayed as "not given".
  - Brief link: /brief?group=&target=&candidate=<o2>,<airflow>,<pressure>.
