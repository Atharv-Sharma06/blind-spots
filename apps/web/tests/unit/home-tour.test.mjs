// Unit tests for the 30-second tour's pure model (components/demo/tour-model.ts). Run: node --test tests/unit/
// Fixtures are synthetic (named fixture_*), used only here, never imported by app code.
import test from "node:test";
import assert from "node:assert/strict";
import {
  CAPTION_MAX_WORDS,
  END_SCENE,
  END_SECONDS,
  SCENES,
  SCENE_COUNT,
  TITLE_SECONDS,
  TOTAL_SECONDS,
  airText,
  kpaRange,
  kpaWhole,
  locate,
  percentSpan,
  sceneCaption,
  sceneSeconds,
  trim1,
  wordCount,
} from "../../components/demo/tour-model.ts";

const fixture_assess = (verdict, n = 0) => ({
  verdict,
  coverage: { comparable_observations: n },
  target: { oxygen_percent: { nominal: 34, min: null, max: null }, total_pressure_kpa: { nominal: 56.537, min: null, max: null } },
});
const fixture_top = (atTarget) => ({
  rank: 1,
  oxygen_percent: 34,
  pressure_kpa: 56.537,
  airflow_cm_s: 1.7331,
  evr_fraction: 0.1904,
  reasons: atTarget ? [{ code: "at_target_conditions" }] : [{ code: "reduces_target_uncertainty" }],
});
const fixture_cf = {
  scenarios: [
    { outcome: "sustained", variance_reduction_fraction: 0.1812 },
    { outcome: "not_sustained", variance_reduction_fraction: 0.2127 },
  ],
};
const base = {
  beat: 0,
  iss: { comparable_observations: 241, groups_with_comparable: 19, n_groups: 20 },
  cabin: { name: "Moon/Mars Exploration Atmosphere", oxygen_percent: 34, total_pressure_kpa: 56.537, statusLabel: "Not covered" },
  materialName: "Thin acrylic film (PMMA)",
  testedKpa: [98.3, 102.2],
  testedKpaMeasured: true,
  assess: fixture_assess("insufficient_evidence"),
  rankStatus: "ok",
  top: fixture_top(true),
  counterfactual: fixture_cf,
};

test("the tour fits the 30 second limit with five scenes", () => {
  assert.equal(SCENE_COUNT, 5);
  assert.equal(END_SCENE, 6);
  assert.ok(TITLE_SECONDS <= 3.5);
  assert.ok(TOTAL_SECONDS <= 30, `total ${TOTAL_SECONDS}`);
  assert.ok(TOTAL_SECONDS >= 20);
  assert.equal(TOTAL_SECONDS, TITLE_SECONDS + SCENES.reduce((t, s) => t + sceneSeconds(s), 0) + END_SECONDS);
});

test("locate maps running time to title, scene beats and end", () => {
  assert.equal(locate(0), "title");
  assert.deepEqual(locate(TITLE_SECONDS + 0.1), { scene: 1, beat: 0 });
  const answerStart = TITLE_SECONDS + sceneSeconds(SCENES[0]) + sceneSeconds(SCENES[1]);
  assert.deepEqual(locate(answerStart + 0.1), { scene: 3, beat: 0 });
  assert.deepEqual(locate(answerStart + SCENES[2].beats[0].seconds + 0.1), { scene: 3, beat: 1 });
  assert.equal(locate(TOTAL_SECONDS), "end");
});

test("number helpers", () => {
  assert.equal(trim1(34), "34");
  assert.equal(trim1(56.537), "56.5");
  assert.equal(kpaRange([98.3, 102.2]), "98.3–102.2 kPa");
  assert.equal(kpaRange([101.4, 101.4]), "101.4 kPa");
  assert.equal(kpaRange(null), "");
  assert.equal(kpaWhole([98.3, 102.2]), "98–102 kPa");
  assert.equal(kpaWhole([101.353, 101.353]), "101 kPa");
  assert.equal(kpaWhole(null), "");
  assert.equal(percentSpan([0.1812, 0.2127]), "18–21 %");
  assert.equal(percentSpan([0.19, 0.19]), "19 %");
  assert.equal(percentSpan([]), null);
  assert.equal(airText(34, 56.537), "34 % oxygen, 56.5 kPa");
  assert.equal(airText(null, 101.3), "101.3 kPa");
});

test("captions never exceed 14 words and avoid expert words", () => {
  const forbidden = /\b(group|slice|plane|layer|latent|GP|Laplace|EVR|reference distance|hull|stationarity)\b|_/i;
  const cases = [];
  for (const scene of ["iss", "pick", "answer", "next", "what-if"]) {
    for (const verdict of ["insufficient_evidence", "extrapolation", "supported"]) {
      for (const rankStatus of ["loading", "ok", "unavailable", "none"]) {
        for (const beat of [0, 1]) {
          for (const withData of [true, false]) {
            cases.push({
              ...base,
              scene,
              beat,
              rankStatus,
              assess: withData ? fixture_assess(verdict) : null,
              top: withData && rankStatus === "ok" ? fixture_top(verdict === "insufficient_evidence") : null,
              counterfactual: withData ? fixture_cf : null,
              iss: withData ? base.iss : null,
              cabin: withData ? base.cabin : null,
            });
          }
        }
      }
    }
  }
  for (const c of cases) {
    const cap = sceneCaption(c);
    assert.ok(cap.caption.length > 0, `${c.scene} has a caption`);
    assert.ok(wordCount(cap.caption) <= CAPTION_MAX_WORDS, `${c.scene}: "${cap.caption}" has ${wordCount(cap.caption)} words`);
    assert.ok(!/!/.test(cap.caption), "no exclamation marks");
    assert.ok(cap.facts.length <= 3, `${c.scene} shows at most three facts`);
    for (const t of [cap.caption, cap.title, ...cap.facts.flatMap((f) => [f.label, f.value])]) {
      assert.ok(!forbidden.test(t), `expert word in "${t}"`);
    }
  }
});

