// Unit tests for pure data-layer functions. Run: node --test tests/unit/
// Node strips the TypeScript types; the tested modules have no runtime relative imports.
import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalJson,
  snapshotKey,
  snapshotKeyCandidates,
  normalizeKey,
  parseSnapshotKey,
  parseDataMode,
  snapSlice,
  loadSnapshotManifest,
  resetSnapshotCache,
  resolveSnapshotFile,
  SnapshotError,
} from "../../lib/snapshot.ts";
import * as fmt from "../../lib/format.ts";
import { INSUFFICIENT_EVIDENCE_TEXT } from "../../lib/copy.ts";
import {
  decodeTarget,
  encodeTarget,
  parseExploreQuery,
  serializeExploreQuery,
  pickDefaultGroup,
  pickDefaultProfile,
  useExploreStore,
  withLayer,
  deriveTargetSlices,
  DEFAULT_LAYERS,
} from "../../lib/explore-store.ts";

// ---- snapshot keys -------------------------------------------------------------------------

test("GET key: params sorted by name, omitted when empty", () => {
  assert.equal(snapshotKey("GET", "/api/health"), "GET /api/health");
  assert.equal(snapshotKey("GET", "/api/health", {}), "GET /api/health");
  assert.equal(
    snapshotKey("GET", "/api/coverage", { slice: 101.3, group: "g", plane: "o2_flow", nx: undefined, ny: null, q: "" }),
    "GET /api/coverage?group=g&plane=o2_flow&slice=101.3",
  );
});

test("POST key: canonical JSON, keys sorted recursively, no spaces", () => {
  const body = { target: { profile_id: "p" }, group_id: "g", k: 3, assumptions: { pressure_length_scale: 0.3 } };
  assert.equal(
    snapshotKey("POST", "/api/candidates/rank", body),
    'POST /api/candidates/rank {"assumptions":{"pressure_length_scale":0.3},"group_id":"g","k":3,"target":{"profile_id":"p"}}',
  );
  assert.equal(canonicalJson({ b: [{ z: 1, a: null }], a: undefined }), '{"b":[{"a":null,"z":1}]}');
});

test("keys round-trip through parseSnapshotKey", () => {
  for (const key of [
    "GET /api/health",
    "GET /api/coverage?group=pmma_rod__stagnation&plane=o2_flow&slice=70.3",
    'POST /api/target/assess {"group_id":"g","target":{"profile_id":"iss_cabin_nominal"}}',
  ]) {
    const p = parseSnapshotKey(key);
    assert.ok(p, key);
    assert.equal(snapshotKey(p.method, p.path, p.method === "GET" ? p.query : p.body), key);
  }
});

test("key candidates: exact first; defaults and integral floats are tolerated", () => {
  const c = snapshotKeyCandidates("GET", "/api/coverage", { group: "g", nx: 61, plane: "o2_flow" });
  assert.equal(c[0], "GET /api/coverage?group=g&nx=61&plane=o2_flow");
  assert.ok(c.includes("GET /api/coverage?group=g&plane=o2_flow&slice=101.3"));
  assert.equal(normalizeKey("GET /api/coverage?slice=10.0&x=1.05"), "GET /api/coverage?slice=10&x=1.05");
  const r = snapshotKeyCandidates("POST", "/api/candidates/rank", { group_id: "g", target: { profile_id: "p" } });
  assert.ok(r.includes('POST /api/candidates/rank {"assumptions":{"pressure_length_scale":0.3},"group_id":"g","k":3,"target":{"profile_id":"p"}}'));
  const e = snapshotKeyCandidates("GET", "/api/experiments/PSI-26%3A85%2F117");
  assert.ok(e.includes("GET /api/experiments/PSI-26:85/117"));
});

test("data mode parsing defaults to auto", () => {
  assert.equal(parseDataMode(undefined), "auto");
  assert.equal(parseDataMode("bogus"), "auto");
  assert.equal(parseDataMode("snapshot"), "snapshot");
  assert.equal(parseDataMode("live"), "live");
});

