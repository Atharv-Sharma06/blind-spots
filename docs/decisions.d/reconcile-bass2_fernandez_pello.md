## reconcile-bass2_fernandez_pello (2026-11-15)
- Reconciled Fernandez-Pello tests/steps with NASA/TM-20210011385 Appendix A Table A.3 (pp.106-107). Full change log: data/curation/audit/bass2_fernandez_pello_tm.md.
- flame_configuration: 25 tests adopt Appendix A "Opposed" (consistent with ReadMe). P16 and P19 are labelled "Concurrent" in the TM but conflict with the ReadMe and Link et al. (opposed-flow use), so set to "unknown" (conservative).
- Steps: evidence columns added; P5 and P13a extinction mode corrected to flow_turned_off (TM: flow turned to 0); P1 extinction flow filled from TM (pot 0.315); final extinction steps added for P3a, P12, P14, P16, P17, P18, P19, P20, P23, P24, P21a; sustained step added for P2 (pot 0.33).
- P14 unit "pot" is inferred (TM prints no unit), confidence medium.
