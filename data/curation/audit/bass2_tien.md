# Audit: bass2_tien (T'ien sheet)

Changes made: 0. Checker: 29 test rows, 24 step rows, 0 provenance errors (re-run after audit; no files edited).

Checked against the cell dump and workbook cells:
- All 29 rows (2-30) present once; labels T1-T29 (no T8 in source) with T28a/T28b; no duplicates.
- Material/geometry/width: 2 cm -> 20 mm, 1 cm -> 10 mm, spherical sections (T3, T7) -> pmma_sphere/spherical_section 40 mm. Matches each Material cell.
- Steps: air list used once per physical step; no fan/pot double counting; each token is a verbatim substring of the Air display cell at the cited row; all final list entries (and single-setting tests) are intentionally not emitted because the sheet has no outcome tokens.
- O2 anomalies: T28a final 0.9 and T28b final 40.4 flagged; no others implausible.
- Dates: T9 (row 9) and T18 (row 18) read 2018-06-24 with GMT 175 (2014); both flagged in note only.

Residual concerns:
- The sheet contains no outcome tokens, so no extinguished/blowoff steps exist; all sustained steps are "implied by list order" (medium). Descending/ascending lists (T7 "decr") are not sourced as flame-out events.
- Config "concurrent" for SIBAL rests on the Zhao et al. 2017 title only (medium). T23/T24 left "unknown" (moved igniter / top side ign), inconsistent with the other SIBAL rows but conservative.
- T15 Fan cell '80122' read as 80,122 (unverified); T21 "max(47)" and T29 "2(?)" final settings not emitted.
- T3/T7 PMMA comes from the ReadMe, not the Material cell.
