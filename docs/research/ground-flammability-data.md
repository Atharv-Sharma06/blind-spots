# Ground-based (normal gravity) flammability thresholds: context data

Task id: research-ground-flammability. Date: 2026-11-15.

Purpose: a small, exactly transcribed CONTEXT dataset showing where NASA has characterized flammability of
solid materials at reduced total pressure and elevated oxygen on the ground. It is NOT microgravity data,
uses a different configuration (upward flame propagation in normal gravity, NASA-STD-6001 Test 1 family),
and must never be mixed into the microgravity model or its training set. It supports only statements of
the form "ground-test flammability thresholds exist for these materials at these pressures / O2 levels".
It makes no claim about what NASA has not studied.

## Files written

`data/curation/ground_flammability/` (UTF-8, comma, LF). One CSV row = one printed table value.

| file | rows | source | table / PDF page |
|---|---|---|---|
| `hirsch2006_20070005041.csv` | 33 | Hirsch, Williams, Beeson, "Pressure Effects on Oxygen Concentration Flammability Thresholds of Materials for Aerospace Applications", J. Testing and Evaluation, Oct 2006 (NTRS 20070005041) | Table 2, p4 |
| `hirsch2007_20070018178.csv` | 52 | Hirsch et al., "Oxygen Concentration Flammability Thresholds of Selected Aerospace Materials Considered for the Constellation Program" (NTRS 20070018178) | Table 2, p4 |
| `hirsch2010_20100015582.csv` | 28 | Hirsch et al., "Pressure Flammability Thresholds of Selected Aerospace Materials" (NTRS 20100015582) | Table 2, p5 |
| `harper2016_20160001047.csv` | 70 | Harper et al., "Oxygen Partial Pressure and Oxygen Concentration Flammability: Can They Be Correlated?", J. ASTM Intl 2016 (NTRS 20160001047) | Table 2, p15 |

Columns: the 13 requested (`material, total_pressure_psia, total_pressure_kpa, oxygen_percent, result,
result_definition, test_method, source_title, source_url, ntrs_id, page, table, raw_text`) plus three
appended: `qualifier` (`<` or `>` when the table prints a bound, e.g. `< 30`; `oxygen_percent` then holds the
bound), `pressure_basis` (which pressure unit was printed vs converted), `value_note` (footnotes, source
observations). `page` is the PDF page of the NTRS file (equals the printed page number where one exists).
`source_url` is the NTRS landing page (`https://ntrs.nasa.gov/citations/<id>`, PDF at
`/api/citations/<id>/downloads/<id>.pdf`).

## What the values mean (`result`)

- `MOC`: maximum oxygen concentration (vol %) at which materials consistently self-extinguish at the stated total pressure.
- `ULOI`: upward limiting oxygen index (about 50 % pass); only in the 2007 and 2010 docs.
- `MTP`: maximum total pressure (psia) in about 99.8 % oxygen at which all samples self-extinguish (`oxygen_percent` = 99.8).
- `ULPI`: upward limiting pressure index (psia) in 99.8 % oxygen.
Definitions differ slightly per document and are copied into `result_definition` (e.g. the 2007 doc defines MOC
by at least three passing samples, the 2006 doc by at least five).

## Coverage (what exists in the transcribed tables)

- Total pressure 0.4 to 17.3 psia (2.8 to 119.3 kPa); oxygen 11 to 99.8 vol %.
- 2006 doc: 11 plastics/elastomers, MOC at 7, 12.4, 14.7 psia.
- 2007 doc: 26 material/configuration entries at one pressure (70.1 kPa), ULOI and MOC, several bounded (`<30`, `>40`, `>99.5`).
- 2010 doc: 7 materials, ULPI and MTP in 99.8 % O2 (0.4 to 1.8 psia) and ULOI/MOC at 10.2 psia.
- 2016 doc: 22 materials across 7 to 17.3 psia, plus MTP for 5 materials; largely overlaps 2006 and 2010 values (they agree).
- Sample thickness and configuration differ by material (about 0.1 mm films to 51 mm foam); only what each
  table prints is recorded.

## Transcription method and verification

1. PDFs downloaded from NTRS and text extracted with pypdf (layout mode).
2. The 2006, 2007 and 2010 PDFs are scans with an OCR text layer containing errors (for example "Nornex",
   "Ulteu", garbled column headers). Every value was therefore checked against the rendered page image;
   `raw_text` reproduces the row as printed (not the OCR errors), whitespace collapsed.
3. The 2016 table has a clean text layer; column assignment was taken from x-coordinates and confirmed on the rendered page.
4. Consistency check: for the 2006 and 2016 tables every MOC x total pressure reproduces the printed MOP within
   0.06 psia (0 failures), supporting the column assignment.
5. No plot was digitized. Figures in these papers were not used.

## Caveats

- Pressure conversion: kPa from psia (x 6.894757) or psia from kPa, rounded to 2 decimals, when the source prints only
  one unit; see `pressure_basis`. The 2006 doc prints 7/12.4/14.7 psia = 48.2/85.3/101.3 kPa (kept as printed);
  the 2016 doc labels the middle column 12.35 psia, the 2006 doc 12.4 psia. Whether these are the same chamber
  condition is not stated; they are kept as printed and not merged.
- The 2007 doc does not print a psia value for 70.1 kPa (psia 10.17 is converted); the 2010 doc calls the 10.2 psia
  condition its reference environment.
- Discrepancy not resolved: Nomex HT90-40 MOC at 10.2 psia is 25 (2010 doc), 37 (2016 doc) and in the 2007 doc
  (70.1 kPa) `<30` or 36 depending on configuration. Kydex 100 MOC is 33 (2007 doc) versus 32 (2010, 2016).
  Sample configuration or batch differences are plausible but not stated; do not treat as one number per material.
- The 2016 doc prints the 99.8 % O2 values under a "MOP (psia)" header; they are recorded as `MTP` because the
  2010 doc reports identical values as MTP for the same five materials. This identification is an inference
  from matching numbers, stated in `result_definition`.
- MOP (oxygen partial pressure) columns are derived from MOC and total pressure and were not transcribed.
  The "normoxic" and "ISS" equivalent rows of the 2016 table are computed reference rows and were skipped.
- Values marked `*` in the 2007 doc (e.g. `39*`) passed on 5 samples (source Note 7); the mark is kept in `raw_text`/`value_note`.
- Uncertainty: no source table prints confidence intervals; thresholds are step-size limited (1 vol % O2, 0.1 psi).
- These are ground tests on different geometry and gravity; thresholds must not be used as microgravity targets.
  Not a certified fire-safety assessment and not NASA endorsement.

## Documents located but not transcribed

- NTRS 20100028155 ("Pressure Flammability Thresholds in Oxygen of Selected Aerospace Materials", ICES 2010
  slides): image-only PDF with no text layer; likely duplicates NTRS 20100015582. Nothing transcribed.
- NTRS 20160004937 (slides of the 2016 paper): no tables. NTRS 20050185597 (NASA/CR-2005-213689, atmosphere
  design space): discusses flammability in prose; no threshold table transcribed.
- NTRS 20090012334 (found by search): metadata returned but PDF download failed; not reviewed.
- Not searched in depth: other WSTF reports (Beeson, Williams) and Test 1 data in NASA-STD-6001 Appendix / MAPTIS
  (not public NTRS tables). Absence from this list is not evidence that data do not exist.
