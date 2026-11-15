# Other microgravity solid-fuel flammability evidence (not integrated from PSI)

Task `research-other-microgravity-evidence`, 2026-11-15. Purpose: the app must never say "NASA has not studied X"
(CONTRACTS section 0, rule 6). This note lists NASA and partner investigations outside the integrated PSI records
(BASS PSI-26, BASS-II PSI-25, Saffire-I/II/III context PSI-98/99/100), with the conditions each one documents, so the
product can show them as context. Machine-readable list: `data/manifests/known_investigations_not_integrated.json`
(16 entries; every `conditions_quotes[].quote` was checked as an exact substring of the downloaded source text, except
the 6 flagged below). Ranges are only what a source states; unknown is `null`. Pressure values in kPa are converted
from the source unit (1 atm = 101.325 kPa; 1 psia = 6.894757 kPa), rounded to 0.1 kPa where the source gave 1-decimal
atm/psia values.

## Headline: documented microgravity tests at elevated O2 and/or reduced pressure

| Evidence | Platform | O2 | Total pressure | Flow | Per-test public table? |
|---|---|---|---|---|---|
| Saffire-V (V-2, V-3, V-4) | Cygnus, free flyer | 25.4 to 26.2 mol % | 70.7 to 72.6 kPa | 20 cm/s (later 5, then off) | Yes, ICES-2021-266 Table 1 (NTRS 20210011521, PDF p. 3) |
| Saffire-VI (VI-2, VI-3, VI-4) | Cygnus, free flyer | 28.8 to 31.0 mol % | 54.1 to 55.2 kPa | 20 cm/s (VI-3: 5 cm/s at 1120 s, off at 1420 s) | Yes, ICES-2024-365 Table 1 (NTRS 20240002981, PDF p. 3; also slide 11 of NTRS 20240007488) |
| SoFIE-GEL (PMMA spheres) | ISS CIR | 13 to 34 % | 0.15 to 1.1 atm (15.2 to 111.5 kPa) | 0.2 to 80 cm/s | Only a 5-case table near 1 atm (NTRS 20240007628, PDF p. 3) and a figure map (Combust. Flame 277, 114244); full set not tabulated |
| Glenn 5.18 s drop tower, exploration atmospheres | drop tower | 16 to 85 % | 3.6 to 14.7 psia (24.8 to 101.4 kPa) | 0 to 30 cm/s | Limits table (NASA/TM-2008-215260, Table 1, PDF p. 7); 40 Kimwipes tests only as figures |
| DARTFire | sounding rocket | 35, 50, 70 % | 1 atm | 1, 5, 10 cm/s | Yes, 8-row Table 1 (NTRS 20030111833, PDF p. 45), elevated O2 only |
| SSCE thin and thick | Space Shuttle | 35 to 70 % | 1.0 to 2.0 atm | quiescent | Spread rates in text only |

Derived (computation on the source numbers, not a source statement): O2 partial pressure is 18.5 / 18.1 / 18.7 kPa for
Saffire V-2/V-3/V-4 and 16.8 / 16.5 / 15.9 kPa for Saffire VI-2/VI-3/VI-4, against 22.0 kPa for Saffire-IV and 21.3 kPa
on the NASA normoxic curve (ZARM page). The Saffire-V/VI atmospheres are therefore elevated-O2, reduced-pressure and
hypoxic-side.

### Public, citable tables a lead could decide to transcribe
1. **Saffire IV-VI sample test conditions** (the only tabulated reduced-pressure, elevated-O2 microgravity conditions
   with per-test material, length, flow direction, pressure, O2): ICES-2021-266 Table 1 (IV-1, IV-2, V-2, V-3, V-4) and
   ICES-2024-365 Table 1 (IV-1, V-2, VI-2, VI-3, VI-4). Outcomes are prose: all listed tests ignited and burned; "two
   samples on Saffire IV and one sample on Saffire V were not ignited"; the VI Nomex sample did not ignite. Heat release,
   burn duration, CO and CO2 per test: ICES-2024-365 Table 2 (PDF p. 6). Flow of each sample is one value (20 cm/s), so
   these rows do not map onto BASS-style flow-step boundaries.
2. **NASA/TM-2008-215260 Table 1** (PDF p. 7; printed page 3): 0g upward limiting oxygen index (burns) and maximum oxygen
   concentration (extinguishes) at 10.2 or 14.7 psia and 30 cm/s for Ultem 1000, Nomex HT90-40, Mylar G, beside 1g
   values (the 1g values are WSTF data). Drop-tower limit criterion: "lowest oxygen concentration where the flame survived
   to the end of the drop" (5.18 s). Figure 4 (PDF p. 8) is a flow-vs-O2 flammability map for Ultem at 10.2 psia, figure only.
3. **Olson and Ferkul, NTRS 20130010991, Table I** (PDF p. 6): same three fuels for 1g, Martian-g, Lunar-g and 0g limits.
   Partial gravity is not microgravity; keep it labelled.
