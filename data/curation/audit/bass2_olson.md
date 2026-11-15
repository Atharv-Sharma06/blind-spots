# Audit: bass2_olson (PSI-25 sheet Olson)

All 27 test rows (rows 2-28, O1..O22) checked against the source dump: test set complete, no duplicates, source_row correct, rod diameters (1/4"=6.35, 3/8"=9.525, 1/2"=12.7) and clear/black colour match the Material cells, no step attached to a wrong row/cell, no parallel fan/air duplication found.

## Changes (9 steps, confidence only; no flame_state/flow changes)
- O6, O7, O8a, O8b, O9 step 0 (flow 5, air_cm_s, raw_token '5' in the Fan display cell): confidence medium -> low. Reason: the Air cell is 'see fan' or empty; reading the leading 5 as air cm/s is inferred from O4 (Air '5, down to ext') and O11 ('ign 5' / Air '5'). Not a pot: O9 'blowoff pt 4.0' would conflict with ignition at pot 5.
- O12 steps 0-3 (pots 1.4, 3, 0.9, 0.7, not_ignited, token 'no ign at any flow'): medium -> low. Reason: the pots come from the Fan cell 'pots 1.4, 3, 0.9, 0.7' and are only assumed to be the attempted flows.

## Residual concerns
- O8a: '.31, extinguished' coded as extinguished at pot .31 (quench_low_flow). It may instead be sustained at .31 and out at an unlisted lower flow (O8b sustained at .31).
- Parallel air cells with definite numbers (O5a 5,10,5,2; O13a; O15a; O17; O18) were coded in pot per the fan list, not air_cm_s (rule 6); air response is ~1 min so steadiness is unknown.
- Last listed settings with no outcome are omitted (conservative); many tests therefore have terminal_event unknown (O1-O3b, O5-O5b, O10, O13-O13b, O15-O18, O20, O21).
- O11 and O14 are black rods on Olson's sheet (ReadMe: Olson mostly clear); config kept as stagnation by sheet attribution only.
- O22 'blowoff pot 5, out at fan 87' treated as one event (pot 5 = fan 87 inferred).
- O6 'out .275' read as out at .275 (alt: after .305).
