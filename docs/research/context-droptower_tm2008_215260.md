# Context table: NASA Glenn 5.18 s drop tower flammability limits (NASA/TM-2008-215260)

Task id: context-droptower_tm2008_215260. Output: `data/curation/context_microgravity/droptower_tm2008_215260.csv` (6 rows).

## Source
"Microgravity Flame Spread in Exploration Atmospheres: Pressure, Oxygen, and Velocity Effects on Opposed and Concurrent Flame
Spread", Olson, Ruff, Fletcher (NASA Glenn), NASA/TM-2008-215260 (also SAE 2008-01-2055, E-16527). NTRS 20080034883,
https://ntrs.nasa.gov/citations/20080034883 (PDF downloaded from the NTRS API, 15 pages). Public use permitted per NTRS record.

## Transcribed
Table 1 "Comparison of 1g and 0g flammability limits for three fuels", PDF p. 7 (printed p. 3). Only the two 0g columns
(0g ULOI "burns", 0g MOC "extinguishes") for Nomex HT90-40 fabric, Ultem 1000 10 mil, Mylar G: 3 fuels x 2 limits = 6 rows.
Each row is one printed cell (O2 %, pressure, flow), all verified against the 150 dpi rendered page image.
Pressure kPa = psia x 6.894757 (14.7 -> 101.353, 10.2 -> 70.327). raw_text is "<fuel row label> | <column header>: <printed cell text>".

## Caveats
- Rows are limit values (lowest O2 where flame survived the drop = 0g ULOI; highest O2 where it extinguished = 0g MOC),
  not individual test runs. p. 6 text: the limit is the lowest O2 where the flame survived to the end of the 5.18 s drop; some
  flames might extinguish given longer time. The paper calls the limits conservative and not identical to 1g limits.
- Printed values are integer percent; no uncertainty printed for 0g values.
- flame_configuration "concurrent": p. 7 text says the 0g values are at concurrent flow of 30 cm/s; igniter could be at either
  end of the sample (p. 6), but the text states the remaining fuels were tested at 30 cm/s concurrent.
- sample_dimensions "5-cm wide by 10-cm long" is from the p. 6 apparatus text (sample size in the holder), thicknesses from p. 7 text
  (printed in material column of the CSV). Not printed in the table itself.
- years "2008" is the report year; test dates are not stated.
- Omitted deliberately: the 1g ULOI/MOC columns (1 g, WSTF data per footnote, not microgravity); Figure 4 (Ultem flammability map at
  10.2 psia, figure only); Kimwipes flame-spread tests (40 tests, figures only; abstract/text give ranges 0-30 cm/s, 3.6-14.7 psia).
- Nomex 1g ULOI printed "(+-0.6)" belongs to the omitted 1g column.
- Not integrated into the model; context only. No claim that other conditions were not studied.

## Unverified
Text layer of the PDF was used for cross-reading; all numbers were confirmed visually on the rendered page. Nothing else unverified.
