# Audit: bass2_bhattacharjee_ferkul

Scope: all 22 Bhattacharjee (rows 2-23) and 4 Ferkul (rows 2-5) tests and 50 steps, checked cell by cell against the source dumps.

Changes made: 0. Checker: 26 test rows / 50 step rows, 0 provenance errors.

Verified with no error found: test coverage (26/26, no duplicates, source_row correct); material_family/geometry; thickness and width for every row (e.g. B10 "1 cm, 0.2 mm pmma film" -> 0.2 / 10; B14 "1 cm wide 200 micron thick pmma" -> 0.2 / 10); B2 O2 anomaly (final 1.6); terminal events (B14 "5,3,2, ext", B21 "5 down to ext" low-flow extinction; B18/B19 "10, blowoff" blowoff); no duplicate steps from parallel fan/air lists (one step per physical step; mixed pot/air choice follows rule 6); parenthesised fan values (52, 59, 68, 50, 48, 47) not counted as steps; B10/B11/B13/B22 use one unit throughout because list lengths differ.

Residual concerns
- B14 'ext' after "5,3,2": ext may refer to a flow at/after air 2; the air-2 step is low confidence and the ext step has no flow (flow_unit none).
- B18/B19 blowoff step uses the "incr to 7.0 / 6.0" pot value from the fan cell while raw_token 'blowoff' is in the air cell; actual blowoff flow is not recorded (at or before that setting). Air "10" at the start is likely the initial pot 1.02/1.05 reading at restrictor 0 (not a separate step; not emitted).
- Single-setting tests (B1-B5, B7, B12, F1-F3) and F4 ("3 ign", fan "see notes") have no step: no outcome token; flame persistence is not source-supported.
- Last steps of B6, B8-B11, B13, B15-B17, B20, B22 are sustained only by list order (low confidence); outcome after them is unstated.
- Opposed configuration for Bhattacharjee is inferred from the publication title, not the sheet; Ferkul configuration unknown.
- Mixed pot/air units within a test (B6, B9, B16, B17, B20) depend on pot calibration for the restrictor/day.
