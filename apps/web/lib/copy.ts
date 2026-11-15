/** Exact UI text mandated by docs/CONTRACTS.md section 4. Do not paraphrase. */
export const INSUFFICIENT_EVIDENCE_TEXT = "Insufficient experimental evidence for a reliable estimate.";

export const DISCLAIMER = "Research-planning tool. Not a certified fire-safety assessment. Not endorsed by NASA.";
export const DATA_CREDIT = "Data: NASA Physical Sciences Informatics (CC0)";
/** One plain line on how the project was made; shown once, in the footer, next to DISCLAIMER. */
export const SI_NOTE = "Built with SI assistance (Claude, by Anthropic).";
/** Link text after SI_NOTE; /methodology#si defines SI in plain words. */
export const SI_LINK_LABEL = "What SI means";

/** Required framing for any candidate shown in the UI (CONTRACTS section 0, rule 4). */
export const CANDIDATE_FRAMING =
  "Computational research candidates requiring qualified scientific review, established safety procedures and formal feasibility assessment.";

/** LEAD_DECISIONS D1 product line (never "What should NASA test next?"). */
export const PRODUCT_LINE = "Blind Spots: where NASA's ISS fire tests end, and what to test next.";
/** D1: the method, named in plain words (the challenge's "SI"). */
export const METHOD_LINE =
  "Machine learning that says when it does not know, and ranks the most useful next experiment.";

/* ------------------------------------------------------------------ */
/* Plain-language redesign strings (see .work/redesign/SPEC.md).       */
/* Shared by the Cabins page, the shell and the guided tour so a word  */
/* is defined once. No numbers here: every figure comes from the API.  */
/* ------------------------------------------------------------------ */

/** The product question, used as the h1 on the Cabins page and (without the brand) in the page title. */
export const SITE_QUESTION = "Do NASA's space-station fire tests cover this cabin's air?";
export const SITE_TITLE = "Blind Spots: do NASA's space-station fire tests cover this cabin's air?";
export const SITE_DESCRIPTION =
  "NASA burned materials aboard the ISS. Pick a cabin to see if those tests cover its air, and which test to run next.";
export const HERO_SENTENCE = "NASA burned materials aboard the ISS to learn when flames keep burning.";
export const HERO_BYLINE = "Blind Spots. Machine learning that says when it does not know. Data: NASA PSI.";

/** Verdict lines for the answer card (icon + words; never colour alone). */
export const VERDICT_LINE = {
  insufficient_evidence: "Blind spot: none of the ISS flame tests in our data ran in air like this.",
  extrapolation: "Partly covered: only part of this air has nearby ISS tests.",
  supported: "Covered: ISS flame tests ran in air like this.",
} as const;

/** Cabin coverage chips and the one-line definition of "nearby" (define once, explain in the tooltip). */
export const COVERAGE_LABEL = { none: "Not covered", barely: "Barely covered", covered: "Covered" } as const;
export const NEARBY_DEFINITION = "Nearby means close enough for the model to compare.";

/** Counterfactual caption (exact wording is binding, see CONTRACTS section 0). */
export const HYPOTHETICAL_NOTE = "Hypothetical model updates, not experimental results.";
/** Shown on a blind-spot answer when related NASA ground-test studies exist for the cabin. */
export const GROUND_TESTS_NOTE = "Related NASA ground tests exist for this air; the model does not use them.";

/** Navigation and call-to-action labels. */
export const TOUR_LABEL = "30-second tour";
export const OPEN_IN_EXPLORER_LABEL = "Open this cabin in the Explorer";
