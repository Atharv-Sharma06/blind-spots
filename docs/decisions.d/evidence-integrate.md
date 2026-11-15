# evidence-integrate (2026-11-15)

- Context investigations are one per NTRS document (`NTRS-<id>`); Saffire-IV/V share NTRS-20210011521, acronym lists the shorts. Drop-tower rows keep the CSV's long `investigation_short` as experiment-id prefix and campaign_group (spec rule), so ids contain spaces and two colons.
- Context geometry: `slab` for slab/flat PMMA, `fabric_strip` for fabric, `flat_sheet` for film, else null. Material family `pmma_slab` only for PMMA that is slab/flat; Cotton Jersey, Mylar, structured PMMA are `other`. Thickness/sample dimensions are not parsed (kept in notes_raw via raw_text only).
- observed_outcome words: burns, extinguished (from extinguishes/extinguished), ignition_failed (from "No Ignition"); spread-rate cells stay `unknown` (not an explicit outcome).
- Config-change report diffs against `data/normalized/experiments.json` as it stood before the build (no git use).
- Step CSV loader accepts the three optional evidence columns only at the end; any other header deviation is still reported.
