# Blind Spots HTTP API (exact shapes)

Supersedes the endpoint table in `CONTRACTS.md` §8 where they differ. Server: FastAPI in
`services/analysis/src/blindspots/api/` (request/response Pydantic models in `api/models.py`).
Client: `apps/web/lib/types.ts` mirrors these shapes exactly. All numbers are JSON numbers; missing
values are `null`. Units are in field names (`_percent`, `_kpa`, `_cm_s`).

## Concepts

- **Analysis group** (`group_id`): the unit of modelling and coverage = one material family + one flame
  configuration, e.g. `pmma_rod__stagnation`, `sibal_fabric__concurrent`. Observations are only compared
  within a group (CONTRACTS §4 "comparable"). Groups with too little data have `model_status:
  "insufficient_data"`; their coverage still works, predictions do not.
- **Target**: either `{"profile_id": "<id from /api/targets>"}` or
  `{"custom": {"label": str, "oxygen_percent": Range, "total_pressure_kpa": Range, "airflow_cm_s": Range|null}}`.
  Custom targets are always labelled "User-selected hypothetical conditions".
- `Range = {"nominal": number, "min": number|null, "max": number|null}`.
- **Verdict** ∈ `supported | extrapolation | insufficient_evidence`. Reasons are
  `{"code": str, "message": str, "value": number|null}` with codes `sparse_observations`, `outside_hull`,
  `unobserved_pressure`, `outcome_variability`, `model_instability`, `other_family_evidence_only`,
  `high_knowledge_uncertainty`, `target_points_not_supported`, `point_verdicts` (target-level basis: value =
  share of target points supported), `no_model` (group not modelled). Point rule and wording come from
  `blindspots.uncertainty.explanations` (the API calls it).
- **NaN / Infinity** anywhere in a request (JSON body or numeric query) is a 422 `validation_error`; validation
  error details never echo the input.
- **Errors** (non-2xx only): `{"error": {"code", "message", "details"}}` with codes `validation_error` 422,
  `not_found` 404, `artifact_missing` 503, `ingestion_failure` 500, `internal` 500 (405 wrong method also uses
  `validation_error`). The web proxy maps
  network failures to `backend_unavailable`. Scientific limits are never errors.
- **Caching and load**: model responses are memoized per canonical request and artifact versions. At most 2
  `candidates/rank` or `candidates/counterfactual` computations run at once (further requests wait; a queued
  request identical to a finished one is served from the cache), so bursts of parallel ranks do not multiply
  memory use.

## Endpoints

### GET /api/health
`{"status": "ok"|"degraded", "dataset_version": str|null, "model_version": str|null,
  "artifacts": {"dataset": bool, "models": bool, "validation": bool}, "api_version": "1"}`

### GET /api/investigations
`Investigation[]` (CONTRACTS §3).

### GET /api/groups
```json
[{"group_id": "pmma_rod__stagnation", "material_family": "pmma_rod", "flame_configuration": "stagnation",
  "label": "PMMA rods · axial stagnation flow", "campaigns": ["BASS-II/Olson"],
  "n_experiments": 27, "n_observations": 160, "n_training": 131,
  "label_counts": {"sustained": 101, "not_sustained": 30},
  "oxygen_percent_range": [13.6, 22.2], "airflow_cm_s_range": [0.2, 38.0],
  "pressure_kpa_range": [101.3, 101.3], "pressure_measured": false,
  "model_status": "modeled" | "insufficient_data", "model_reason": null | "fewer than 3 not-sustained observations"}]
```
(values illustrative of shape only)

### GET /api/experiments?investigation=&group=&q=&included=
`ExperimentRecord[]` plus `"group_id"` on each record. `q` searches label, material, notes.
### GET /api/experiments/{experiment_id}
`{"experiment": ExperimentRecord & {"group_id"}, "observations": Observation[]}`; 404 `not_found`.
### GET /api/observations?group=
`Observation[]` (+ `group_id`).
### GET /api/export/experiments.csv?investigation=&group=
`text/csv` of normalized experiment records (header row = ExperimentRecord fields). `group` (here and on
`/api/experiments`) accepts any `group_id` that appears on a record, including groups that exist only on context
records (e.g. `other__concurrent`, `other__opposed`, `ultem_sheet__concurrent`); 404 only for ids on no record.

