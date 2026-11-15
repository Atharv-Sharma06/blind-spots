# Verify context_microgravity/saffire_iv_vi.csv (2026-11-15)

Sources re-downloaded independently from NTRS (20210011521, 12 pp; 20240002981, 7 pp). Table 1 on PDF p.3 of each rendered at 150 dpi and read visually; full text extracted for the surrounding paragraphs and figure labels.

Result: 8 of 8 rows checked. No value errors found.

Checked per row against the renders: material label, length, air flow (20 cm/s everywhere), flow direction (V-4 Opposed, all others Concurrent), ambient pressure (100.0/100.0/70.7/71.3/72.6; 54.1/54.6/55.2 kPa), O2 mol % (22.0/22.0/26.2/25.4/25.7; 31.0/30.3/28.8). Both tables agree on the shared rows IV-1 and V-2. Pressure is printed in kPa, so no unit conversion; raw_text matches the printed row; ids unique; 22 columns.
Checked by script: every outcome_text fragment is an exact substring (whitespace-normalised) of the extracted text; numeric fields equal raw_text.
Thickness labels confirmed in Fig. 2 (ICES-2021, PDF p.4: IV-2 1 cm, V-3 0.5 cm, V-4 1 cm; card assignment checked on the image) and ICES-2024 text/Fig. 3 (VI-3 10 mm, VI-4 5 mm). Width 41 cm from the ICES-2024 abstract (PDF p.2).

Change made: `page` column made more precise (adds where thickness/width and each outcome sentence appear: PDF p.2, 4, 5). No numeric or text-value changes.

Saffire-IV search (NTRS "Saffire-IV", 7 hits): the only per-sample conditions table with O2 and pressure is ICES-2021-266 Table 1 (IV-1, IV-2). NTRS 20220002714 has an event list (Table 1), not conditions; IV-3/IV-4 (not ignited) remain untranscribed.

Residual notes (not errors):
- `years` "2020-2021" for IV/V (paper says May 2020 and January 2021, NG-13/NG-14; per-flight mapping not printed). VI empty.
- Widths for IV/V not in ICES-2021; NTRS 20220002714 gives 40.64 cm (SIBAL) and 40 cm (PMMA) for Saffire-IV, which differs from 41 cm in the VI abstract; not used.
- IV-2 outcome_text omits the 65 s reduced-flow detail (separate sentence in the same paragraph); V-3/V-4 outcome text is shared between both samples.
- Table 2 (heat release, CO, CO2) not transcribed.
