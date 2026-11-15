# research-other-microgravity-evidence decisions (2026-11-15)

- Range fields hold only values a source states. Unit conversions are arithmetic only (1 atm = 101.325 kPa; 1 psia = 6.894757 kPa; rounded to 0.1 kPa for converted atm/psia ranges). Instrument capability (JAXA SCEM 0-45 % O2, 0-101.3 kPa, 0-25 cm/s) is not written into the tested-range fields; it is quoted in `conditions_quotes` and `data_availability`.
- "Quiescent" SSCE tests are recorded as flow range [0, 0] because the sources state no imposed flow; Saffire flow ranges are [0, 20] because the sources state 20 cm/s, a reduction to 5 cm/s and fan-off periods.
- SSCE STS-50 conflict (35 % O2 at 1.5 atm in NTRS 19930011017 vs 1.0 atm in the dedicated USML-1 paper NTRS 19950007798): the later, dedicated paper is used; the conflict is stated in `data_availability`. DARTFire test 1A conflict (no ignition in the 1997 table vs ignited then extinguished in the 2003 text) is stated, not resolved.
- Saffire-VI dates conflict between NASA's article and the ICES slide; both are given, neither chosen.
- Every quote was checked by script as an exact substring of the downloaded text (whitespace-normalised; for the Japanese FLARE paper, ignoring the spurious spaces PDF extraction inserts). The 6 quotes taken from web-fetch tool output (NASA SoFIE pages, ZARM page) are listed in the research note as unchecked against files.
- Open-access abstracts of Elsevier papers were read from OpenAlex because publisher pages redirect; quotes cite the DOI.
- The partial-gravity (Martian/Lunar) drop-tower entry is included for the NASA-STD-6001 correlation question but carries an O2 range of its Martian and Lunar columns only [14.1, 22.0]; its 0g columns repeat the Glenn 2008 entry. Partial gravity is labelled, never presented as microgravity.
- The JSON keeps exactly the schema requested (no extra keys); caveats live in `data_availability`, `reason_not_integrated` and the research note.
- No state-changing git commands were run and only the three owned files were written.