4. **DARTFire Table 1** (NTRS 20030111833, PDF p. 45), transcribed here for reference: flight-tunnel, O2 %, flow cm/s,
   imposed flux W/cm2, spread cm/s: 1A 35/1/1 extinguished; 1B 50/1/0 0.020; 2A 50/1/1 0.019 on, 0.010 off; 2B 50/5/0
   0.032; 3A 50/1/2 0.033 on, 0.020 off; 3B 50/10/0 0.045; 4A 50/1/1 no ignition; 4B 70/1/0 0.040. Duct pressure 1 atm.
   Conflict: the 1997 version (NTRS 19970020610 Table 1) lists 1A as "no ignition" while the 2003 text says it ignited and
   extinguished when the igniter was turned off.
5. **SoFIE-GEL five cases** (NTRS 20240007628 Table 1): flow 4.83, 34.28, 11.50, 0.44, 49.68 cm/s; O2 14.21, 14.99, 13.54,
   20.77, 14.37 %; p 1.04, 1.06, 1.07, 1.03, 1.07 atm; extinction modes quenching, blowoff, intermediate, quenching,
   blowoff. All near 1 atm; do not describe them as reduced-pressure evidence.

No machine-readable per-test dataset was found for any of these. None of the 24 PSI Combustion Science investigations
catalogued in `docs/research/psi-catalog.md` is SoFIE, Saffire-IV/V/VI, SSCE, DARTFire or FLARE.

## Per-investigation notes

