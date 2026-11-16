/**
 * Plain-words glossary for <Term> and the labels for <ProvenanceTag>. One sentence per entry. Wording follows
 * docs/scientific-methodology.md and the canonical terms in lib/format.ts; no new numbers are introduced here.
 */
export const GLOSSARY = {
  iss_test_result: {
    term: "ISS test result",
    text: "One recorded flame outcome at one airflow setting in a NASA fire experiment on the International Space Station.",
  },
  kept_burning: {
    term: "Kept burning",
    text: "The recorded outcome is a sustained flame: it kept burning at that oxygen, airflow and pressure.",
  },
  went_out: {
    term: "Went out",
    text: "The recorded outcome is a flame that did not keep burning, for example with too little or too much airflow.",
  },
  opposed_flow: { term: "Opposed flow", text: "The air moves against the direction in which the flame spreads." },
  concurrent_flow: { term: "Concurrent flow", text: "The air moves in the same direction in which the flame spreads." },
  airflow: { term: "Airflow", text: "How fast the air moved past the burning sample, in centimetres per second (cm/s)." },
  oxygen_percent: { term: "Oxygen %", text: "The share of oxygen in the air, by volume." },
  cabin_pressure: {
    term: "Cabin pressure",
    text: "The total pressure of the air, in kilopascals (kPa); where a test did not record it, the dataset uses a stated assumed value.",
  },
  comparable_results: {
    term: "Comparable results",
    text: "ISS test results for the same material within one step of the chosen air, using documented scales for oxygen, airflow and pressure.",
  },
  coverage: {
    term: "Covered / barely covered / not covered",
    text: "Covered: inside the tested conditions or near 3 or more ISS test results with low model uncertainty; barely covered: few nearby results, so the estimate leans on model assumptions; not covered: insufficient experimental evidence.",
  },
  model_estimate: {
    term: "Model estimate",
    text: "A chance from our Gaussian-process model, trained only on ISS test results; it is an estimate, not a measurement.",
  },
  model_abstains: {
    term: "Model abstains",
    text: "The model gives no estimate when a material has too few ISS test results to train on, or when no comparable ISS test is nearby.",
  },
  uncertainty: {
    term: "Uncertainty",
    text: "How unsure the model is: knowledge uncertainty shrinks with more nearby tests, while outcome variability is the scatter seen even in similar tests.",
  },
  research_candidate: {
    term: "Computational research candidate",
    text: "A condition our code ranks as worth studying next; it requires qualified scientific review, established safety procedures and formal feasibility assessment.",
  },
} as const satisfies Record<string, { term: string; text: string }>;

export type GlossaryId = keyof typeof GLOSSARY;

export const GLOSSARY_IDS = Object.keys(GLOSSARY) as GlossaryId[];

/** Where a number comes from. Shown as a small labelled tag next to the number. */
export type Provenance = "measured" | "derived" | "model" | "assumed" | "missing";

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  measured: "ISS test",
  derived: "Computed",
  model: "Model estimate",
  assumed: "Assumed",
  missing: "Not recorded",
};

export const PROVENANCE_TEXT: Record<Provenance, string> = {
  measured: "Counted directly from recorded ISS test results.",
  derived: "Calculated by our code from recorded ISS test results or documented cabin air.",
  model: "Estimated by our statistical model; it is not a measurement.",
  assumed: "Not recorded in the source; the dataset uses a stated assumed value instead.",
  missing: "Not recorded in the source data, so it is left blank.",
};