test("scene 1 and 2 use the headline numbers", () => {
  const a = sceneCaption({ ...base, scene: "iss" });
  assert.equal(a.caption, "ISS flame tests cover the station's own air.");
  assert.deepEqual(a.facts, [{ label: "Nearby ISS test results", value: "241" }]);
  const barely = sceneCaption({ ...base, scene: "iss", issStatus: "barely" });
  assert.match(barely.caption, /only partly/, "no full-coverage claim for a barely covered cabin");
  const none = sceneCaption({ ...base, scene: "iss", iss: { comparable_observations: 0, groups_with_comparable: 0, n_groups: 20 } });
  assert.ok(!/cover the station/.test(none.caption), "no coverage claim when there are no nearby results");
  const b = sceneCaption({ ...base, scene: "pick" });
  assert.equal(b.caption, "Now pick a cabin: Moon/Mars Exploration Atmosphere.", "scene 2 names the cabin from the data");
  assert.ok(sceneCaption({ ...base, scene: "pick", cabin: { ...base.cabin, name: "Artemis Moon habitat" } }).caption.includes("Artemis Moon habitat"));
  assert.deepEqual(b.facts.map((f) => f.value), ["34 %", "56.5 kPa", "Not covered"]);
});

test("scene 3 wording follows the verdict (no probability, no invented coverage)", () => {
  assert.equal(sceneCaption({ ...base, scene: "answer" }).caption, "Blind spot: no ISS test in our data ran in air like this.");
  assert.equal(sceneCaption({ ...base, scene: "answer", assess: fixture_assess("extrapolation", 3) }).caption, "Partly covered: only part of this air has nearby ISS tests.");
  assert.equal(sceneCaption({ ...base, scene: "answer", assess: fixture_assess("supported", 40) }).caption, "Covered: ISS flame tests ran in air like this.");
  const waiting = sceneCaption({ ...base, scene: "answer", assess: null });
  assert.equal(waiting.waiting, true);
  assert.deepEqual(waiting.facts, []);
  const chart = sceneCaption({ ...base, scene: "answer", beat: 1 });
  assert.match(chart.caption, /chart/);
  assert.equal(chart.facts.find((f) => f.label === "ISS tests ran at")?.value, "98–102 kPa");
  assert.equal(chart.facts.find((f) => f.label === "This cabin")?.value, "34 % oxygen, 56.5 kPa");
  assert.ok(!chart.facts.some((f) => /probab|estimate/i.test(f.label)));
});

test("scene 4 and 5 carry the binding framing", () => {
  const next = sceneCaption({ ...base, scene: "next" });
  assert.equal(next.caption, "Machine learning ranks the most informative next experiment.");
  assert.deepEqual(next.notes, ["candidate_framing"]);
  assert.match(next.facts[0].label, /own air/, "D4: at-target wording");
  assert.equal(next.facts.at(-1).value, "19 %");
  const away = sceneCaption({ ...base, scene: "next", top: fixture_top(false) });
  assert.equal(away.facts[0].label, "Top pick");
  const wi = sceneCaption({ ...base, scene: "what-if" });
  assert.equal(wi.caption, "Either outcome would cut uncertainty by 18–21 %.");
  assert.deepEqual(wi.notes, ["hypothetical", "candidate_framing"]);
  assert.deepEqual(wi.facts.map((f) => f.value), ["−18 %", "−21 %"]);
  const unavailable = sceneCaption({ ...base, scene: "what-if", rankStatus: "unavailable", top: null, counterfactual: null });
  assert.equal(unavailable.facts.length, 0);
  assert.equal(unavailable.waiting, false);
  const noCf = sceneCaption({ ...base, scene: "what-if", counterfactual: null });
  assert.equal(noCf.waiting, true);
  assert.ok(!/\d/.test(noCf.caption), "no number without a counterfactual");
});

test("scene 3 never shows an assumed pressure as a measured one", () => {
  // Pressure not recorded (the dataset assumes 101.353 kPa): the fact says so and rounds like the answer card.
  const assumed = sceneCaption({ ...base, scene: "answer", beat: 1, testedKpa: [101.353, 101.353], testedKpaMeasured: false });
  assert.equal(assumed.facts.some((f) => f.label === "ISS tests ran at"), false);
  assert.deepEqual(assumed.facts.find((f) => /pressure/i.test(f.label)), { label: "ISS test pressure (assumed)", value: "101 kPa" });
  assert.ok(!assumed.facts.some((f) => /101\.4/.test(f.value)), "no false precision");
  const partly = sceneCaption({ ...base, scene: "answer", beat: 1, testedKpa: [98.3, 102.2], testedKpaMeasured: false });
  assert.deepEqual(partly.facts.find((f) => /pressure/i.test(f.label)), { label: "ISS test pressure (partly assumed)", value: "98–102 kPa" });
  // Unknown whether it was recorded: no pressure fact at all.
  const unknown = sceneCaption({ ...base, scene: "answer", beat: 1, testedKpaMeasured: null });
  assert.equal(unknown.facts.some((f) => /pressure|ran at/i.test(f.label)), false);
  // Facts stay within three.
  for (const c of [assumed, partly, unknown]) assert.ok(c.facts.length <= 3);
});
