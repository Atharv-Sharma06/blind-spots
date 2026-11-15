# NASA crewed-cabin atmosphere profiles (research-atmosphere-profiles)

Date: 2026-11-15. Data file: `data/manifests/atmosphere_profiles.json`. All numbers in the source columns are NASA-stated; kPa columns are psia x 6.894757 and ppO2 values are computed unless noted (see notes). `n/a` means the NASA sources retrieved do not state the value (kept null, not guessed). No claim of NASA approval or certification is made.

## Table

| profile_id | status | O2 % nominal (min to max) | total pressure psia | total pressure kPa | ppO2 kPa |
|---|---|---|---|---|---|
| `iss_cabin_nominal` | documented_nasa | 21 (n/a to 24.1) | 14.7 (14 to 14.9) | 101.353 (96.527 to 102.732) | 21.284 (19.465 to 23.731) |
| `iss_materials_worst_case` | documented_nasa | 24.1 | 14.7 | 101.353 | 24.426 |
| `shuttle_nominal` | documented_nasa | 21 | 14.7 | 101.353 | 21.284 |
| `shuttle_staged_pre_eva` | documented_nasa | 26.5 | 10.2 | 70.327 | 18.637 |
| `exploration_atmosphere_8p2_34` | nasa_design_recommendation | 34 | 8.2 | 56.537 | 19.223 |
| `eawg_2006_8p0_32` | nasa_design_recommendation | 32 | 8 | 55.158 | 17.651 |
| `orion_cm_lunar_design_10p2` | nasa_design_recommendation | n/a (n/a to 30) | 10.2 | 70.327 | n/a (n/a to 21.098) |
| `orion_cm_14p7_o2_limit` | historical_nasa | n/a (n/a to 25.6) | 14.7 | 101.353 | n/a (n/a to 25.946) |
| `nasa_std_3001_crew_envelope` | documented_nasa | n/a (n/a to 70) | n/a (5 to 15) | n/a (34.5 to 103) | n/a (n/a to 50.676) |
| `skylab` | historical_nasa | 70 | 5 | 34.474 | 24.132 |
| `apollo_cm` | historical_nasa | 100 | 5 | 34.474 | 34.474 |

## Ventilation (default airflow band)

**7.62 to 60.96 cm/s** (15 to 120 ft/min; NASA gives 4.57 to 36.58 m/min). This is the NASA time-averaged atmosphere velocity range in the crew-occupied space; the HIDH wording is that two-thirds (66.7 %) of the atmosphere velocities fall within it. It is a design range for preventing CO2 and thermal pockets, not a measured value for any experiment. HIDH also notes that airflow in the vicinity of ventilator inlets should not exceed 0.2 m/s (40 ft/min) (HIDH Rev 1, PDF p. 368, 6.2.3.3), a separate limit that is not the cabin band; the contract's default upper bound of 20.3 cm/s is approximately that inlet value (40 ft/min = 20.32 cm/s).