test("snapSlice picks the nearest manifest slice", () => {
  const slices = { o2_flow: [34.5, 56.5, 70.3, 101.3], o2_pressure: [1, 3, 10, 20] };
  assert.equal(snapSlice("o2_flow", 80, slices), 70.3);
  assert.equal(snapSlice("o2_pressure", 12, slices), 10);
  assert.equal(snapSlice("o2_flow", 80, null), null);
});

// ---- format ------------------------------------------------------------------------------------------

test("missing values render as an em dash, never 0", () => {
  assert.equal(fmt.fmtFixed(null), "—");
  assert.equal(fmt.fmtKpa(undefined), "—");
  assert.equal(fmt.fmtCmS(NaN), "—");
  assert.equal(fmt.fmtFixed(-0.001, 1), "0.0");
  assert.equal(fmt.fmtFixed(-2.5, 1), "−2.5");
});

test("units and conversions", () => {
  assert.equal(fmt.fmtKpa(101.353), "101.4 kPa");
  assert.equal(fmt.fmtPressure(101.353), "101.4 kPa (14.7 psia)");
  assert.equal(fmt.fmtPercent(21), "21.0%");
  assert.equal(fmt.fmtFractionPercent(0.714), "71%");
  assert.equal(fmt.fmtCmS(3.2), "3.20 cm/s");
  assert.equal(fmt.fmtCmS(12.34), "12.3 cm/s");
  assert.equal(fmt.fmtCount(1234567), "1,234,567");
  assert.equal(fmt.fmtSigned(0.04), "+0.04");
});

test("ranges never invent a nominal", () => {
  assert.equal(fmt.fmtRange({ nominal: 21, min: null, max: 24.1 }, "%"), "21.0 %");
  assert.equal(fmt.fmtRange({ nominal: null, min: null, max: 24.1 }, "%"), "up to 24.1 %");
  assert.equal(fmt.fmtRange({ nominal: 101.353, min: 96.527, max: 102.732 }, "kPa"), "101.4 kPa (96.5–102.7)");
  assert.equal(fmt.fmtRange(null), "—");
});

test("verdict, flame-state and feasibility labels use the exact wording", () => {
  assert.equal(fmt.verdictText("insufficient_evidence"), INSUFFICIENT_EVIDENCE_TEXT);
  assert.equal(fmt.verdictLabel("extrapolation"), "Extrapolation");
  assert.equal(fmt.flameStateLabel(1), "Flame sustained");
  assert.equal(fmt.flameStateLabel(0), "Flame not sustained");
  assert.equal(fmt.outcomeLabel("not_sustained"), "Flame not sustained");
  assert.equal(fmt.feasibilityLabel("outside_demonstrated_envelope").disclaimer, "Feasibility not verified; requires qualified review.");
  assert.equal(
    fmt.feasibilityLabel("within_demonstrated_envelope").disclaimer,
    "Inside conditions already run in the integrated investigations; not an engineering feasibility assessment.",
  );
  assert.match(fmt.airflowBandSourceLabel("ventilation_standard_with_near_quiescent_extension").explanation, /analysis choice/);
  assert.match(fmt.notRepresentedText(["SoFIE-GEL"]), /not represented in the integrated records/);
  assert.doesNotMatch(fmt.notRepresentedText(["SoFIE-GEL"]), /not studied/i);
});

// ---- explore store -----------------------------------------------------------------------------------------

const group = (group_id, model_status, n_training, n_observations = n_training) => ({ group_id, model_status, n_training, n_observations });

test("default group: the API's is_default flag, else modelled with most training rows", () => {
  const gs = [group("a", "modeled", 10), group("b", "modeled", 30), group("c", "insufficient_data", 99)];
  assert.equal(pickDefaultGroup(gs).group_id, "b");
  assert.equal(pickDefaultGroup([...gs, { ...group("d", "modeled", 5), is_default: true }]).group_id, "d");
});

test("default profile skips the envelope", () => {
  const ps = [{ profile_id: "nasa_std_3001_crew_envelope", kind: "envelope" }, { profile_id: "x" }];
  assert.equal(pickDefaultProfile(ps).profile_id, "x");
});

