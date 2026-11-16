// Unit tests for "Ask about your cabin air" answer builders (components/ask/answer.ts). Run: node --test tests/unit/
// Fixtures are synthetic (named fixture_*), used only here, never imported by app code.
import test from "node:test";
import assert from "node:assert/strict";
import {
  CLOSING_LINE,
  burnedAnswer,
  gapBullets,
  modelSentence,
  nearestSentence,
  nearestTest,
  testedRanges,
} from "../../components/ask/answer.ts";

const fixture_row = (id, o2, state, opts = {}) => ({
  observation_id: `fixture_exp_${id}#s0`,
  experiment_id: `fixture_exp_${id}`,
  group_id: opts.group ?? "fixture_group",
  oxygen_percent: o2,
  airflow_cm_s: opts.flow === undefined ? 5 : opts.flow,
  total_pressure_kpa: opts.measured ?? null,
  pressure_for_analysis_kpa: opts.assumed ?? (opts.measured ?? null),
  flame_state: state,
  quality_flags: opts.measured == null && opts.assumed != null ? ["pressure_assumed"] : [],
  included_in_training: opts.training ?? true,
});

const fixture_obs = [
  fixture_row("a", 17, "not_sustained", { assumed: 101.353 }),
  fixture_row("b", 19, "sustained", { assumed: 101.353 }),
  fixture_row("c", 21, "sustained", { assumed: 101.353 }),
  fixture_row("d", 22.5, "sustained", { assumed: 101.353, flow: null }),
  fixture_row("e", 26, "sustained", { assumed: 101.353, training: false }),
  fixture_row("x", 26, "sustained", { measured: 70.3, group: "fixture_other" }),
];

test("outcome uses the binary label; extinguished and brief flames count as not kept burning", () => {
  const rows = [
    { ...fixture_row("l1", 18, "extinguished", { assumed: 101.353 }), label: 0 },
    { ...fixture_row("l2", 18.5, "brief_flame_no_sustain", { assumed: 101.353 }), label: 0 },
    { ...fixture_row("l3", 19, "sustained", { assumed: 101.353 }), label: 1 },
  ];
  const a = burnedAnswer(rows, "fixture_group", "fixture material", 20, 101.353);
  assert.equal(a.n, 3);
  assert.equal(a.k, 1);
  assert.equal(nearestTest(rows, "fixture_group", 18.4, 101.353).outcome, "burned briefly, then went out");
});

const fixture_measured = [
  fixture_row("m1", 21, "sustained", { measured: 101.3 }),
  fixture_row("m2", 30, "not_sustained", { measured: 60 }),
];

const ALL_TEXT = [];
const collect = (s) => {
  ALL_TEXT.push(s);
  return s;
};

test("nearest test picks the closest row of the right group in the documented units", () => {
  const t = nearestTest(fixture_obs, "fixture_group", 21.4, 101.353);
  assert.equal(t.experiment_id, "fixture_exp_c");
  assert.equal(t.outcome, "kept burning");
  // Other group's row at 26 % / 70.3 kPa and the excluded training row are never picked.
  const t2 = nearestTest(fixture_obs, "fixture_group", 26, 70.3);
  assert.equal(t2.experiment_id, "fixture_exp_d");
  assert.ok(Math.abs(t2.d_o2 - -3.5) < 1e-9);
  assert.ok(Math.abs(t2.d_kpa - 31.053) < 1e-6);
  // Pressure term: ln(p/101.325)/0.1 scale. 60 kPa vs 70.3 -> |ln(60/70.3)|/0.1 = 1.584; o2 4 % off -> 2.0 => d ~ 2.55
  const t3 = nearestTest(fixture_measured, "fixture_group", 26, 70.3);
  assert.equal(t3.experiment_id, "fixture_exp_m2");
  assert.equal(nearestTest(fixture_obs, "fixture_none", 21, 101), null);
});

