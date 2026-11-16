// Unit tests for the plain-words glossary and the number-source labels (lib/glossary.ts). Run: node --test tests/unit/
import test from "node:test";
import assert from "node:assert/strict";
import { GLOSSARY, GLOSSARY_IDS, PROVENANCE_LABEL, PROVENANCE_TEXT } from "../../lib/glossary.ts";

const sentences = (s) => s.split(/[.!?](?:\s|$)/).filter((x) => x.trim().length > 0);

test("glossary has at most 14 entries, each with a term and one plain sentence", () => {
  assert.ok(GLOSSARY_IDS.length > 0 && GLOSSARY_IDS.length <= 14);
  for (const id of GLOSSARY_IDS) {
    const e = GLOSSARY[id];
    assert.ok(e.term.trim().length > 0, `${id} has a term`);
    assert.ok(e.text.trim().endsWith("."), `${id} ends with a full stop`);
    assert.equal(sentences(e.text).length, 1, `${id} is one sentence`);
  }
});

test("glossary covers the terms the plan names", () => {
  for (const id of [
    "iss_test_result",
    "kept_burning",
    "went_out",
    "opposed_flow",
    "concurrent_flow",
    "airflow",
    "oxygen_percent",
    "cabin_pressure",
    "comparable_results",
    "coverage",
    "model_estimate",
    "model_abstains",
    "uncertainty",
    "research_candidate",
  ]) {
    assert.ok(id in GLOSSARY, `${id} present`);
  }
});

test("glossary never gives a safety verdict, never claims NASA did not study something, and adds no new numbers", () => {
  const allowedNumbers = new Set(["3"]); // "near 3 or more ISS test results" (lib/format.ts verdict text)
  for (const id of GLOSSARY_IDS) {
    const t = GLOSSARY[id].text;
    assert.doesNotMatch(t, /\b(safe|unsafe)\b/i, id);
    assert.doesNotMatch(t, /NASA has not studied/i, id);
    for (const n of t.match(/\d+(?:\.\d+)?/g) ?? []) assert.ok(allowedNumbers.has(n), `${id} introduces number ${n}`);
  }
});

test("candidate entry keeps the binding review framing", () => {
  assert.match(GLOSSARY.research_candidate.text, /qualified scientific review, established safety procedures and formal feasibility assessment/);
});

test("model-abstains entry is not tied to the baseline comparison", () => {
  assert.doesNotMatch(GLOSSARY.model_abstains.text, /baseline|beat|guess/i);
});

test("every source kind has a word label and one sentence (words, not colour alone)", () => {
  const kinds = ["measured", "derived", "model", "assumed", "missing"];
  assert.deepEqual(Object.keys(PROVENANCE_LABEL).sort(), [...kinds].sort());
  assert.deepEqual(Object.keys(PROVENANCE_TEXT).sort(), [...kinds].sort());
  assert.deepEqual(
    kinds.map((k) => PROVENANCE_LABEL[k]),
    ["ISS test", "Computed", "Model estimate", "Assumed", "Not recorded"],
  );
  for (const k of kinds) assert.equal(sentences(PROVENANCE_TEXT[k]).length, 1, k);
});