test("URL query round-trips group, plane, profile and custom targets", () => {
  const custom = {
    custom: {
      label: "Hypothetical ° test",
      oxygen_percent: { nominal: 25, min: null, max: 28 },
      total_pressure_kpa: { nominal: 70.3, min: null, max: null },
      airflow_cm_s: null,
    },
  };
  assert.deepEqual(decodeTarget(encodeTarget(custom)), custom);
  assert.equal(decodeTarget("custom:not-base64-json"), null);
  const qs = serializeExploreQuery({ groupId: "g1", plane: "o2_pressure", target: { profile_id: "p1" } }, "?demo=1&group=old");
  assert.deepEqual(parseExploreQuery(qs), { group: "g1", plane: "o2_pressure", target: { profile_id: "p1" } });
  assert.match(qs, /demo=1/);
  assert.deepEqual(parseExploreQuery("?plane=bogus"), {});
});

test("store defaults and actions", () => {
  const s = useExploreStore;
  s.getState().reset();
  const st = s.getState();
  // LEAD_DECISIONS D1: the blind spot on the O2 x pressure plane.
  assert.equal(st.plane, "o2_pressure");
  assert.deepEqual(st.target, { profile_id: "exploration_atmosphere_8p2_34" });
  assert.deepEqual(st.slice, { o2_flow: 101.3, o2_pressure: 10 });
  assert.deepEqual(st.layers, { observations: true, coverage: false, prediction: false, uncertainty: false, target: true, candidates: true, context: true });
  s.getState().toggleCompare("c1");
  s.getState().toggleCompare("c2");
  assert.deepEqual(s.getState().compareIds, ["c1", "c2"]);
  s.getState().toggleCompare("c1");
  assert.deepEqual(s.getState().compareIds, [null, "c2"]);
  s.getState().selectCandidate("c2");
  s.getState().setHypotheticalOutcome("sustained");
  s.getState().setTarget({ profile_id: "other" });
  assert.equal(s.getState().selectedCandidateId, null);
  assert.equal(s.getState().hypotheticalOutcome, null);
  s.getState().setViewDomain({ x: [10, 30], y: [1, 20] });
  s.getState().setPlane("o2_flow");
  assert.equal(s.getState().viewDomain, null);
  s.getState().setViewDomain({ x: [10, 30], y: [1, 20] });
  s.getState().setPlane("o2_pressure");
  assert.equal(s.getState().viewDomain, null);
  s.getState().setSlice(3);
  assert.equal(s.getState().slice.o2_pressure, 3);
  s.getState().initDefaults({ groups: [group("g", "modeled", 4)], profiles: [{ profile_id: "q", total_pressure_kpa: { nominal: 70.3, min: null, max: null }, airflow_cm_s: null }] });
  assert.equal(s.getState().groupId, "g");
  assert.deepEqual(s.getState().target, { profile_id: "q" });
  // The o2_flow slice is derived from the profile at once (no wait for /target/assess); the user's
  // o2_pressure slice (3, set above for the previous target) is not derivable without an airflow band.
  assert.equal(s.getState().slice.o2_flow, 70.3);
  s.getState().reset();
});

// ---- D1 default profile, D3 surface exclusivity, slice derivation ------------------------------------------

const prof = (profile_id, p, extra = {}) => ({ profile_id, total_pressure_kpa: { nominal: p, min: null, max: null }, airflow_cm_s: null, ...extra });

test("default profile: Exploration Atmosphere, else ISS, else first; never the envelope", () => {
  assert.equal(pickDefaultProfile([prof("iss_cabin_nominal", 101.353), prof("exploration_atmosphere_8p2_34", 56.537)]).profile_id, "exploration_atmosphere_8p2_34");
  assert.equal(pickDefaultProfile([prof("x", 70), prof("iss_cabin_nominal", 101.353)]).profile_id, "iss_cabin_nominal");
  assert.equal(pickDefaultProfile([{ profile_id: "env", kind: "envelope" }, prof("x", 70)]).profile_id, "x");
});