test("missing pressure is shown as assumed, and missing airflow as not recorded", () => {
  const t = nearestTest(fixture_obs, "fixture_group", 26, 70.3);
  assert.equal(t.pressure_basis, "assumed");
  const s = collect(nearestSentence(t, "fixture material"));
  assert.match(s, /101 kPa \(assumed, not recorded\)/);
  assert.match(s, /airflow not recorded/);
  assert.match(s, /That test had 3\.5 % less oxygen and 31\.1 kPa more pressure than your air\./);
  const m = nearestTest(fixture_measured, "fixture_group", 21, 101.3);
  assert.equal(m.pressure_basis, "measured");
  assert.doesNotMatch(collect(nearestSentence(m, "fixture material")), /assumed/);
});

test("out-of-range bullets name what is missing, with the tested numbers", () => {
  const r = testedRanges(fixture_obs, "fixture_group");
  assert.deepEqual(r.o2, [17, 22.5]);
  assert.deepEqual(r.kpa, [101.353, 101.353]);
  assert.equal(r.all_pressure_assumed, true);
  const b = gapBullets(r, 26.5, 70.327).map(collect);
  assert.ok(b.includes("oxygen above the tested range (max 22.5 %)"));
  assert.ok(b.includes("pressure below the tested range (only 101 kPa tested)"));
  assert.ok(b.some((x) => /sea-level pressure is assumed/.test(x)));
  const noFlow = testedRanges([fixture_row("z", 20, "sustained", { measured: 100, flow: null })], "fixture_group");
  assert.ok(gapBullets(noFlow, 20, 100).includes("no tests with recorded airflow"));
  assert.deepEqual(gapBullets(testedRanges(fixture_measured, "fixture_group"), 25, 80), []);
});

test("burned answer counts k of n at or below the oxygen level, from records only", () => {
  const a = burnedAnswer(fixture_obs, "fixture_group", "fixture material", 21, 101.353);
  assert.equal(a.n, 3);
  assert.equal(a.k, 2);
  collect(a.sentence);
  assert.match(a.sentence, /a flame kept burning in 2 of 3\./);
  const low = burnedAnswer(fixture_obs, "fixture_group", "fixture material", 15, 70);
  assert.equal(low.n, 0);
  assert.match(collect(low.sentence), /cannot say/);
  assert.match(collect(burnedAnswer(fixture_obs, "fixture_group", "m", 26.5, 70.327).sentence), /None of them was at 70\.3 kPa/);
});

test("model sentence: abstains for unmodelled groups and insufficient evidence; estimate only when supported", () => {
  const base = { model_reason: null, p_min: null, p_max: null, points_supported: 0, n_points: 9 };
  const a = modelSentence({ ...base, model_status: "insufficient_data", model_reason: "fixture reason", verdict: "insufficient_evidence", p_mean: null });
  assert.equal(a.abstains, true);
  assert.match(collect(a.sentence), /abstains for this material: fixture reason/);
  const b = modelSentence({ ...base, model_status: "modeled", verdict: "insufficient_evidence", p_mean: null });
  assert.equal(b.abstains, true);
  assert.match(collect(b.sentence), /Insufficient experimental evidence for a reliable estimate\./);
  assert.match(b.sentence, /0 of 9 points/);
  const c = modelSentence({ ...base, model_status: "modeled", verdict: "supported", p_mean: 0.734, p_min: 0.6, p_max: 0.81, points_supported: 9 });
  assert.equal(c.abstains, false);
  assert.match(collect(c.sentence), /73\.4 % chance that a flame keeps burning here \(from 60 to 81 % across the points with nearby tests\)/);
  collect(modelSentence({ ...base, model_status: "modeled", verdict: "extrapolation", p_mean: 0.5, points_supported: 3 }).sentence);
});

test("no output ever contains a safety verdict word", () => {
  collect(CLOSING_LINE);
  assert.ok(ALL_TEXT.length > 8);
  for (const s of ALL_TEXT) assert.doesNotMatch(s, /\b(un)?safe\b/i, s);
});
