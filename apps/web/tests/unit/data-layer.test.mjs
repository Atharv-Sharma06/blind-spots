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
  assert.equal(fmt.flameStateLabel(0), "Not sustained");
  assert.equal(fmt.outcomeLabel("not_sustained"), "Not sustained");
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
  assert.equal(st.plane, "o2_flow");
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
  s.getState().setPlane("o2_pressure");
  assert.equal(s.getState().viewDomain, null);
  s.getState().setSlice(3);
  assert.equal(s.getState().slice.o2_pressure, 3);
  s.getState().initDefaults({ groups: [group("g", "modeled", 4)], profiles: [{ profile_id: "q" }] });
  assert.equal(s.getState().groupId, "g");
  assert.deepEqual(s.getState().target, { profile_id: "q" });
  s.getState().reset();
});
