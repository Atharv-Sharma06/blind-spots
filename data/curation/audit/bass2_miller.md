# Audit: bass2_miller (PSI-25 sheet Miller, rows 2-21)

Result: 0 changes. Every test row and all 79 step rows were re-checked against the source dump.
Checker: 20 tests rows, 79 steps rows, 0 provenance errors.

## Checked
- 20 tests present (M1-M20 = rows 2-21), no duplicates or missing labels.
- Material parsing: thickness (1-5 mm), widths (2 cm = 20, 1 cm = 10), sides (M1, M2, M3, M14, M15 one; M5 two; others blank as not stated), family pmma_slab / geometry slab.
- Flow units: small decimals in Fan display (M3, M8, M17, M18) are pot; fan 41-105 are fan_display; Air display values are air_cm_s. No step double counts a fan/air pair; no duplicated steps from parallel lists.
- Only outcome token in the sheet: "0.3ext" / "0ext" (M17), emitted once as extinguished / quench_low_flow, terminal_event extinguished_low_flow. All other tests have no outcome token, so terminal_event unknown and final settings are not emitted (consistent with rule 3 and 9).
- Configuration evidence: the quoted inv_PSI-25.json publication title exists in the JSON (verified by grep). ReadMe does not say "opposed" for Miller; `opposed` rests on that title (confidence medium).

## Residual concerns
- M3: pot 3.0, 3.1, 3.2 are probably small adjustments at one physical setting (air 10); kept as three literal pot steps.
- M16 step 5 (fan 43, pot 0.5): sustained is only implied by flow being raised to 75 afterwards; kept at low confidence. The flame may have been out before the increase.
- M18 "15 (brief)": read as a brief flow excursion; flame state implied.
- M5: "2 cm thick" most likely means width but is left blank (contradicts 3 mm thickness).
- M6, M12: fan 41-43 is near fan-off (38) and below calibration range.
- M8: "5>7" and "decr" cannot be mapped to definite values; pot used.
- Mixed units within a test (M8) are intentional (rule 6).
