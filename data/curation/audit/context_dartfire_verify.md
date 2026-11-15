# Verify context_microgravity/dartfire.csv (2026-11-15)

Source re-downloaded independently (NTRS 20030111833, 47-page PDF); Table 1 on PDF p.45 rendered at 150 dpi and read visually; full text extracted for the surrounding paragraphs.

Result: 8 of 8 rows checked, no changes needed to the CSV.

Checked per row against the render: test id, O2 % (35/50/50/50/50/50/50/70), bulk flow (1/1/1/5/1/10/1/1 cm/s), flux column in raw_text (1,0,1*,0,2+,0,1,0), outcome cell (Extinguished; 0.020; 0.019 on / 0.010 off; 0.032; 0.033 on / 0.020 off; 0.045; No Ignition; 0.040). All match. Header is the binding 22-column format, ids unique.

Checked against text: sample "Black PMMA samples, 20 mm long x 20 mm thick x 6.35 mm wide" (p.4); "Pressure in the duct was maintained at 1 atmosphere" (p.5), 1 atm = 101.325 kPa exactly; "opposed flow" (keywords, abstract); "-6 minute microgravity experiment" (p.5); 1A text "sample ignited, but the flame extinguished when the igniter was turned off", 4A "failed to ignite" (p.5), consistent with the table cells.

Residual notes (not errors):
- Pressure is stated in the text (PDF p.5), not in Table 1; the `page` column holds the table page 45.
- outcome_text for spread-rate rows is the column header "Measured spread rate, cm/s: " plus the printed cell; " / " joins the two printed lines of the on/off cells. Printed values unchanged.
- `years` (June 1996 to September 1997) is not in this PDF; it comes from the abstract of NTRS 20050192123 (confirmed by fetching the NTRS record).
- Footnote markers on 2A (*) and 3A (+) are kept in raw_text; footnote text ("selected to offset surface radiative loss" / "...surface + gas-phase radiative loss") is not in a contract column.
- 1A: 1997 version (NTRS 19970020610) lists "no ignition"; not re-checked here (not downloaded).
