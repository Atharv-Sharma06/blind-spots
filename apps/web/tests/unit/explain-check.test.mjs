// Unit tests for the "Explain with SI" number check (lib/explain-check.ts). Run: node --test tests/unit/
// fixture_* values below are synthetic test inputs, not product data.
import test from "node:test";
import assert from "node:assert/strict";
import { checkExplanation, contextNumbers, normalizeNumber, numbersIn, splitSentences } from "../../lib/explain-check.ts";

const fixture_context = {
  cabin: "Fixture cabin",
  cabin_air: "up to 34 % oxygen at 56.5 kPa",
  verdict_headline: "Barely covered: only 3 of 40 points in this air have nearby ISS tests.",
  nearby_iss_test_results_this_material: 12,
  total: 1234,
  delta: -2.5,
  ratio: 0.1923,
  top_ranked_test: { oxygen: "21 %", uncertainty_cut: "Cuts uncertainty by 19 %" },
};

test("normalizeNumber strips commas, percent and unicode minus", () => {
  assert.equal(normalizeNumber("1,234"), "1234");
  assert.equal(normalizeNumber("19%"), "19");
  assert.equal(normalizeNumber("−2.50"), "-2.5");
  assert.equal(normalizeNumber("56.50"), "56.5");
  assert.equal(normalizeNumber("abc"), null);
});

test("numbersIn skips chemical names and hyphenated ids but keeps quantities", () => {
  assert.deepEqual(numbersIn("O2 and CO2 at 21 %"), ["21"]);
  assert.deepEqual(numbersIn("PSI-25 ran 22-25 cm/s"), ["25", "22", "25"]);
  assert.deepEqual(numbersIn("a drop of −2.5 and 1,234 tests"), ["-2.5", "1234"]);
  assert.deepEqual(numbersIn("15–22.2 % oxygen"), ["15", "22.2"]);
});

test("contextNumbers collects numbers from strings and numeric values with roundings", () => {
  const s = contextNumbers(fixture_context);
  for (const n of ["34", "56.5", "3", "40", "12", "1234", "-2.5", "21", "19", "0.19", "0.2", "0"]) assert.ok(s.has(n), n);
  assert.ok(!s.has("57.5"));
});

test("splitSentences does not split inside decimals", () => {
  assert.deepEqual(splitSentences("It ran at 56.5 kPa. Only 3 of 40 points are covered! Why? Because."), [
    "It ran at 56.5 kPa.",
    "Only 3 of 40 points are covered!",
    "Why?",
    "Because.",
  ]);
});

test("sentences with numbers not in the context are removed and listed", () => {
  const out = checkExplanation(
    "This cabin has up to 34 % oxygen at 56.5 kPa. Only 3 of 40 points have nearby ISS tests. About 75 % of fires spread faster. The top test cuts uncertainty by 19 %.",
    fixture_context,
  );
  assert.equal(out.text, "This cabin has up to 34 % oxygen at 56.5 kPa. Only 3 of 40 points have nearby ISS tests. The top test cuts uncertainty by 19 %.");
  assert.deepEqual(out.removed, ["About 75 % of fires spread faster."]);
});

test("formatting differences in numbers still pass (commas, unicode minus)", () => {
  const out = checkExplanation("There were 1,234 results. The change was −2.5 points.", fixture_context);
  assert.deepEqual(out.removed, []);
});

test("sentences calling anything safe or unsafe are removed; 'safety rating' is allowed", () => {
  const out = checkExplanation("This air is safe for crews. It is unsafe at 34 % oxygen. This is not a safety rating.", fixture_context);
  assert.equal(out.text, "This is not a safety rating.");
  assert.equal(out.removed.length, 2);
});

test("text without numbers passes untouched", () => {
  const out = checkExplanation("The ISS tests cover part of this air. The model does not guess elsewhere.", fixture_context);
  assert.equal(out.removed.length, 0);
  assert.equal(out.text, "The ISS tests cover part of this air. The model does not guess elsewhere.");
});
