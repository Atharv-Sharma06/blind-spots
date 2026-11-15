# evidence-tm-appendix-a

- Source: NASA/TM-20210011385 (NTRS 20210011385), PDF https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf (the task URL ".../20210011385.pdf" returns 404). Appendix A = pdf pages 111-121 (printed 103-113); printed = pdf - 8.
- Output: data/curation/evidence/bass2_tm_appendix_a.csv (126 rows: Bhattacharjee 22, Ferkul 4, Fernandez-Pello 27, Miller 20, Olson 24, T'ien 29).
- Extraction: pdfplumber table geometry (header cell x-ranges for Test number, Sample distance, observation column; rows delimited by test-label cells), words assigned by cell centre. Not cell-index based, so blank cells do not shift columns. Wrapped lines joined with single spaces.
- Line-break hyphens: "self- extinguished" (M2) and "CSA- CP" (T1) joined without space ("self-extinguished", "CSA-CP"); noted in extraction_note.
- configuration_label is the verbatim "Sample distance" column. O1/O2 = "?". T1, T2, T4, T15 print the number "1" in that column (not a configuration word); consumers must not treat it as a flow configuration. The research note saying these were "not printed" is imprecise.
- Verification: every observation_text is a substring of the whitespace-normalized text of the observation column of its pdf_page (126/126). Whole-page extract_text interleaves wrapped lines across columns, so only 43/126 match there; the column-crop check was used instead. Spot-checked against rendered images of pages 111, 117, 119, 120.
- Labels: all 126 exist in PSI-25 sheets under the same names; PSI-25 O20-O22 are absent from Appendix A.
- scripts/check_curation_provenance.py: steps rows with raw_column == "TM Appendix A observation" are checked as substring of observation_text in the evidence CSV (matched on test_label and source_sheet if it equals a pi_sheet, else any sheet). Other rows unchanged. Tested on a temporary CSV (pass, fail, missing label) and on bass1_2012a.csv (0 errors).
