# bass2_olson reconciliation against NASA/TM-20210011385 Appendix A

Rules: Appendix A label adopted for Stagnation; Concurrent labels conflict with the BASS-II ReadMe (Olson rods: stagnation) and "?" labels, so flame_configuration is unknown. Steps confirmed only where the text states flame state at that setting. Left unchanged because text is ambiguous or absent: O1, O3b, O5b steps, O6, O13b, O17, O20-O22 (no Appendix A entry).

| test_label | field | change | quote |
|---|---|---|---|
| O1 | flame_configuration | stagnation -> unknown (TM label '?') |  |
| O2 | flame_configuration | stagnation -> unknown (TM label '?') |  |
| O3a | flame_configuration | stagnation -> unknown (TM label 'Concurrent') |  |
| O3b | flame_configuration | stagnation -> unknown (TM label 'Concurrent') |  |
| O4 | flame_configuration | stagnation -> stagnation (TM label 'Stagnation') |  |
| O5a | flame_configuration | stagnation -> unknown (TM label 'Concurrent') |  |
| O5b | flame_configuration | stagnation -> unknown (TM label 'Concurrent') |  |
| O6 | flame_configuration | stagnation -> stagnation (TM label 'Stagnation') |  |
| O7 | flame_configuration | stagnation -> stagnation (TM label 'Stagnation') |  |
| O8a | flame_configuration | stagnation -> stagnation (TM label 'Stagnation') |  |
| O8b | flame_configuration | stagnation -> stagnation (TM label 'Stagnation') |  |
| O9 | flame_configuration | stagnation -> stagnation (TM label 'Stagnation') |  |
| O10 | flame_configuration | stagnation -> unknown (TM label 'Concurrent') |  |
| O11 | flame_configuration | stagnation -> stagnation (TM label 'Stagnation') |  |
| O12 | flame_configuration | stagnation -> stagnation (TM label 'Stagnation') |  |
| O13a | flame_configuration | stagnation -> unknown (TM label 'Concurrent') |  |
| O13b | flame_configuration | stagnation -> unknown (TM label 'Concurrent') |  |
| O14 | flame_configuration | stagnation -> unknown (TM label 'Concurrent') |  |
| O15a | flame_configuration | stagnation -> stagnation (TM label 'Stagnation') |  |
| O15b | flame_configuration | stagnation -> stagnation (TM label 'Stagnation') |  |
| O16 | flame_configuration | stagnation -> stagnation (TM label 'Stagnation') |  |
| O17 | flame_configuration | stagnation -> unknown (TM label 'Concurrent') |  |
| O18 | flame_configuration | stagnation -> stagnation (TM label 'Stagnation') |  |
| O19 | flame_configuration | stagnation -> unknown (TM label 'Concurrent') |  |
| O20 | flame_configuration | stagnation (unchanged; no Appendix A entry for this test) |  |
| O21 | flame_configuration | stagnation (unchanged; no Appendix A entry for this test) |  |
| O22 | flame_configuration | stagnation (unchanged; no Appendix A entry for this test) |  |
| O2 | ADDED step (2 air_cm_s sustained ) | (none) -> new step | "Ignited at 2 cm/s, and got dim flame" |
| O2 | ADDED step (1.5 pot sustained ) | (none) -> new step | "reduced flow to 1.5 pot and got less vapor jetting test; still sooty" |
| O3a | step 0 (5 air_cm_s) confidence/evidence | medium -> high; evidence added | "flame sooty at 5 cm/s" |
| O3a | terminal_event | unknown -> extinguished_low_flow | "Flame extinguished as soon as he turned flow down" |
| O4 | step 4 (0.36 pot) confidence/evidence | high -> high; evidence added | "extinguished at 0.36" |
| O5a | ADDED step (4.0 pot extinguished blowoff_high_flow) | (none) -> new step | "blew out with pot of 4.0, tried to stay lit but blew off" |
| O5a | terminal_event | unknown -> blowoff | "blew out with pot of 4.0, tried to stay lit but blew off" |
| O5b | terminal_event | unknown -> ignition_failed | "Would not sustain a flame without igniter on" |
| O7 | step 4 (10 pot) confidence/evidence | high -> high; evidence added | "Blowoff fan 97" |
| O8a | step 3 (0.31 pot) confidence/evidence | medium -> high; evidence added | "Quench at pot 0.31" |
| O8b | step 4 (6 pot) confidence/evidence | high -> high; evidence added | "Blowoff fan 78" |
| O9 | step 3 (4 pot) confidence/evidence | high -> high; evidence added | "Blowoff fan 68" |
| O11 | step 5 (6 pot) confidence/evidence | high -> high; evidence added | "blowoff at pot of 6.0" |
| O10 | ADDED step (no value none extinguished blowoff_high_flow) | (none) -> new step | "25 s for rest of flame to blowoff at maximum flow" |
| O10 | terminal_event | unknown -> blowoff | "25 s for rest of flame to blowoff at maximum flow" |
| O12 | step 0 flame_state | not_ignited -> brief_flame_no_sustain (confidence low -> medium) | "flame with igniter but died immediately upon igniter removal" |
| O12 | step 1 flame_state | not_ignited -> brief_flame_no_sustain (confidence low -> medium) | "flame with igniter but died immediately upon igniter removal" |
| O12 | step 2 flame_state | not_ignited -> brief_flame_no_sustain (confidence low -> medium) | "flame with igniter but died immediately upon igniter removal" |
| O12 | step 3 flame_state | not_ignited -> brief_flame_no_sustain (confidence low -> medium) | "flame with igniter but died immediately upon igniter removal" |
| O12 | terminal_event | ignition_failed -> brief_flame_only | "flame with igniter but died immediately upon igniter removal" |
| O13a | ADDED step (0.31 pot extinguished at_constant_flow) | (none) -> new step | "flame self-extinguished after 3+ min at pot 0.31" |
| O13a | terminal_event | unknown -> self_extinguished | "flame self-extinguished after 3+ min at pot 0.31" |
| O14 | step 0 (5 air_cm_s) confidence/evidence | medium -> high; evidence added | "Ignition at 5 cm/s" |
| O14 | step 1 extinction flow | (empty) -> 0.28 pot; raw_token 'down to ext' -> 'quenching pot 0.28' (raw_column TM Appendix A observation) | "quenching pot 0.28" |
| O19 | step 0 (5 air_cm_s) confidence/evidence | medium -> high; evidence added | "Ignition at 5 cm/s" |
| O19 | step 1 extinction flow | (empty) -> 0.288 pot; raw_token 'down to ext' -> 'quenching pot 0.288' (raw_column TM Appendix A observation) | "quenching pot 0.288" |
| O15a | step 1 (1 pot) confidence/evidence | medium -> high; evidence added | "2.5 min pot 1.0" |
| O15a | step 2 (0.5 pot) confidence/evidence | medium -> high; evidence added | "3.5 min at 0.5" |
| O15a | step 3 (0.35 pot) confidence/evidence | medium -> high; evidence added | "3.5 min 0.35" |
| O15a | ADDED step (0.32 pot extinguished quench_low_flow) | (none) -> new step | "extinction at 0.32 pot" |
| O15a | terminal_event | unknown -> extinguished_low_flow | "Decrease flow to extinction at 0.32 pot" |
| O15b | step 1 (0.5 pot) confidence/evidence | medium -> high; evidence added | "3.5 min pot 0.5" |
| O15b | step 2 (0.35 pot) confidence/evidence | medium -> high; evidence added | "5 min 0.35" |
| O15b | step 3 (0.34 pot) confidence/evidence | medium -> high; evidence added | "4 min 0.34" |
| O15b | step 4 (0.33 pot) confidence/evidence | medium -> high; evidence added | "4 min 0.33" |
| O15b | step 5 (0.32 pot) confidence/evidence | medium -> high; evidence added | "3 min 0.32" |
| O15b | step 6 (0.31 pot) confidence/evidence | medium -> high; evidence added | "1 min 0.31" |
| O15b | step 7 (0.3 pot) confidence/evidence | medium -> high; evidence added | "1 min 0.3" |
| O15b | step 8 (0.29 pot) confidence/evidence | medium -> high; evidence added | "1 min 0.29" |
| O15b | step 9 (0.28 pot) confidence/evidence | medium -> high; evidence added | "1.5 min 0.28" |
| O15b | ADDED step (0.27 pot extinguished quench_low_flow) | (none) -> new step | "0.27 out" |
| O15b | terminal_event | unknown -> extinguished_low_flow | "decreased flow to extinction at 0.27 pot" |
| O16 | ADDED step (5 air_cm_s brief_flame_no_sustain ) | (none) -> new step | "Brief flame at end of first ignition, but no joy on sustained flame" |
| O16 | terminal_event | unknown -> brief_flame_only | "Brief flame at end of first ignition" |
| O18 | ADDED step (1.0 pot extinguished at_constant_flow) | (none) -> new step | "flame extinguished after multiple oscillations at pot 1.0" |
| O18 | terminal_event | unknown -> self_extinguished | "flame extinguished after multiple oscillations at pot 1.0" |
