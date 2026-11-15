## research-publication-crosscheck (2026-11-15)

- Publication points live in `data/curation/publication_points.csv` (reference only; not training data). Journal PDFs behind paywalls were not downloaded; the BASS-II Summary Report (NTRS 20210011385) reproduces the same PI papers and is cited with TM page numbers.
- Appendix A of the Summary Report was parsed with pdfplumber. Only O2, configuration label, material and the observation clause were taken; per-step flow strings were not extracted because blank cells shift columns (the PSI-25 xlsx is the source for flows).
- `matched_psi_test_label` is filled only when the label is printed (Appendix A, Table 5.1, Table 7.1 via GMT day + T number, O4) or marked "(inferred ...)" when matched by calibrated O2 and rod size.
- "1 atm" printed in sources is converted to 101.325 kPa in `pressure_kpa` and noted in `raw_text`; the measured 99.2-99.5 kPa range (Bhattacharjee Fire Saf. J. comparison) is stored as the printed range string. No pressure is invented for rows that print none.
- BASS Final Report (`PSI-26_Reports_BASS_FinalReport.pdf`) could not be downloaded (S3 NoSuchKey, also for the SPICE report); not used.
