# Data fixes after the data audit (2026-11-15, data team)

- a10-01: Calibration sections of one day that agree at every shared pot setting (>= 3 non-zero air readings)
  are treated as suspected copies and both skipped (`suspect_duplicate_sections` in
  `processing/flow_calibration.py`); the conversion falls back to the nearest valid day and carries
  `calibration_block_suspect_duplicate` when the skip changed the chosen day. Only 2014-210 (no restrictor =
  2 restrictor: 20, 15, 10, 7, 3, 0) is affected. Effect: O20#s1-s3 12.6/15.1/17.6 -> 34.4/38.7/43.0 cm/s,
  O21#s1 12.6 -> 34.4, O22#s1 (blowoff) 8.6 -> 25.7 cm/s (row's own air display later reached 26.5),
  PSI-26:66#s1 3.3 -> 4.3 cm/s (2014-209).
- a10-02: CONTRACTS 2.2 air-reading precedence applied to 21 steps (O5a s0-s3, O10 s0-s1, O13a s0-s1, O15a s0,
  O15b s0, O18 s0, s1, s3-s6, O20 s0, O22 s0, B8 s0, B15 s0, B22 s0). Pairing rule recorded in CONTRACTS 2.2.
  Zero, "<1", "?", range and "incr to" readings were left as pot/fan conversions. Not changed (pairing not
  1:1 or uncertain): O17, B10, B11, B13, Miller first settings, BASS (PSI-26) "pot 0.53 / air 2" rows.
- a10-03: per NASA/TM-20210011385 Appendix A p.110: O17#s5 (fan 72 / pot 4.0) extinguished, blowoff_high_flow,
  high, test terminal_event blowoff; O18#s3 and #s5 (pot 4.0, air 11) extinguished, blowoff_high_flow, medium
  ("stag region blew out"; the flame restabilized after the first one); O18#s6 confidence low ("after 1.5 would
  not restabilize"), so it leaves training.
- Net effect (temp build 87c7fde80354 vs 8783ff5aa6a2): training 566 -> 565 rows, sustained 447 -> 443,
  not sustained 119 -> 122; pmma_rod__stagnation 67 -> 66 (51/16 -> 48/18); pmma_rod__unknown 52 (46/6 -> 45/7).
- D8: profile `artemis_surface_habitat_10p2_26p5` added from NTRS 20220000245 PDF p. 4 (quote checked against
  the downloaded PDF; page rendered): "SH is assumed to operate at a nominal atmospheric operating pressure of
  10.2 psia and 26.5% oxygen concentration and a capability of operating at 8.2 psia and 34% oxygen". Status
  `nasa_design_recommendation` because the source calls it an assumption under ongoing trade analyses.
- Open: a10-04 (below-calibration rule wording and the parser dropping 2014-202 pot 0.5 -> air 3), a10-07 and
  a13-13 were not done within the time box.

## a10-04 closed (2026-11-15, integrate-data)
- Parser (`flow_calibration.py`): a row counts when Pot is numeric and Fan Display or Air Display is numeric;
  rows with an empty Fan Display keep their Air reading for pot conversions only. Recovers 2014-202,
  2 restrictors, cells CA32/CC32: pot 0.5 -> air 3 (pinned in `tests/processing/test_flow_calibration.py`).
  Pot-only rows with no readings (2014-195 and 2014-196 row 32) are still skipped.
- Below-calibration rule: the code's rule is kept and CONTRACTS 2.4 now states it exactly (linear interpolation
  from the fan-off row pot 0 / fan display 38 -> air 0 to the chosen day's lowest calibrated non-zero point;
  flags `below_calibration_range` + `flow_interpolated_to_fan_off`; uncertainty max(0.5 cm/s, U_low / 2)).
  The old "extrapolation through the two lowest points / `flow_extrapolated_linear`" wording is withdrawn.
  Caveats recorded in 2.4: the fan-off point is an assumption the sheet's note advises against, and the
  pot-0.5 reading varies 0.5-3.75 air between days, which the uncertainty band does not cover.
- Effect (temp build 4fe55f76142a in .work/data-build2 vs old-parser build e600ad4a8386 from the same tree):
  39 training rows (P12, P16-P20, P23, P24, O5a, O10, O13a, O15a, O15b, O17) move from 2014-190 to 2014-202;
  every one changes airflow by > 25 % (about 2x to 6x, e.g. O15b#s10 0.27 -> 1.63 cm/s, P24#s0 0.30 -> 1.81);
  their below-range uncertainty rises 0.5 -> 1.51 cm/s. No label, inclusion or group-count change: training
  565 rows / 443 sustained, same as the old-parser build. Model artifacts were not retrained.
