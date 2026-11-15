# research-atmosphere-profiles decisions (2026-11-15)

- Only profiles with a verbatim NASA quote are included (11 profiles). Quotes were machine-checked against text extracted from the downloaded PDFs/pages (whitespace, line breaks and hyphenation ignored); the `page` field is the PDF page index where the quote starts, not the printed page, except where noted.
- `nominal` is null for profiles whose sources give only an upper bound (orion_cm_lunar_design_10p2, orion_cm_14p7_o2_limit, nasa_std_3001_crew_envelope). The contract `Range.nominal: float` must tolerate null for these, or the lead should exclude them from the target selector.
- `o2_partial_pressure_kpa.nominal` is computed (O2 fraction x total pressure in psia x 6.894757); only the ISS min/max (146-178 mmHg, x 0.1333224 kPa/mmHg) come from a source.
- Ventilation band 7.62-60.96 cm/s is 15-120 ft/min x 0.508 cm/s per ft/min. The NASA text bounds the time-averaged velocity in the crew-occupied space (HIDH: two-thirds of velocities within the band). It is far wider than the contract default [0.5, 20.3] cm/s; 20.3 cm/s (0.2 m/s, 40 ft/min) in HIDH is a separate limit on airflow near ventilator inlets, not the cabin band.
- Shuttle nominal marked documented_nasa (not historical_nasa) because the lead's task text reserves historical_nasa for Skylab/Apollo; the profile is still a past-program condition.
- Gateway, Artemis lander/HLS and surface-habitat profiles omitted: no NASA document retrieved states design numbers (see docs/research/atmosphere-profiles.md).