test("D3: one surface layer at a time; other layers untouched", () => {
  let l = { ...DEFAULT_LAYERS };
  l = withLayer(l, "prediction", true);
  assert.equal(l.prediction, true);
  l = withLayer(l, "uncertainty", true);
  assert.deepEqual([l.prediction, l.uncertainty, l.coverage], [false, true, false]);
  l = withLayer(l, "coverage", true);
  assert.deepEqual([l.prediction, l.uncertainty, l.coverage], [false, false, true]);
  assert.equal(l.context, true);
  l = withLayer(l, "coverage", false);
  assert.deepEqual([l.prediction, l.uncertainty, l.coverage], [false, false, false]);
  const s = useExploreStore;
  s.getState().reset();
  s.getState().toggleLayer("prediction");
  s.getState().toggleLayer("uncertainty");
  assert.equal(s.getState().layers.prediction, false);
  assert.equal(s.getState().layers.uncertainty, true);
  s.getState().setLayers({ prediction: true, uncertainty: true });
  // Exactly one surface stays on.
  assert.equal([s.getState().layers.prediction, s.getState().layers.uncertainty, s.getState().layers.coverage].filter(Boolean).length, 1);
  s.getState().setLayer("observations", false);
  assert.equal(s.getState().layers.observations, false);
  s.getState().reset();
});

test("slices derive synchronously from the target and snap to snapshot slices", () => {
  const profiles = [prof("exploration_atmosphere_8p2_34", 56.537), prof("iss_cabin_nominal", 101.353)];
  const band = { nominal: null, min: 0.5, max: 60.96 };
  const d = deriveTargetSlices({ profile_id: "exploration_atmosphere_8p2_34" }, { profiles, analysisAirflow: band });
  assert.equal(d.o2_flow, 56.5);
  assert.equal(d.o2_pressure, 5.5);
  const snap = { o2_flow: [34.474, 56.537, 70.3, 101.353], o2_pressure: [1, 3, 10, 20] };
  const ds = deriveTargetSlices({ profile_id: "exploration_atmosphere_8p2_34" }, { profiles, analysisAirflow: band }, snap);
  assert.deepEqual(ds, { o2_flow: 56.537, o2_pressure: 3 });
  // No airflow band known: the o2_pressure slice waits for the resolved target.
  assert.equal(deriveTargetSlices({ profile_id: "iss_cabin_nominal" }, { profiles }).o2_pressure, null);
  const s = useExploreStore;
  s.getState().reset();
  s.getState().initDefaults({ groups: [group("g", "modeled", 4)], profiles, slices: snap });
  assert.deepEqual(s.getState().slice, { o2_flow: 56.537, o2_pressure: 10 });
  // Fallback once /target/assess resolved the band; idempotent; never overrides a user choice.
  s.getState().syncSliceToTarget({ total_pressure_kpa: { nominal: 56.537, min: null, max: null }, airflow_cm_s: band });
  assert.equal(s.getState().slice.o2_pressure, 3);
  s.getState().setSlice(20, "o2_pressure");
  s.getState().syncSliceToTarget({ total_pressure_kpa: { nominal: 56.537, min: null, max: null }, airflow_cm_s: band });
  assert.equal(s.getState().slice.o2_pressure, 20);
  // Changing the target re-derives at once.
  s.getState().setTarget({ profile_id: "iss_cabin_nominal" });
  assert.equal(s.getState().slice.o2_flow, 101.353);
  s.getState().reset();
});

// ---- manifest loading (a14-05), lookup without download (a04-07), keys with spaces (a14-16) ----------------

function mockFetch(responses) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return r(String(url));
  };
  return { calls, restore: () => (globalThis.fetch = orig) };
}
const manifestBody = { generated_at: "t", dataset_version: "d", model_version: "m", slices: { o2_flow: [101.3], o2_pressure: [10] }, entries: { "GET /api/health": "health.json", "GET /api/export/experiments.csv": "files/x y.csv" } };
const ok = (body) => () => new Response(JSON.stringify(body), { status: 200 });

test("a rejected manifest load is not cached: the next call retries", async () => {
  resetSnapshotCache();
  const m = mockFetch([new TypeError("network"), ok(manifestBody)]);
  try {
    await assert.rejects(loadSnapshotManifest(), (e) => e instanceof SnapshotError && e.kind === "no_manifest");
    const man = await loadSnapshotManifest();
    assert.equal(man.model_version, "m");
    await loadSnapshotManifest(); // success is cached
    assert.equal(m.calls.length, 2);
  } finally {
    m.restore();
    resetSnapshotCache();
  }
});