### GET /api/targets
`{"profiles": AtmosphereProfile[], "ventilation": {"min_cm_s", "max_cm_s", "sources"} | null}`

### GET /api/context
Context-only evidence (never used in models):
`{"not_integrated": [{"id","name","agency","platform","years","oxygen_percent_range","pressure_kpa_range",
  "flow_cm_s_range","data_availability","reason_not_integrated","sources":[{"url","quote"}]}],
  "ground_flammability": [{"material","total_pressure_kpa","oxygen_percent","result","result_definition",
  "source_title","source_url","page","table"}],
  "context_experiments": ExperimentRecord[]}`
`context_experiments` = every experiment whose investigation role is `integrated_context` (Saffire-I/III and
any transcribed context tables such as Saffire-IV–VI, drop-tower or sounding-rocket tests): real documented
conditions shown on the map as context, never used for modelling.

### GET /api/coverage?group=&plane=&slice=&nx=&ny=&x_min=&x_max=&y_min=&y_max=
`plane` = `o2_flow` (x = O2 %, y = airflow cm/s on a log axis, slice = pressure kPa, default 101.3) or
`o2_pressure` (x = O2 %, y = pressure kPa, slice = airflow cm/s, default 10). Defaults: x 10–40 %,
airflow 0.2–50 cm/s, pressure 30–110 kPa, nx = 61, ny = 41. Validation (422): numbers finite, min < max,
O2 axis within 0–100 %, y axis and slice within (0, 1000] (kPa or cm/s).
```json
{"group_id": "...", "plane": "o2_flow",
 "slice": {"variable": "pressure_kpa", "value": 101.3, "unit": "kPa"},
 "x": {"variable": "oxygen_percent", "unit": "%", "scale": "linear", "values": [/* nx */]},
 "y": {"variable": "airflow_cm_s", "unit": "cm/s", "scale": "log", "values": [/* ny */]},
 "nn_distance": [[/* ny rows × nx */]], "comparable_count": [[]], "inside_hull": [[]],
 "sparse_threshold": 1.0, "scales": {"o2": 2.0, "flow": 0.5, "p": 0.1},
 "observations_in_slice": ["observation_id", ...]}
```
`observations_in_slice` = observations whose slice coordinate is within 1 scale unit of the slice value.

### GET /api/surface?group=&plane=&slice=&nx=&ny=&x_min=&x_max=&y_min=&y_max=
Same axes as `/api/coverage`, plus (each `ny × nx`):
`"p_sustained", "latent_std_ratio", "epistemic", "aleatoric", "total", "verdict"` and
`"model_id", "model_version", "model_status"`. When `model_status != "modeled"` the grids are `null`.

### POST /api/predict
Request `{"group_id": str, "points": [{"oxygen_percent", "airflow_cm_s", "pressure_kpa"}]}` (≤ 2000 points).
Response `{"group_id", "model_version", "predictions": [{"point", "p_sustained", "latent_mean", "latent_std",
"latent_std_ratio", "epistemic", "aleatoric", "total", "verdict", "reasons"}]}`.

