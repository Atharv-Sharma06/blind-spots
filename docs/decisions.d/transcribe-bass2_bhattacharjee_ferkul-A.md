# transcribe-bass2_bhattacharjee_ferkul-A decisions

- Single-setting rows with no outcome token (B1-B5, B7, B12, F1-F3) get a test record but no step: the source does not state the flame state (ReadMe: outcomes only from tokens in Fan/Air cells).
- F4 (candle, Air display "3 ign") gets no step: "ign" marks the ignition setting only; whether the flame persisted is not stated.
- Ramp lists (B6, B8-B11, B13-B20, B22) use the control setting (pot or fan display) for every step, not Air display: the air reading lags ~1 min during ramps and the air list length often differs from the fan list. Air values are kept in step notes.
- Final setting of a multi-setting list with no outcome token: sustained, confidence low, noted. Earlier settings: sustained, medium (a later setting was applied during the same burn).
- B14 and B21 extinguished steps have flow_value null / flow_unit none: the source gives "ext" / "down to ext" without a numeric flow at extinction.
- B18/B19 blowoff steps carry the pot value from "incr to 7.0" / "incr to pot 6.0" (blowoff at or before that setting); raw_token is "blowoff" from the Air display cell.
- Bhattacharjee configuration is "opposed", medium, from the attached publication titles only (no sheet/ReadMe statement). Ferkul configuration is "unknown".