- NASA/SP-2010-3407/REV1, PDF p. 368 (printed p. 363, section 6.2.3.3): "For microgravity operations, the nominal ventilation rate in the internal atmosphere must be such that two-thirds (66.7%) of the atmosphere velocities are between 4.57 m/min (15 ft/min) and 36.58 m/min (120 ft/min)." (https://www.nasa.gov/sites/default/files/atoms/files/human_integration_design_handbook_revision_1.pdf)
- NASA-STD-3001 Vol. 2 Rev F, PDF p. 61: "The effective atmosphere velocity range of 4.57-36.58 m/min (15-120 ft/min) pertains to the time averaged velocity magnitudes in the crew occupied space using averages over time periods sufficient to achieve stability." (https://standards.nasa.gov/system/files/tmp/NASA-STD-3001%20Vol%202%20Rev%20F.pdf)
- NASA-STD-3001 Vol. 2 (nasa.gov web page), web page, section 6.2.7.1: "The effective atmosphere velocity range of 4.57-36.58 m/min (15-120 ft/min) pertains to the time averaged velocity magnitudes in the crew occupied space using averages over time periods sufficient to achieve stability." (https://www.nasa.gov/reference/6-0-natural-and-induced-environments-vol-2)

## Per-profile citations

### `iss_cabin_nominal`: ISS cabin (nominal operating range)

International Space Station US-segment cabin; documented operating control ranges for total pressure and oxygen partial pressure.

- Report on ISS O2 Production, Gas Supply and Partial Pressure Management (ICES-2015-146 / JSC-CN-33571), PDF p. 1: "The oxygen partial pressure is maintained at a range of 146 – 178 mmHg (2.82 – 3.44 psi) and the total pressure is maintained between 724 – 770.5 mmHg (14.0 – 14.9 psia)." <https://ntrs.nasa.gov/citations/20150010425>
- Enhancing Future Commercial Space Stations: Applying ISS Insights to ECLSS Development on Emergency Response (ICES-2025-126), PDF p. 2: "For the ISS, the cabin is maintained at a total pressure between 96.5 kPa (14.0 psia) and 102.7 kPa (14.9 psia)" <https://ntrs.nasa.gov/citations/20250003954>
- NASA-STD-3001 Technical Brief: Habitable Atmosphere (OCHMO-TB-003 Rev A) (OCHMO-TB-003 Rev A), PDF p. 8: "Currently, the ISS cabin pressure is typically maintained at 14.7 psia with 21% O2, which is equivalent to sea level." <https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-003-habitable-atmosphere.pdf>
- Oxygen Partial Pressure and Oxygen Concentration Flammability: Can They Be Correlated? (JSC-CN-34845), PDF p. 3: "The ISS aims to operate at the 21% O2, 101.4 kPa (14.7 psia) point of the curve." <https://ntrs.nasa.gov/citations/20160001047>
- Oxygen Concentration Flammability Thresholds of Selected Aerospace Materials Considered for the Constellation Program (no report number in NTRS record), PDF p. 1: "the International Space Station (ISS) atmosphere is also nominally air (maximum oxygen concentration 24.1% by volume)" <https://ntrs.nasa.gov/citations/20070018178>

Notes: Nominal 14.7 psia / 21% O2 is the documented operating point; 14.0-14.9 psia is the documented total-pressure control range (ICES-2015-146 gives 724-770.5 mmHg, ICES-2025-126 gives 96.5-102.7 kPa). ppO2 range 146-178 mmHg (2.82-3.44 psi) is the documented control range, converted here to kPa at 0.1333224 kPa/mmHg. The O2 max of 24.1 % is a documented maximum concentration (Hirsch et al. 2007); it is also the basis of the materials worst-case profile. Minimum O2 percent is not stated as a percentage in the sources, so min is null. Nominal ppO2 (kPa) is computed as 0.21 x 14.7 psia x 6.894757 and is not a source value. psia fields are source values; kPa fields are psia x 6.894757 (kPa values stated in sources are rounded slightly differently).

### `iss_materials_worst_case`: ISS cabin materials-testing worst case (24.1 % O2 at 14.7 psia)

Worst-case ISS cabin condition under which NASA has obtained much of its materials flammability data (oxygen fluctuation above the 21 % mean).

- Oxygen Partial Pressure and Oxygen Concentration Flammability: Can They Be Correlated? (JSC-CN-34845), PDF p. 1: "NASA possesses a large quantity of flammability data performed in ISS airlock (30% Oxygen 526mmHg) and ISS cabin (24.1% Oxygen 760 mmHg) conditions." <https://ntrs.nasa.gov/citations/20160001047>
- Oxygen Partial Pressure and Oxygen Concentration Flammability: Can They Be Correlated? (JSC-CN-34845), PDF p. 3: "Nonetheless, it has obtained much of its data at 24.1% O2, 101.4 kPa (14.7 psia) conditions due to sinusoidal fluctuations of oxygen with a mean of 21% O2 seen on the ISS." <https://ntrs.nasa.gov/citations/20160001047>
- Oxygen Concentration Flammability Thresholds of Selected Aerospace Materials Considered for the Constellation Program (no report number in NTRS record), PDF p. 1: "the International Space Station (ISS) atmosphere is also nominally air (maximum oxygen concentration 24.1% by volume)" <https://ntrs.nasa.gov/citations/20070018178>

Notes: NASA-STD-6001 itself was not retrieved; this profile rests on the two NASA papers quoted. One passage of Harper et al. 2016 (PDF p. 2) prints '191.4 kPa (14.7 psia)', an apparent typographical error for 101.4 kPa; that passage is not used as a quote. The same paper's abstract gives 760 mmHg, consistent with 14.7 psia. The ISS airlock condition (30 % O2 at 526 mmHg) is a different environment and is not a profile here. ppO2 is computed (0.241 x 14.7 psia x 6.894757), not a source value.

### `shuttle_nominal`: Space Shuttle cabin (nominal)

Space Shuttle Program crew cabin at Earth-equivalent sea-level atmosphere (program-era profile).

- Effects of the 8 psia / 32% O2 Atmosphere on the Human in the Spaceflight Environment (NASA/TM-2013-217377), PDF p. 12: "including the Space Shuttle Program and International Space Station (ISS) programs have operated at an Earth equivalent sea level atmosphere of 14.7 psia and 21% O2." <https://ntrs.nasa.gov/citations/20130013505>
- Evidence Report: Risk of Hypobaric Hypoxia from the Exploration Atmosphere (JSC-CN-34806), PDF p. 5: "NASA’s more recent programs, including the Space Shuttle Program and International Space Station (ISS) program have operated at an Earth-equivalent sea level atmosphere of 14.7 psia and 21% O2." <https://ntrs.nasa.gov/citations/20150021491>

Notes: Same nominal point as ISS. Hirsch et al. 2007 describe the Shuttle atmosphere as 'nominally air at ambient pressure' except during EVA prebreathe. No min/max stated in the retrieved sources. ppO2 computed (0.21 x 14.7 psia x 6.894757).

### `shuttle_staged_pre_eva`: Space Shuttle staged pre-EVA cabin (10.2 psia / 26.5 % O2)

Reduced-pressure, mildly hypoxic cabin used for staged denitrogenation before Shuttle EVAs.

- NASA-STD-3001, Volume 2, Revision F: Human Factors, Habitability, and Environmental Health (NASA-STD-3001 Vol. 2 Rev F), PDF p. 50: "a mildly hypoxic vehicle system atmosphere as part of a denitrogenation protocol to reduce the risk of DCS is advantageous during spaceflight (e.g., Space Shuttle 10.2 psia/26.5% O2), as well as recommended by the Exploration Atmospheres Working Group and endorsed by Human Exploration and Operations Mission Directorate (Exploration Atmospheres, HEOMD memo, February 2013)." <https://standards.nasa.gov/system/files/tmp/NASA-STD-3001%20Vol%202%20Rev%20F.pdf>
- Effects of the 8 psia / 32% O2 Atmosphere on the Human in the Spaceflight Environment (NASA/TM-2013-217377), PDF p. 47: "8.2/34 is almost physiologically equivalent to the atmosphere of 10.2 psia and 26.5% O2 used on the shuttle." <https://ntrs.nasa.gov/citations/20130013505>
- Oxygen Concentration Flammability Thresholds of Selected Aerospace Materials Considered for the Constellation Program (no report number in NTRS record), PDF p. 1: "when it contains 30 % oxygen at 70.1 kPa" <https://ntrs.nasa.gov/citations/20070018178>

Notes: Operating value 26.5 % O2 at 10.2 psia. Hirsch et al. 2007 (NTRS 20070018178, not listed in sources above) state the Shuttle prebreathe atmosphere as 30 % O2 at 70.1 kPa, which conflicts with the 26.5 % stated by NASA-STD-3001 Rev F and NASA/TM-2013-217377; the sources do not reconcile this, so min/max O2 are left null and 26.5 % is kept as the nominal. Separately, Hirsch et al. 2009 (NTRS 20090012334) describe the 30 % O2 / 10.2 psia materials certification for the Orion crew module (Constellation context), not the Shuttle. ppO2 computed (0.265 x 10.2 psia x 6.894757).

### `exploration_atmosphere_8p2_34`: NASA Exploration Atmosphere (8.2 psia / 34 % O2)

NASA Exploration Atmospheres adopted atmosphere for high-frequency-EVA exploration spacecraft; updated in 2012 from the 2006 EAWG 8.0 psia / 32 % O2 recommendation.

- Fifteen-minute Extravehicular Activity Prebreathe Protocol Using NASA's Exploration Atmosphere (8.2 psia / 34% O2) (JSC-CN-29019), PDF p. 2: "NASA recently adopted an exploration atmosphere (Expl. Atm.) of 8.2 psia, 34% oxygen (O2), 66% nitrogen (N2) for future spacecraft that will be used for high-frequency EVAs" <https://ntrs.nasa.gov/citations/20140000417>
- Evidence Report: Risk of Hypobaric Hypoxia from the Exploration Atmosphere (JSC-CN-34806), PDF p. 5: "The Exploration Atmosphere Action Team convened in 2012 to review the 8/32 atmospheric recommendation and moved to alter the environment to 8.2 psia and 34% O2 to reduce the hypoxic stress without affecting DCS risk or materials concerns [3]." <https://ntrs.nasa.gov/citations/20150021491>
- Evidence Report: Risk of Hypobaric Hypoxia from the Exploration Atmosphere (JSC-CN-34806), PDF p. 29: "Consider the case of the current 8.2 psia habitat pressure with 34% O2 and 66% N2. The ambient ppO2 is 2.79 psia (0.34 × 8.2 psia)." <https://ntrs.nasa.gov/citations/20150021491>
- NASA-STD-3001, Volume 2, Revision F: Human Factors, Habitability, and Environmental Health (NASA-STD-3001 Vol. 2 Rev F), PDF p. 49: "typically 8.2 to 14.7 psia" <https://standards.nasa.gov/system/files/tmp/NASA-STD-3001%20Vol%202%20Rev%20F.pdf>
- Open Atmospheres Forum: Exploration Atmospheres Validation Study (no report number in NTRS record), PDF p. 2: "Artemis habitat and suit atmospheric parameters have not been finalized" <https://ntrs.nasa.gov/citations/20220011152>

Notes: Recommendation/adoption for exploration vehicles, not a certified flown cabin. A 2022 NASA forum deck states Artemis habitat and suit atmospheric parameters have not been finalized, so this must not be presented as a flight-baseline for any specific Artemis element. No min/max tolerance was found for this point. ppO2 computed (0.34 x 8.2 psia x 6.894757); the evidence report states 2.79 psia.

### `eawg_2006_8p0_32`: EAWG 2006 recommendation (8.0 psia / 32 % O2), superseded

Exploration Atmospheres Working Group 2006 recommendation for Constellation-era CEV (Orion precursor) and Lunar Surface Access Module; superseded by the 8.2 / 34 atmosphere.

- Effects of the 8 psia / 32% O2 Atmosphere on the Human in the Spaceflight Environment (NASA/TM-2013-217377), PDF p. 11: "the 8.0 psia and 32% oxygen (O2) environment were recommended for EVA-intensive phases of missions." <https://ntrs.nasa.gov/citations/20130013505>
- Fifteen-minute Extravehicular Activity Prebreathe Protocol Using NASA's Exploration Atmosphere (8.2 psia / 34% O2) (JSC-CN-29019), PDF p. 2: "This is a change from the previously defined Expl. Atm. of 8.0 psia, 32% O2, 68% N2, recommended in 2006 by the Exploration Atmospheres Working Group" <https://ntrs.nasa.gov/citations/20140000417>
- Risk Assessment of Physiological Effects of Atmospheric Composition and Pressure in Constellation Vehicles (no report number in NTRS record), PDF p. 1: "hypobaric (PB = 414 mmHg) and mildly hypoxic (ppO2 = 132 mmHg, 32% O2 - 68% N2) living environment is considered for the Crew Exploration Vehicle (CEV) and Lunar Surface Access Module (LSAM)" <https://ntrs.nasa.gov/citations/20070021378>

Notes: Historical design recommendation retained for comparison with the current Exploration Atmosphere. The 2007 Conkin et al. abstract is Constellation-era; the Constellation program is not the current Artemis architecture. ppO2 computed (0.32 x 8.0 psia x 6.894757); source gives 132 mmHg (17.6 kPa).

### `orion_cm_lunar_design_10p2`: Orion crew module design basis, lunar missions (up to 30 % O2 at 10.2 psia)

Orion Crew Exploration Vehicle crew module design atmosphere for lunar missions as stated in a 2009 NASA materials-flammability analysis.

- Pressure Effects on the Self-Extinguishment Limits of Aerospace Materials (NTRS abstract) (JSC-17943; 09ICES-0267), abstract: "The Orion Crew Exploration Vehicle Module (CM) is being designed to operate in an atmosphere of up to 30% oxygen at a pressure of 10.2 psia for lunar missions." <https://ntrs.nasa.gov/citations/20090012334>
- Pressure Effects on the Self-Extinguishment Limits of Aerospace Materials (NTRS abstract) (JSC-17943; 09ICES-0267), abstract: "Material flammability depends on both oxygen concentration and pressure but, since oxygen concentration is the primary driver, all materials are certified in the 30% oxygen, 10.2 psia environment." <https://ntrs.nasa.gov/citations/20090012334>

Notes: 2009 Constellation-era statement. Nominal O2 is not stated, so nominal is null and only the upper bound (30 %) is documented. Max ppO2 is computed (0.30 x 10.2 psia x 6.894757). Do not treat as the current Artemis Orion cabin; no current NASA document with Orion cabin numbers was found.

### `orion_cm_14p7_o2_limit`: Orion crew module at 14.7 psia (analysed max O2 25.6 %)

Upper oxygen concentration a 2009 NASA analysis found compatible with the 30 % O2 / 10.2 psia materials certification when the Orion CM is held at 14.7 psia.

- Pressure Effects on the Self-Extinguishment Limits of Aerospace Materials (NTRS abstract) (JSC-17943; 09ICES-0267), abstract: "This analysis showed that the oxygen concentration for the Orion CM at 14.7 psia cannot be set higher than 25.6% without potentially invalidating the materials flammability certification in 30% oxygen at 10.2 psia for some materials." <https://ntrs.nasa.gov/citations/20090012334>

Notes: Analysis result for a proposed pre-reentry oxygen increase, not a nominal operating point; nominal O2 is not stated (null). Max ppO2 computed (0.256 x 14.7 psia x 6.894757).

### `nasa_std_3001_crew_envelope`: NASA-STD-3001 crew-exposure envelope (indefinite exposure)

Outer bounds NASA-STD-3001 Vol. 2 sets for habitable cabin total pressure and diluent gas; an envelope, not an operating point.

- NASA-STD-3001, Volume 2, Revision F: Human Factors, Habitability, and Environmental Health (NASA-STD-3001 Vol. 2 Rev F), PDF p. 52: "The system shall maintain the pressure to which the crew is exposed to between 34.5 kPa < pressure ≤ 103 kPa (5 psia < pressure ≤ 15.0 psia) for indefinite human exposure without measurable impairments to health or performance." <https://standards.nasa.gov/system/files/tmp/NASA-STD-3001%20Vol%202%20Rev%20F.pdf>
- NASA-STD-3001, Volume 2, Revision F: Human Factors, Habitability, and Environmental Health (NASA-STD-3001 Vol. 2 Rev F), PDF p. 49: "Cabin atmospheric composition shall contain at least 30% diluent gas (assuming balance oxygen)." <https://standards.nasa.gov/system/files/tmp/NASA-STD-3001%20Vol%202%20Rev%20F.pdf>
- NASA-STD-3001, Volume 2, Revision F: Human Factors, Habitability, and Environmental Health (NASA-STD-3001 Vol. 2 Rev F), PDF p. 50: "this is a ppO2 of 7.35 psia, or 380 mmHg" <https://standards.nasa.gov/system/files/tmp/NASA-STD-3001%20Vol%202%20Rev%20F.pdf>

Notes: Pressure bounds are the V2 6006 requirement (lower bound exclusive, upper bound inclusive). O2 max 70 % is derived from the V2 6002 requirement of at least 30 % diluent gas with balance oxygen; it is not stated as a percentage. ppO2 max 7.35 psia (380 mmHg) is quoted from the V2 6003 rationale as the level generally accepted for constant exposure, not as a requirement limit; Rev F expresses the V2 6003 requirement in terms of inspired O2 partial pressure (Table 6.2-1), whose values could not be extracted from the PDF text. No nominal is defined.

### `skylab`: Skylab cabin (5 psia / ~70 % O2)

Skylab orbital workshop cabin atmosphere (historical).

- Effects of the 8 psia / 32% O2 Atmosphere on the Human in the Spaceflight Environment (NASA/TM-2013-217377), PDF p. 12: "Skylab missions were longer in duration, but still employed a low pressure (5 psia), high O2 (70%) environment." <https://ntrs.nasa.gov/citations/20130013505>
- Evidence Report: Risk of Hypobaric Hypoxia from the Exploration Atmosphere (JSC-CN-34806), PDF p. 5: "Skylab missions were longer in duration but still employed a low-pressure (5 psia), 70% O2 environment." <https://ntrs.nasa.gov/citations/20150021491>
- Oxygen Concentration Flammability Thresholds of Selected Aerospace Materials Considered for the Constellation Program (no report number in NTRS record), PDF p. 1: "Historically, the Apollo program used an oxygen concentration of 100 % by volume and Skylab used 70 % oxygen." <https://ntrs.nasa.gov/citations/20070018178>

Notes: Historical, not a target for new designs. Sources give 70 % without a tolerance. ppO2 computed (0.70 x 5.0 psia x 6.894757).

### `apollo_cm`: Apollo command module cabin (5 psia / ~100 % O2)

Apollo Command Module in-flight cabin atmosphere (historical).

- Apollo Experience Report: Command and Service Module Environmental Control System (NASA TN D-6718), PDF p. 4: "A 5.0-psia pure oxygen atmosphere was required in the pressurized CM" <https://ntrs.nasa.gov/citations/19720012252>
- Evidence Report: Risk of Hypobaric Hypoxia from the Exploration Atmosphere (JSC-CN-34806), PDF p. 5: "Early missions during the Gemini and Apollo programs were short duration and relied on low-pressure, 100% O2 environments." <https://ntrs.nasa.gov/citations/20150021491>
- Oxygen Concentration Flammability Thresholds of Selected Aerospace Materials Considered for the Constellation Program (no report number in NTRS record), PDF p. 1: "Historically, the Apollo program used an oxygen concentration of 100 % by volume and Skylab used 70 % oxygen." <https://ntrs.nasa.gov/citations/20070018178>

Notes: Historical. TN D-6718 also records a design criterion to maintain cabin pressure above 3.5 psia for 5 minutes under emergency conditions; that is an emergency criterion, not a nominal range, so min/max are null. 'Pure oxygen' is recorded as 100 %. ppO2 computed (5.0 psia x 6.894757).

## What could NOT be sourced (omitted rather than guessed)

- **Gateway (HALO/PPE)**: no NASA document retrieved states a design total pressure or O2 percentage. ICES-2025-402 (NTRS 20250006273) models HALO ventilation shutoff but the retrieved text gives no cabin pressure/O2 set point. An AsMA 2022 NASA slide deck (NTRS 20220005709) lists Gateway atmospheres only inside DRAFT lunar prebreathe scenarios (e.g. 14.7 psi/21 % or 10.2 psi/26.5 %) explicitly labelled as assumptions, so they are not recorded as Gateway profiles.
- **Artemis lander / Human Landing System and lunar surface habitat**: same AsMA 2022 deck lists lander atmospheres (10.2/26.5, 8.2/34, 14.7/21) only as draft scenarios. A 2022 NASA forum deck (NTRS 20220011152) says "Artemis habitat and suit atmospheric parameters have not been finalized". A 2007 Constellation-era table (NTRS 20070021378) lists lander and surface-habitat values (about 8.0 psia / 32 % and 7.6 psia / 32 % for habitats), but the text extraction of that table is ambiguous (two values per cell), so it is not recorded.
- **Current Orion (Artemis) cabin set point**: only the 2009 Constellation-era statements are recorded. A search-result summary of a journal article (not a NASA document/page, and not opened) described Orion as 14.7 psi, about 20 % O2; it is unverified and not used.
- **ISS minimum O2 percent and a tolerance on the 21 % nominal**: the ISS sources give ppO2 limits in mmHg (146 to 178), not a percent range. Only the 24.1 % maximum concentration is stated as a percent.
- **NASA-STD-6001 itself** (24.1 % worst-case test atmosphere): the standard was not retrieved. The 24.1 % / 14.7 psia ISS worst-case rests on Harper et al. 2016 and Hirsch et al. 2007.
- **Inspired-O2 table (NASA-STD-3001 Vol. 2 Rev F, Table 6.2-1)**: the table values are not recoverable from the PDF text layer; only the rationale quotes are used. Rev A (historical) stated ppO2 20.7 to 50.6 kPa and pressure 20.7 to 103 kPa; Rev F states pressure 34.5 to 103 kPa and a PIO2 table. Rev F was approved 2026-07-14 per its cover page.
- **Per-profile airflow**: no NASA document ties a velocity range to a specific atmosphere profile, so every profile has `airflow_cm_s: null` and the single top-level `ventilation` band applies.

## Not included (could not be verified)

None. Independent verification (2026-11-15) found no unverifiable profile; all 11 profiles retained. Corrections applied: `doc_number` for NTRS 20090012334 changed from "SAE 2009-01-2490" (not in the NTRS record) to the NTRS report numbers "JSC-17943; 09ICES-0267"; `orion_cm_14p7_o2_limit` status changed to `historical_nasa` (a 2009 conference-paper analysis, not a design recommendation); `shuttle_staged_pre_eva` notes now flag the 30 % vs 26.5 % conflict and attribute the 30 % / 10.2 psia certification to Orion. Ventilation band re-checked against the HIDH Rev 1 PDF (p. 368), NASA-STD-3001 Vol. 2 Rev F PDF (p. 61) and the nasa.gov web page (section 6.2.7.1): quotes and numbers confirmed.

## Method and caveats

- Documents were downloaded from ntrs.nasa.gov and nasa.gov and text-extracted with pypdf; each quote was verified to occur in the extracted text, ignoring whitespace, line breaks and subscript spacing (for example "ppO 2" extracted from a subscript is written "ppO2"). The Orion quotes come from the NTRS abstract (no PDF available).
- `page` is the PDF page index at which the quote starts. Printed page numbers differ (HIDH PDF p. 368 is printed p. 363).
- URLs were checked with `curl -sIL` and returned HTTP 200 (nasa.gov URLs via a 301 redirect). The NASA-STD-3001 Rev F URL is under `standards.nasa.gov/system/files/tmp/`, which may be a temporary path; the same ventilation sentence is also cited from the nasa.gov web page.
- The 2013 NASA/TM-2013-217377 and the 2015 evidence report are NASA-authored reports; the 2013 prebreathe deck and 2007/2009 items are conference/slide/abstract material, which is why Exploration Atmosphere, EAWG and Orion profiles are `nasa_design_recommendation` rather than `documented_nasa`.