### POST /api/target/assess
Request `{"group_id": str, "target": Target}`. Response:
```json
{"group_id": "...", "target": {"label", "status", "oxygen_percent": Range, "total_pressure_kpa": Range,
   "airflow_cm_s": Range, "airflow_band_source": "profile"|"ventilation_standard"|
   "ventilation_standard_with_near_quiescent_extension"|"default_band"|"custom", "airflow_band_note": str|null,
   "profile_id": str|null, "kind": "operating_point", "flags": [str], "sources": []},
 "coverage": {"n_target_points": 45, "comparable_observations": 0, "points_with_comparable": 0,
   "nn_distance_min": 4.2, "nn_distance_median": 5.1, "fraction_inside_hull": 0.0,
   "nearest_observations": [{"observation_id", "experiment_id", "distance", "oxygen_percent",
      "airflow_cm_s", "pressure_kpa", "label"}]},
 "model": {"model_status": "modeled", "p_sustained_mean": 0.71, "p_sustained_min": 0.40,
   "p_sustained_max": 0.90, "latent_std_ratio_mean": 0.97, "epistemic_mean": 0.31, "aleatoric_mean": 0.40},
 "verdict": "insufficient_evidence", "points_supported": 0,
 "point_verdicts": {"supported": 0, "extrapolation": 0, "insufficient_evidence": 9},
 "reasons": [{"code", "message", "value"}],
 "documented_context": [{"id", "name", "overlap": "contains_target_nominal" | "overlaps_target_region",
   "data_availability", "reason_not_integrated"}],
 "investigation_relevance": [{"id", "name", "role": "integrated_model"|"integrated_context"|
   "documented_not_integrated"|"catalogued_not_integrated", "relevance_rank": 1,
   "comparable_observations": int|null, "comparable_records_all_groups": int|null,
   "nearest_distance": number|null, "envelope_overlap": "contains_target_nominal"|"overlaps_target_region"|
   "outside_target_region"|"not_documented"|null, "doi": str|null, "url": str|null, "summary": str}],
 "summary": "Deterministic sentence(s) built from the numbers above."}
```
**Verdict (LEAD_DECISIONS D2).** Each target point gets the point verdict (supported = inside the observed
region or ≥ 3 comparable observations, and latent std ratio < 0.6). Target verdict: `supported` when ≥ 50 % of
the points are supported; `insufficient_evidence` when no point has a comparable observation; otherwise
`extrapolation`. `points_supported` / `coverage.n_target_points` is always reported. `model.p_sustained_*` are
computed over the **supported points only** (weights renormalised) and are `null` when none is supported.
`reasons[0]` is always the numeric basis (`point_verdicts`), so the list is never empty. The summary says
"not represented in the integrated records" **only** when `coverage.points_with_comparable == 0` (never "not
studied"); with partial coverage it says how many points are covered.
`documented_context` lists not-integrated investigations (`/api/context` → `not_integrated`) whose documented
O2/pressure/flow ranges contain or overlap the target.
`investigation_relevance`: every catalogued investigation ranked by relevance to the target (deterministic):
integrated training investigations with comparable observations in this group first, then context records near
the target and documented envelopes containing/overlapping it, then the rest; PSI catalogued investigations
(not solid-fuel flammability data) last. `comparable_observations` (integrated, this group),
`comparable_records_all_groups` (records within one reference distance, any group), `nearest_distance`
(reference distances to the target region), `envelope_overlap` (documented envelopes; context investigations
take it from the matching manifest entry). `summary` is one sentence built from these numbers and manifest
fields only.

### POST /api/candidates/rank
Request `{"group_id": str, "target": Target, "k": 3, "assumptions": {"pressure_length_scale": 0.3}}`.
```json
{"group_id": "...", "target": {/* resolved */}, "status": "ok"|"no_eligible_candidates"|"no_informative_candidates"|"model_unavailable",
 "candidates": [{"candidate_id": "c1", "rank": 1, "oxygen_percent": 28.0, "pressure_kpa": 70.3,
   "airflow_cm_s": 3.2, "evr": 0.84, "evr_fraction": 0.21, "marginal_evr_fraction": 0.21,
   "mi_reduction_fraction": 0.18, "p_sustained": 0.55|null, "latent_std_ratio": 0.95, "nn_distance": 3.1,
   "verdict": "supported"|"extrapolation"|"insufficient_evidence", "target_distance": 0.0,
   "feasibility_status": "within_demonstrated_envelope"|"outside_demonstrated_envelope",
   "feasibility_note": "...", "reasons": [{"code", "message", "value"}], "explanation": "...",
   "related_documented_investigations": [{"id", "name", "data_availability", "note"}]}],
 "baselines": {"random": Candidate, "uncertainty_sampling": Candidate, "nearest_gap": Candidate},
 "sensitivity": [{"pressure_length_scale": 0.15, "top_candidate": Candidate, "same_top_as_default": true}],
 "assumptions": ["..."], "candidate_domain": {"oxygen_percent": [12, 40], "pressure_kpa": [50, 103],
   "airflow_cm_s": [0.5, 45]},
 "disclaimer": "Computational research candidate requiring qualified scientific review, established safety procedures and formal feasibility assessment."}
```
Candidate `reasons` codes: `expected_uncertainty_reduction` (always first; value = evr_fraction, so "why" is
never empty), `at_target_conditions` (within 1 reference distance of the target: "the most informative single
experiment is at the target conditions themselves; this follows from the model's distance-based (stationary)
correlation assumption"), `high_target_covariance`, `high_candidate_uncertainty`, `near_decision_boundary`,
`fills_coverage_gap`, `assumption_dependent` (value depends mainly on the assumed pressure correlation).
`p_sustained` is `null` unless the candidate's point verdict (`verdict`) is `supported`. `target_distance` =
reference distance to the nearest target point. `rank` is `null` for baselines and compare a/b; `baselines` is
`null` unless `status == "ok"`; baselines are scored with the same expected uncertainty reduction ("the expected
reduction if this baseline's pick were tested instead").
`related_documented_investigations`: not-integrated investigations whose documented envelope contains the
candidate (note: "Inside the documented test envelope of <name>; existing data may already inform this
candidate (not integrated: <reason>).").

### POST /api/candidates/compare
Request `{"group_id", "target", "a": {"oxygen_percent","airflow_cm_s","pressure_kpa"}, "b": {...}}`.
Response `{"a": Candidate, "b": Candidate, "both_evr_fraction": number, "preferred": "a"|"b"|"indistinguishable",
"reasons": [...], "assumptions": [...]}`. `indistinguishable` when the EVR fractions differ by less than
the documented tolerance or the preference flips under the pressure-length-scale sensitivity check.

### POST /api/candidates/counterfactual
Request `{"group_id", "target", "candidate": {"oxygen_percent","airflow_cm_s","pressure_kpa"},
"plane": "o2_flow"|"o2_pressure"|null, "slice": number|null, "x_min"?: number|null, "x_max"?: number|null}`.
`x_min`/`x_max` (optional, same meaning and validation as `/api/surface`) set the oxygen axis of the scenario
surfaces (61 x 41 grid), so far targets (Skylab, Apollo) get what-if grids on the extended axis; 422 on invalid
ranges.
```json
{"p_sustained_at_candidate": 0.55|null, "target_p_supported": true, "target_points_supported": 15,
 "n_target_points": 27,
 "current": {"target_p_mean": 0.62|null, "target_latent_var": 2.1, "target_epistemic": 0.30},
 "scenarios": [
   {"outcome": "sustained", "label": "Hypothetical outcome: flame sustained", "probability": 0.55,
    "target_p_mean": 0.70, "target_latent_var": 1.6, "target_epistemic": 0.22, "variance_reduction_fraction": 0.24,
    "surface": {"p_sustained": [[]], "latent_std_ratio": [[]]} | null},
   {"outcome": "not_sustained", "label": "Hypothetical outcome: flame not sustained", "probability": 0.45, "...": "..."}],
 "expected_variance_reduction_fraction": 0.22,
 "note": "Hypothetical outcomes and model updates; not experimental results."}
```
`target_p_mean` (current and per scenario) = weighted mean P(sustained) over the currently supported target
points; `null` when no target point is supported (`target_p_supported: false`). `p_sustained_at_candidate` is
`null` unless the candidate point is supported.

### GET /api/model/metadata?group=
Model card: `{"model_id", "model_version", "group_id", "algorithm", "features", "hyperparameters",
"fixed_hyperparameters", "priors", "training": {"n_observations", "n_experiments", "label_counts",
"confidence_included", "filters"}, "seed", "trained_at", "dataset_version", "limitations": [str]}`.

### GET /api/model/validation
```json
{"generated_at", "dataset_version", "model_version",
 "groups": [{"group_id", "n_experiments", "n_observations",
   "cv": {"scheme": "grouped 5-fold by experiment × 5 repeats",
      "models": [{"name", "brier": {"value", "ci95"}, "log_loss": {...}, "auc": {...}, "ece": {...}}]},
   "logo": {"applicable": bool, "folds": [{"held_out", "n", "brier", "log_loss", "auc"}]},
   "reliability": {"model": "GP", "bins": [{"lo", "hi", "count", "mean_predicted", "observed_frequency"}]},
   "error_distribution": {"bins": [...], "counts": [...]},
   "subgroups": [{"name", "n", "brier", "log_loss"}],
   "sensitivity": [{"variant", "n_training", "brier", "log_loss", "auc", "delta_vs_primary"}],
   "blindspot_test": {"point_level": {"n", "spearman_rho", "p_value", "auroc_error_detection"},
      "group_level": {"n_groups", "spearman_rho", "p_value", "pairs": [{"experiment_id", "pre_reveal_uncertainty", "error"}]},
      "verdict": "supported"|"not_supported"|"inconclusive", "interpretation": str}}],
 "acquisition_retrospective": {"scenarios": [{"name", "group_id", "target_definition", "n_seeds", "n_rounds",
   "metric": "target log loss",
   "curves": {"evr": [{"n_acquired", "mean", "ci95"}], "uncertainty_sampling": [...], "nearest_gap": [...], "random": [...]},
   "area_under_curve": {"evr": number, "...": number}, "interpretation": str}]}}
```

### GET /api/methodology
`{"versions": {"dataset_version", "model_version", "pipeline_version", "api_version"},
"config": {"training_filter", "coverage_scales", "support_thresholds", "candidate_domain", "seeds",
"pressure_length_scale_default", "pressure_length_scale_sensitivity", "pressure_length_scale_fixed",
"training_flow_provenance": {"n_training", "n_recorded", "n_converted_bass2_calibration",
"n_borrowed_calibration", "n_below_calibration_range"}|null}, "dates": {"data_retrieved": "2026-11-15",
"last_analysis"}, "limitations": [str], "repository_url": str|null}`. `support_thresholds` also states the point
and target verdict rules. `training_flow_provenance` counts the training steps (included and labelled) by airflow
basis: recorded = duct reading or a value stated in the source; converted = fan or pot setting via the BASS-II
calibration (not borrowed); the airflow-provenance limitation sentence uses the same numbers. Limitations are computed from the data (airflow provenance counts, context investigations,
stationarity of the kernel). `repository_url` comes from the env var `BLINDSPOTS_REPOSITORY_URL` (null if unset).

### GET /api/headline?profiles=
Per-cabin coverage summary, computed from the store (about 10 ms for all profiles, no caching needed).
**Default (no parameter): every operating-point profile of the atmosphere manifest** (the cabin cards of the home
page). Envelope profiles (`kind: "envelope"`, e.g. `nasa_std_3001_crew_envelope`) are context only and are not
listed. Order: `iss_cabin_nominal`, `artemis_surface_habitat_10p2_26p5`, `exploration_atmosphere_8p2_34`,
`orion_cm_lunar_design_10p2`, `orion_cm_14p7_o2_limit`, `shuttle_nominal`, `shuttle_staged_pre_eva`, `skylab`,
`apollo_cm`, `iss_materials_worst_case`, `eawg_2006_8p0_32`, then any other operating-point profile in manifest
order. A profile missing from the manifest is omitted, never invented. The response shape does not depend on the
number of profiles. With `profiles` (comma-separated ids) the earlier subset behaviour is kept: the two guaranteed
profiles (ISS nominal, NASA Exploration Atmosphere) followed by the listed ids (404 for an unknown id, 422 for an
envelope id). The snapshot exporter stores the default (no-parameter) response as `GET /api/headline`.
```json
{"profiles": [{"profile_id": "iss_cabin_nominal", "label": "...", "status": "documented_nasa",
   "oxygen_percent": 21, "total_pressure_kpa": 101.353, "n_target_points": 27,
   "comparable_observations": 241, "groups_with_comparable": 19, "n_groups": 20,
   "by_group": [{"group_id", "label", "comparable_observations", "points_with_comparable"}]}],
 "envelope": {"investigations": ["BASS-II", "BASS"], "n_experiments": 210, "n_steps": 565,
   "oxygen_percent": [13.5, 22.7], "pressure_kpa": [98.3, 102.2], "pressure_measured_kpa": [98.3, 102.2],
   "n_steps_pressure_assumed": 419, "airflow_cm_s": [0.0, 53.3]}}
```
`comparable_observations` = training observations (any analysis group, each compared within its group) within
one reference distance of the profile's target region; `n_groups` = groups with training evidence;
`groups_with_comparable` = groups with at least one such observation; `by_group` is sorted by
`comparable_observations` descending, then `group_id`. The home page status chip derives from these three numbers
only: 0 comparable = "Not covered", `groups_with_comparable / n_groups < 0.9` = "Barely covered", else "Covered" (the
share is `COVERED_MIN_SHARE` in `apps/web/components/home/cabins.ts`; a stricter-than-half rule keeps a green chip from
contradicting the per-material answer, as for the ISS worst case with 12 of 20 materials).
The `envelope` spans all training observations (`pressure_kpa` uses the documented 101.353 kPa assumption for BASS-II rows,
counted in `n_steps_pressure_assumed`; `pressure_measured_kpa` spans measured values only).

### GET /api/sources
`{"investigations": Investigation[], "publications": [{"title", "doi", "url", "investigation_id"}],
"atmosphere_sources": SourceRef[], "other_investigations": [...], "ground_data_sources": [...],
"raw_files": [{"path", "psi_file_name", "sha256", "investigation_id"}]}`

### POST /api/brief
Request `{"group_id", "target", "candidate": {"oxygen_percent","airflow_cm_s","pressure_kpa"} | null}`.
Response `{"title", "generated_at", "dataset_version", "model_version", "markdown": str,
"sections": {"target", "coverage", "model", "candidate", "historical_investigations", "citations",
"limitations"}}`. Contains no operational test instructions. `candidate: null` → the system's
"top-ranked candidate (default assumptions)"; an explicit candidate → "selected candidate" (plus "(rank k under
default assumptions)" when it equals a ranked candidate). Both include the pressure-sensitivity line (expected
uncertainty reduction at 0.15 / 0.3 / 0.6) and the assumptions list. The relevant-investigations section lists
the top `investigation_relevance` rows.

## Static snapshot (deployment without the Python service)

`uv run blindspots export-artifacts --snapshot ../../apps/web/public/snapshot` writes the JSON responses
of every GET endpoint above (default parameters, every group, every experiment detail), `coverage` and
`surface` for every group × plane × snapshot slice (`o2_flow` slices = pressures 101.3, 70.3, 56.5, 34.5 kPa
plus every documented profile's nominal pressure; `o2_pressure` slices = airflow 1, 3, 10, 20 cm/s) at default
axes, and `target/assess`, `candidates/rank` (default assumptions, k = 3) and `candidates/counterfactual`
(each of the 3 ranked candidates, on both planes at the profile's nominal slice) for every documented profile
× every group, plus `brief` for each profile × modelled group (top candidate). Also `manifest.json`:
`{"generated_at", "dataset_version", "model_version", "slices": {"o2_flow": [...], "o2_pressure": [...]},
"entries": {"<KEY>": "<relative file>"}}`. KEY format: `GET /api/<path>` + (`?` + query params sorted by
name, `k=v` joined by `&`, omitted when empty) for GETs; `POST /api/<path> ` + canonical JSON of the body
(keys sorted recursively, no spaces) for POSTs. Both sides must build keys with the same function.

Data modes in the web app (`NEXT_PUBLIC_DATA_MODE`): `live` (API only), `snapshot` (never calls the API;
used for the static Vercel deployment), `auto` (default: live first, snapshot on `backend_unavailable`).
In snapshot mode the slice control snaps to `manifest.slices`, custom targets and arbitrary candidates show
an honest "requires the live analysis service" state, and a "Precomputed snapshot · <model_version>" badge
is always visible.
