# Verification: context droptower_tm2008_215260 (2026-11-15)

Source re-downloaded independently from NTRS API (https://ntrs.nasa.gov/api/citations/20080034883/downloads/20080034883.pdf, 15 pp.;
record report numbers NASA/TM-2008-215260, E-16527, SAE 2008-01-2055). Table 1 on PDF p. 7 (printed p. 3) rendered at 220 dpi and read visually,
cross-checked with the text layer.

Checked all 6 rows (22 columns each, CSV parses): O2 (23/22, 24/23, 17/16), pressure raw (14.7 / 10.2 psia) and kPa
(14.7 -> 101.353, 10.2 -> 70.327 at x6.894757), flow (30 cm/s in every 0g cell), column mapping (0g ULOI burns, 0g MOC extinguishes),
materials and thicknesses (Nomex 12 mil, Ultem 10 mil, Mylar G 5 mil; p. 7 text), sample size 5 cm x 10 cm (p. 6 text), concurrent 30 cm/s (p. 7 text),
5.18 s drop (p. 6), title, URL, NTRS id, page and table refs. 1g columns (WSTF, asterisked) correctly excluded.

Result: no errors found; no changes made to the CSV.

Residual notes (not errors):
- raw_text is a composed string ("fuel label | column header: cell text"), not a verbatim table line; cell text matches print (the table prints "psi a" with a line-break artifact for Ultem).
- outcome_text "burns"/"extinguishes" are the column headers defining the limit (ULOI/MOC), not per-run outcomes.
- sample size is from apparatus text, not the table; thicknesses from the paragraph text.
- years is report year only; test dates not stated.