test("a 404 manifest is reported as no snapshot deployed", async () => {
  resetSnapshotCache();
  const m = mockFetch([() => new Response("nope", { status: 404 })]);
  try {
    await assert.rejects(loadSnapshotManifest(), (e) => e instanceof SnapshotError && e.noManifest && e.status === 404);
  } finally {
    m.restore();
    resetSnapshotCache();
  }
});

test("resolveSnapshotFile finds the file without downloading it; misses are missing_entry", async () => {
  resetSnapshotCache();
  const m = mockFetch([ok(manifestBody)]);
  try {
    const loc = await resolveSnapshotFile("GET", "/api/export/experiments.csv", undefined);
    assert.equal(loc.url, "/snapshot/files/x%20y.csv");
    await assert.rejects(resolveSnapshotFile("GET", "/api/experiments/nope"), (e) => e instanceof SnapshotError && e.kind === "missing_entry");
    assert.equal(m.calls.length, 1); // manifest only
  } finally {
    m.restore();
    resetSnapshotCache();
  }
});

test("parseSnapshotKey handles paths with spaces", () => {
  for (const key of ["GET /api/experiments/PSI-98:SAFFIRE-I S2", "GET /api/coverage?group=g&plane=o2_flow&slice=70.3", 'POST /api/brief {"candidate":null,"group_id":"g","target":{"profile_id":"p"}}']) {
    const p = parseSnapshotKey(key);
    assert.ok(p, key);
    assert.equal(snapshotKey(p.method, p.path, p.method === "GET" ? p.query : p.body), key);
  }
  assert.equal(parseSnapshotKey("GET /api/experiments/PSI-98:SAFFIRE-I S2").path, "/api/experiments/PSI-98:SAFFIRE-I S2");
});

// ---- format: canonical terms and number formatting -------------------------------------------------------

test("pairs collapse equal ends; counts, ranges and labels never show raw codes", () => {
  assert.equal(fmt.fmtPair([101.353, 101.38], "kPa"), "101.4 kPa");
  assert.equal(fmt.fmtPair([98.9, 101.4], "kPa"), "98.9–101.4 kPa");
  assert.equal(fmt.fmtPair(null), "—");
  assert.equal(fmt.fmtOf(19, 27), "19 of 27");
  assert.equal(fmt.fmtOf(null, 27), "—");
  assert.equal(fmt.fmtProbabilityRange(null, 0.9), "—");
  assert.equal(fmt.fmtProbabilityRange(0.4, 0.9), "0.40–0.90");
  assert.equal(fmt.fmtRefDistance(0.94), "0.9 reference distances");
  assert.equal(fmt.pressureBasisLabel(false, [101.353, 101.38]), "assumed (not recorded)");
  assert.equal(fmt.pressureBasisLabel(false, [98.9, 101.4]), "partly assumed");
  assert.equal(fmt.pressureBasisLabel(true, [98.9, 101.4]), "measured");
  assert.equal(fmt.configurationLabel("unknown"), "Configuration not recorded");
  assert.equal(fmt.materialFamilyLabel("sibal_fabric"), "SIBAL fabric");
  assert.equal(fmt.reasonLabel("some_new_code"), "Some new code");
  assert.equal(fmt.airflowBandSourceLabel("custom").label, "User-selected airflow band");
  assert.doesNotMatch(fmt.verdictText("extrapolation"), /beyond the observed region/);
  assert.equal(fmt.TERMS.epistemic, "knowledge uncertainty");
  for (const v of [fmt.atmosphereStatusLabel("nasa_design_recommendation"), fmt.investigationRoleLabel("integrated_context"), fmt.rankStatusLabel("model_unavailable"), fmt.flameStateText("brief_flame_no_sustain"), fmt.extinctionModeLabel("quench_low_flow")]) {
    assert.doesNotMatch(v, /_/);
  }
});
