// Unit tests for the model check rule (components/model-check/model-check-data.ts). Run: node --test tests/unit/
// Fixtures are synthetic (named fixture_*), used only here, never imported by app code.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  compareBrier,
  fmtBrier,
  fmtCi,
  guessLabel,
  majorityLabel,
  modelCheck,
  modelChecks,
  notClearlyCount,
  verdictWords,
} from "../../components/model-check/model-check-data.ts";

const fixture_metric = (value, lo, hi) => ({ value, ci95: lo == null ? null : [lo, hi] });
const fixture_group = ({ gp, majority, curve, counts = { sustained: 8, not_sustained: 2 } }) => ({
  group_id: "fixture_group",
  label: "Fixture material",
  n_experiments: 7,
  n_observations: 10,
  label_counts: counts,
  small_sample_warning: "fixture warning",
  cv: {
    models: [
      { name: "gp", brier: gp },
      ...(majority ? [{ name: "majority_class", brier: majority }] : []),
      ...(curve ? [{ name: "logistic_o2_flow", brier: curve }] : []),
    ],
  },
});

test("clearly better only when the GP upper bound is below the baseline value", () => {
  assert.equal(compareBrier(fixture_metric(0.1, 0.05, 0.15), fixture_metric(0.2)), "clearly_better");
  assert.equal(compareBrier(fixture_metric(0.1, 0.05, 0.25), fixture_metric(0.2)), "not_clearly_better");
  // Equal to the baseline is not "clearly" better.
  assert.equal(compareBrier(fixture_metric(0.1, 0.05, 0.2), fixture_metric(0.2)), "not_clearly_better");
  // A lower point value with overlapping range is still "not clearly better".
  assert.equal(compareBrier(fixture_metric(0.15, 0.1, 0.21), fixture_metric(0.2)), "not_clearly_better");
});

test("missing numbers give unknown, never a verdict", () => {
  assert.equal(compareBrier(fixture_metric(0.1, null), fixture_metric(0.2)), "unknown");
  assert.equal(compareBrier(fixture_metric(0.1, 0.05, 0.1), fixture_metric(null)), "unknown");
  assert.equal(compareBrier(undefined, fixture_metric(0.2)), "unknown");
  const row = modelCheck(fixture_group({ gp: fixture_metric(0.1, 0.05, 0.12) }));
  assert.equal(row.vsGuess, "unknown");
  assert.equal(row.majorityBrier, null);
  assert.equal(fmtBrier(row.majorityBrier), "not recorded");
  assert.equal(fmtCi(null), "not recorded");
});

test("row keeps the JSON numbers and both checks", () => {
  const row = modelCheck(
    fixture_group({ gp: fixture_metric(0.1234, 0.1, 0.15), majority: fixture_metric(0.2), curve: fixture_metric(0.14) }),
  );
  assert.equal(row.gpBrier, 0.1234);
  assert.deepEqual(row.gpCi, [0.1, 0.15]);
  assert.equal(row.majorityBrier, 0.2);
  assert.equal(row.curveBrier, 0.14);
  assert.equal(row.vsGuess, "clearly_better");
  assert.equal(row.vsCurve, "not_clearly_better");
  assert.equal(row.nExperiments, 7);
  assert.equal(fmtBrier(row.gpBrier), "0.123");
});

test("majority label in plain words; ties and missing counts give null", () => {
  assert.equal(majorityLabel({ sustained: 5, not_sustained: 2 }), "kept burning");
  assert.equal(majorityLabel({ sustained: 1, not_sustained: 2 }), "went out");
  assert.equal(majorityLabel({ sustained: 2, not_sustained: 2 }), null);
  assert.equal(majorityLabel(null), null);
  assert.equal(guessLabel({ majorityLabel: null }), "Always guess the usual outcome");
  assert.match(guessLabel({ majorityLabel: "kept burning" }), /kept burning/);
});

test("verdict words never mention abstention or safety", () => {
  for (const v of ["clearly_better", "not_clearly_better", "unknown"]) {
    for (const a of ["guess", "curve"]) {
      const w = verdictWords(v, a);
      assert.doesNotMatch(w, /abstain|safe|unsafe/i);
    }
  }
  assert.equal(verdictWords("not_clearly_better", "guess"), "Not clearly better than always guessing the usual outcome");
});

test("k of n counts only materials with a check", () => {
  const rows = [
    modelCheck(fixture_group({ gp: fixture_metric(0.1, 0.05, 0.3), majority: fixture_metric(0.2) })),
    modelCheck(fixture_group({ gp: fixture_metric(0.1, 0.05, 0.1), majority: fixture_metric(0.2) })),
    modelCheck(fixture_group({ gp: fixture_metric(0.1, 0.05, 0.1) })),
  ];
  assert.deepEqual(notClearlyCount(rows), { k: 1, n: 2 });
  assert.deepEqual(modelChecks(null), []);
});

test("snapshot validation: verdicts follow the rule and at least one is not clearly better", () => {
  const dir = fileURLToPath(new URL("../../public/snapshot/", import.meta.url));
  const manifest = JSON.parse(readFileSync(dir + "manifest.json", "utf8"));
  const file = manifest["GET /api/model/validation"];
  if (!file) return; // snapshot not present in this checkout
  const body = JSON.parse(readFileSync(dir + file, "utf8"));
  const rows = modelChecks(body.groups);
  assert.ok(rows.length > 0);
  for (const [i, r] of rows.entries()) {
    const models = Object.fromEntries(body.groups[i].cv.models.map((m) => [m.name, m.brier]));
    assert.equal(r.gpBrier, models.gp.value);
    assert.equal(r.majorityBrier, models.majority_class.value);
    assert.equal(r.vsGuess, models.gp.ci95[1] < models.majority_class.value ? "clearly_better" : "not_clearly_better");
  }
  assert.ok(rows.some((r) => r.vsGuess === "not_clearly_better"));
});