**SoFIE (ISS Combustion Integrated Rack insert).** Five investigations selected in 2009: GEL (T'ien, CWRU, PMMA spheres),
MIST (Fernandez-Pello, UC Berkeley, PMMA cylinders with external radiant flux), SMuRF (Olson, GRC, PMMA cylinders and
engineering-material sheets), NCA (Miller, SDSU, thick PMMA, a narrow-channel 1-g complement) and RTDFS (Bhattacharjee,
SDSU, thin PMMA sheets). Design status (NTRS 20190030735): MIST wants the effects of "lower pressure and increased oxygen
concentrations compared to air". GEL is the only sub-investigation with published ranges; MIST, SMuRF, NCA and RTDFS have no
numeric conditions or results in the sources retrieved. NASA pages: science.nasa.gov/biological-physical/investigations/sofie
(delivered via Cygnus NG-17, operating through February 2025), `/sofie-gel`, `/sofie-mist` (SpaceX-27).

**Saffire-IV, -V, -VI.** Concurrent flame spread (opposed on V-4) in a 30 cm x 45 cm x 109 cm duct inside Cygnus after ISS
departure; the spacecraft is vented and O2 backfilled to the target atmosphere before tests (ICES-2024-365). Saffire-IV
samples were at 22.0 % and 100.0 kPa; V at about 70.7 to 72.6 kPa and 25.4 to 26.2 %; VI at 54.1 to 55.2 kPa and 28.8 to
31.0 %. Duct half-height was reduced from 25 cm (I-III) to 15 cm (IV-VI). The O2 and CO2 gas sensors on IV and V were not
useful (outlet sensor moved off its mixing-verified location). Saffire-I/II/III (21-22 % O2, about 100 kPa) are the
integrated context records.

**SSCE (Space Shuttle).** Quiescent O2/N2 in a 0.039 m3 chamber. Thin ashless filter paper, five flights: 50 % O2 at 1.0,
1.5, 2.0 atm (spread 0.358, 0.454, 0.547 cm/s), 35 % at 1.0 atm (0.092 cm/s, STS-50/USML-1) and 35 % at 1.5 atm (0.150
cm/s). Thick PMMA, three flights: 70 % O2/1 atm (STS-54), 50 %/1 atm (STS-63), 50 %/2 atm (STS-64); STS-85 (9 Aug 1997)
reflight showed extinction rather than steady spread for thick flat fuels. Source conflict: NTRS 19930011017 (earlier)
gives STS-50 as 35 % at 1.5 atm; NTRS 19950007798 (later, dedicated USML-1 paper) says 1.0 atm and is used. All pressures
are at or above 1 atm.

**FFFT and RITSI (STS-75, USMP-3).** FFFT: 15 experiments, cellulose sheets and cylinders in air at about 1 to 8 cm/s
(abstract). RITSI: 25 experiments (21 flaming, 4 smoldering) on thin filter paper, air flow 0 to 6.5 cm/s, in the Glovebox
(abstract). Neither abstract gives O2 or pressure numbers; both are air tests. Full texts and per-test tables were not
retrievable here.

**DARTFire (sounding rocket, June 1996 to September 1997).** See table above. Black PMMA, flows 1 to 10 cm/s, duct at
1 atm, O2 35 to 70 %, laser flux up to 2 W/cm2. Reports flame spread over thick PMMA persists down to about 5 cm/s flow at
50 % O2 before the radiation-dominated regime (NTRS 19970020610).

**NASA Glenn drop towers and NASA-STD-6001 correlation.** Zero Gravity Research Facility (5.18 s): TM-2008-215260 found 0g
limits up to 4 % O2 lower than the 1g Test 1 limits for the three fuels (abstract), and a Martian/Lunar-gravity series
found negative margins up to -5.75 % O2 (Lunar, Mylar). The Olson/Ferkul LPSC 2026 abstract (NTRS 20260000646) says NASA
screens with 1g Test 1 and expects partial gravity to widen flammability for some materials; FM2 (Flammability of
Materials on the Moon) has "a planned launch date of late 2026" (status not checked). 1-g only Test 1 papers
(NTRS 20070018178, 20110008636, 20150004099) have no microgravity data. The BASS-II/ground correlation papers (NTRS
20160000593, 20160012691) use data from the integrated PSI-25 and are not listed as separate entries. A 2.2 s drop-tower
facility was not documented in sources retrieved; NASA Glenn's Olson 1988/1991 papers are only cited in references and were
not read.

**JAXA FLARE (with NASA, ESA, CNES, DLR).** SCEM on Kibo can set 0 to 45 vol. % O2 and 0 to 101.3 kPa with 0 to 25 cm/s
flow (J. Combust. Soc. Jpn. 66(218), 2024; JAXA leaflet says "atmospheric-pressure and low-pressure conditions,
with high-oxygen-concentration conditions (up to 45%)"). Reported ISS tests so far: 43 filter-paper tests between 19 May
2022 and 24 May 2024 (31 opposed, 12 concurrent); Proc. Combust. Inst. 40 (2024) 105200 analyses 19 opposed-flow tests at
298 K and 100 kPa (flow stepped 10 to 18 cm/s in one sequence at 15.5 % O2); PMMA and Nomex HT90-40 maps in Combust. Flame
(2026) 114803; "flame spread was observed even below the limiting oxygen concentration predicted by a conventional
two-dimensional flame spread model" (Proc. Combust. Inst. 2026, 106032). FLARE-2 plans exploration-atmosphere and further
low-pressure tests; 56.5 kPa and 34 % O2 is cited as the original Artemis habitat proposal. The published tests found are at
100 kPa, so FLARE gives no documented reduced-pressure microgravity result yet. LOC maps are figures.

**ESA.** ESA takes part in Saffire (ESTEC) and FLARE. ZARM Bremen's drop-tower campaign (FLARE-G I) varied O2, inflow
velocity and pressure on 0.2 mm PMMA sheets and reports "decreasing pressure only slightly dampens combustion", but its
page gives no numbers. Eigenbrod et al. (ICES-2021-218, structured PMMA in an exploration atmosphere) is the Saffire V-4
sample (72.6 kPa, 25.7 %, opposed).

## What the app may and may not say
- Allowed: "Not represented in the integrated records" for any condition outside PSI-25/26 (CONTRACTS rule 6).
- Documented elsewhere at or near the following (context only, not training data): reduced pressure with elevated O2 in
  microgravity (Saffire-V/VI, about 54 to 73 kPa, 25 to 31 % O2, single flow 20 cm/s; SoFIE-GEL 0.15 to 1.1 atm, 13 to 34 %).
  Elevated O2 at 1 atm: DARTFire, SSCE. Reduced pressure in drop-tower microgravity at 10.2 psia: Glenn 2008.
- Not allowed: "NASA has not tested reduced pressure in microgravity" or any statement that the integrated envelope is the
  whole of the evidence.

## Unverified or limited
- Six quotes (not marked in the JSON; listed here) came from a web-fetch tool's extraction of the NASA SoFIE (Glenn),
  SoFIE-MIST pages and the ZARM page, not from a downloaded file: "oxygen from atmospheric levels up to 85%" (NCA),
  "Delivery to the International Space Station via SpaceX-27", and the four ZARM quotes. Re-check them against the live pages.
- The abstracts of Combust. Flame 277 114244, Proc. Combust. Inst. 105200 and 106032, and Combust. Flame 114803 were read
  through OpenAlex's abstract index; the publisher pages were not readable. The Fire Technology 2024 paper
  (10.1007/s10694-023-01507-3) and the JAXA repository record were not retrievable, so FLARE per-test tables are unconfirmed.
- Saffire-VI dates conflict (NASA article: launched August 2023, concluded Jan. 9; ICES slide: "flew in December 2023"); the same
  NASA article says "19 Saffire-VI experiment runs", which does not match four samples per card. Not reconciled.
- Saffire-IV to NG-13 and V to NG-14 mapping is inferred from the order of the ICES-2021 sentence.
- Years of USMP-3 (STS-75), the Glenn drop-tower papers, and the Olson/Ferkul Martian-gravity paper are not stated in the
  retrieved texts. The platform of the 2013 Olson infrared study is not named in the retrieved text.
- PSI absence of SoFIE/Saffire-IV-VI/etc. rests on the lead's catalogue of 24 Combustion Science records (psi-catalog.md);
  PSI was not searched again here. NASA and PSI were merged into one portal in October 2025 (search result), so a later release
  of SoFIE data is possible.
- PDF text extraction of the SSCE paper shows OCR "02" for O2 in "50% 02/2 atm (STS-64)".
- All numbers in the JSON were read from the cited documents; none was estimated. Spread rates in the DARTFire and SSCE
  notes are from the cited tables or text, not recomputed.

Downloaded sources are in the session scratchpad (`research/research-other-microgravity-evidence/`), not in the repo.
