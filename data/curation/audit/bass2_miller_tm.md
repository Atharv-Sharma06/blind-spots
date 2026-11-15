# BASS-II Miller reconciliation with NASA/TM-20210011385 Appendix A (Table A.4)

All 20 Miller tests labelled Opposed in Appendix A; no conflict with PSI-25 ReadMe or the publication title, so flame_configuration = opposed for M1-M20. Evidence texts: data/curation/evidence/bass2_tm_appendix_a.csv.

Caveat: TM text for M4 and M13 is identical and does not match either workbook row; unused. M6/M12 pot plateaus not added (probably the same physical steps as fan 42/41).

| test | field | old -> new | quote |
|---|---|---|---|
| M1 | step0 10 confidence | medium -> high | very slow propagation |
| M1 | step1 ADDED | (absent) -> 8 air_cm_s sustained | changed flow from 10 to 8 cm/s and flame shrank to a circle |
| M2 | step0 20 confidence | medium -> high | Ignite at 20 cm/s |
| M2 | step1 15 confidence | medium -> high | seemed steady |
| M2 | step2 13 confidence | medium -> high | flame got very dim |
| M2 | step3 ADDED | (absent) -> 14 air_cm_s extinguished at_constant_flow | so increased flow to 14 cm/s, but it self-extinguished |
| M3 | step5 ADDED | (absent) -> 18 air_cm_s extinguished at_constant_flow | Extinguished at 18 cm/s |
| M5 | step2 10 confidence | medium -> high | turned down to 10 cm/s, then further down in increments to 5 cm/s |
| M5 | step4 ADDED | (absent) -> 5 air_cm_s extinguished at_constant_flow | extinguished at 5 cm/s after prolonged flashing |
| M7 | step0 10 confidence | medium -> high | burned entire sample |
| M7 | step1 6 confidence | medium -> high | burned entire sample |
| M7 | step2 5 confidence | medium -> high | burned entire sample |
| M7 | step3 4.5 confidence | medium -> high | burned entire sample |
| M7 | step4 4 confidence | medium -> high | burned entire sample |
| M7 | step5 ADDED | (absent) -> 3 air_cm_s sustained | burned entire sample |
| M8 | step3 ADDED | (absent) -> 0.4 pot extinguished quench_low_flow | turned down flow to extinguish, went out at pot 0.4 |
| M9 | step0 10 confidence | medium -> high | Ignited at 10 cm/s |
| M9 | step1 ADDED | (absent) -> 14 air_cm_s extinguished at_constant_flow | died after 15 min at 14 cm/s |
| M10 | step0 10 confidence | medium -> high | multiple flows for steady spreading |
| M10 | step1 17 confidence | medium -> high | multiple flows for steady spreading |
| M10 | step2 14 confidence | medium -> high | multiple flows for steady spreading |
| M10 | step3 10 confidence | medium -> high | multiple flows for steady spreading |
| M10 | step4 ADDED | (absent) -> 8 air_cm_s extinguished at_constant_flow | flame self-extinguished at 8 cm/s after almost 10 min |
| M11 | step5 ADDED | (absent) -> 12 air_cm_s extinguished at_constant_flow | extinguished at 12 cm/s |
| M14 | step0 10 confidence | medium -> high | followed by flow reduction after flame moved away from igniter region and spread steadily |
| M14 | step1 ADDED | (absent) -> 9 air_cm_s extinguished at_constant_flow | flame self-extinguished at an air reading of 9 cm/s |
| M15 | step5 20 confidence | medium -> high | got steady spreading there |
| M15 | step8 ADDED | (absent) -> 15 air_cm_s extinguished at_constant_flow | turned down flow to 15 and got spreading and slow extinction there |
| M16 | step6 ADDED | (absent) -> 1 air_cm_s sustained | Burned at decreasing flow down to 1 cm/s or so, still fine |
| M16 | step7 ADDED | (absent) -> 10 air_cm_s sustained | turned up flow to 10 cm/s and flame got really long |
| M18 | step1 15 confidence | low -> high | flow briefly at 15 cm/s but flame was too strong so turned down |
| M18 | step3 ADDED | (absent) -> 8 air_cm_s extinguished at_constant_flow | extinguished 8 cm/s |
| M19 | step10 ADDED | (absent) -> 5 air_cm_s extinguished at_constant_flow | went out on its own at 5 cm/s |
| M20 | step0 10 confidence | medium -> high | ignition at 10 cm/s (left 8 min) |
| M20 | step1 ADDED | (absent) -> 8 air_cm_s extinguished at_constant_flow | flow down to 8 cm/s (flame out after 3 more minutes) |
| M17 | step7 extinction_mode | quench_low_flow -> flow_turned_off | finally turned fan pot to 0 to extinguish |
| M1 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.108: 'Opposed' | Opposed |
| M1 | terminal_event | unknown -> flow_turned_off | put flame out by turning off flow |
| M2 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.109: 'Opposed' | Opposed |
| M2 | terminal_event | unknown -> self_extinguished | it self-extinguished |
| M3 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.109: 'Opposed' | Opposed |
| M3 | terminal_event | unknown -> self_extinguished | Extinguished at 18 cm/s |
| M4 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.109: 'Opposed' | Opposed |
| M5 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.109: 'Opposed' | Opposed |
| M5 | terminal_event | unknown -> self_extinguished | extinguished at 5 cm/s after prolonged flashing |
| M6 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.109: 'Opposed' | Opposed |
| M7 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.109: 'Opposed' | Opposed |
| M7 | terminal_event | unknown -> burnout | burned entire sample |
| M8 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.109: 'Opposed' | Opposed |
| M8 | terminal_event | unknown -> extinguished_low_flow | turned down flow to extinguish, went out at pot 0.4 |
| M9 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.109: 'Opposed' | Opposed |
| M9 | terminal_event | unknown -> self_extinguished | died after 15 min at 14 cm/s |
| M10 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.108: 'Opposed' | Opposed |
| M10 | terminal_event | unknown -> self_extinguished | flame self-extinguished at 8 cm/s after almost 10 min |
| M11 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.108: 'Opposed' | Opposed |
| M11 | terminal_event | unknown -> self_extinguished | extinguished at 12 cm/s |
| M12 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.108: 'Opposed' | Opposed |
| M13 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.108: 'Opposed' | Opposed |
| M14 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.108: 'Opposed' | Opposed |
| M14 | terminal_event | unknown -> self_extinguished | flame self-extinguished at an air reading of 9 cm/s |
| M15 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.108: 'Opposed' | Opposed |
| M15 | terminal_event | unknown -> self_extinguished | slow extinction there |
| M16 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.108: 'Opposed' | Opposed |
| M17 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.108: 'Opposed' | Opposed |
| M17 | terminal_event | extinguished_low_flow -> flow_turned_off | finally turned fan pot to 0 to extinguish |
| M18 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.108: 'Opposed' | Opposed |
| M18 | terminal_event | unknown -> self_extinguished | extinguished 8 cm/s |
| M19 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.109: 'Opposed' | Opposed |
| M19 | terminal_event | unknown -> self_extinguished | went out on its own at 5 cm/s |
| M20 | configuration_evidence | opposed | Not stated in cell... -> NASA/TM-20210011385 Appendix A Table A.4 p.109: 'Opposed' | Opposed |
| M20 | terminal_event | unknown -> self_extinguished | flame out after 3 more minutes |
