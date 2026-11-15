# TM Appendix A evidence CSV: adversarial verification (2026-11-15)

File checked: data/curation/evidence/bass2_tm_appendix_a.csv (126 rows). Source: NASA/TM-20210011385 PDF (re-downloaded from the NTRS downloads URL), pdf pages 111-121.

Method: independent re-extraction with a different technique from the original (pdfplumber extract_tables, cell-index based, test label found in the label cell of each table row, configuration from the Sample distance cell, observation from the last cell; continuation rows checked for stray observation text: none). Compared to the CSV for all 126 tests: observation_text, configuration_label, pdf_page. Printed page numbers confirmed from page footers (printed = pdf - 8). Rendered pages 118 (Olson, 14 rows) and 120 (T'ien, 17 rows) and compared visually, including unusual rows O1, O2 ("?" config), T1, T2, T4, T15 (config "1"), T1 long note.

Results
- Row count by sheet: Bhattacharjee 22, Ferkul 4, Fernandez-Pello 27, Miller 20, Olson 24, T'ien 29 = 126. Matches cross-check notes. Set of labels identical in both extractions.
- observation_text: 126/126 identical after whitespace normalisation. Only differences are two line-break hyphens in the CSV (M2 "self-extinguished", T1 "CSA-CP"), which are the intended joins and are noted in extraction_note.
- configuration_label: 126/126 identical to the printed Sample distance cell. T1, T2, T4, T15, and (page 121) T-tests printing "1" are verbatim "1", O1/O2 "?".
- pdf_page / printed_page / table: 126/126 consistent (A.1 p111-112, A.2 p113, A.3 p114-115, A.4 p116-117, A.5 p118-119, A.6 p120-121).
- Shifted cells: none. Truncated text: none. Missing tests: none (PSI-25 O20-O22 are not printed in Appendix A).

Errors fixed: 0. No changes made to the CSV.

Checker test: scripts/check_curation_provenance.py on a temp steps CSV (not committed): M2 and T1 rows with valid tokens pass; B1 with a token not in the text and Z99 with no label are flagged. Works.

Residual: observation text values for tests were read from the PDF text layer; numbers inside observations (e.g. pot settings) were not independently OCR-checked beyond the two rendered pages. Config "1" for T-tests is a printed value that is not a flow configuration.
