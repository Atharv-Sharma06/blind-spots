# Future work

**Nothing on this page is implemented.** The implemented system is described in [architecture.md](architecture.md) and the README; known weaknesses are in [limitations.md](limitations.md).

## Data
- Integrate further NASA investigations when per-test public data exist (for example SoFIE-GEL, SoFIE-MIST, Saffire-V/VI per-test tables, JAXA FLARE), keeping their own apparatus or scale as a model covariate or as separate groups. This is the most direct way to reduce the "not represented in the integrated records" gaps, especially at reduced pressure and elevated O2.
- Obtain measured pressure and outcome tokens for the BASS-II tests (currently assumed pressure and order-implied labels), and recover the final unrecorded setting of each schedule.
- Add partial-gravity data (Lunar and Martian gravity) when it becomes available in PSI; keep it clearly separate from microgravity.
- Replace borrowed flow calibrations with per-test measured flows where the raw time series permit.

## Model
- Learn a pressure effect once data at more than one pressure are integrated, replacing the fixed length scale; until then keep the sensitivity analysis.
- Hierarchical or multi-group models that share strength across material families and configurations (with explicit group effects) to address the small per-group samples.
- Time-series (spread-rate, flame-position) targets in addition to the binary sustained / not-sustained outcome.
- Proper handling of censored and ordered outcomes (a step is sustained until a later step extinguishes), instead of treating steps as independent rows within an experiment.
- Calibration refinements (for example temperature scaling per group) and a larger blind-spot study with more groups and experiments.

## Active learning
- Acquisition over single points and batch designs that respect which factors can vary within one test (a flow schedule at fixed O2), rather than whole experiments.
- Cost- and risk-aware acquisition, and acquisition for several targets at once (a mission-profile mix).
- A more informative retrospective benchmark (more scenarios, independent targets, paired tests across scenarios).

## Product
- Exportable research briefs with citations (the `/api/brief` endpoint exists; layout, PDF export and review workflow do not).
- Side-by-side investigation comparison pages and richer source browsing.
- Authenticated analyst annotations and an audit trail of curation decisions.
- Optional 3D view of the parameter space (deliberately out of scope for the submission, D-010).
- Automated end-to-end tests of every page in snapshot and live modes in CI; container image and one-click deployment.

## Governance
- Expert review of curation interpretations by the original investigators or NASA PSI staff.
- A project licence and contribution guide; a versioned public changelog of datasets and models.
