/** Exact UI text mandated by docs/CONTRACTS.md section 4. Do not paraphrase. */
export const INSUFFICIENT_EVIDENCE_TEXT = "Insufficient experimental evidence for a reliable estimate.";

export const DISCLAIMER = "Computational research-planning tool. Not a certified fire-safety assessment. Not endorsed by NASA.";
export const DATA_CREDIT = "Data: NASA Physical Sciences Informatics (CC0)";
/** One plain line on how the project was made; shown once, in the footer, next to DISCLAIMER. */
export const SI_NOTE = "Built with SI assistance (Claude, by Anthropic).";
/** Link text after SI_NOTE; /methodology#si defines SI in plain words. */
export const SI_LINK_LABEL = "What SI means here";

/** Required framing for any candidate shown in the UI (CONTRACTS section 0, rule 4). */
export const CANDIDATE_FRAMING =
  "Computational research candidates requiring qualified scientific review, established safety procedures and formal feasibility assessment.";

/** LEAD_DECISIONS D1 product line (never "What should NASA test next?"). */
export const PRODUCT_LINE = "Blind Spots: where NASA's microgravity fire evidence ends, and what to learn next.";
/** D1: the method, named in plain words (the challenge's "SI"). */
export const METHOD_LINE =
  "Machine learning: a Gaussian-process model that says when it does not know, plus active learning that ranks the most informative next experiment.";

/* ------------------------------------------------------------------ */
/* Plain-language redesign strings (see .work/redesign/SPEC.md).       */
/* Shared by the Cabins page, the shell and the guided tour so a word  */
/* is defined once. No numbers here: every figure comes from the API.  */
/* ------------------------------------------------------------------ */

/** The product question, used as the h1 on the Cabins page and (without the brand) in the page title. */
export const SITE_QUESTION = "Do NASA's space-station fire tests cover this cabin's air?";
export const SITE_TITLE = "Blind Spots: do NASA's space-station fire tests cover this cabin's air?";
export const SITE_DESCRIPTION =
  "NASA burned materials aboard the ISS to learn when flames keep burning. Pick a crew cabin to see whether those tests cover its air, and which experiment would teach the most next. Machine learning that says when it does not know, on open NASA data.";
export const HERO_SENTENCE =
  "NASA burned materials aboard the ISS to learn when flames keep burning. Pick a crew cabin to see whether those tests cover its air, and which experiment would teach the most next.";
export const HERO_BYLINE = "Blind Spots · machine learning that says when it does not know · data: NASA PSI (BASS, BASS-II)";

/** Verdict lines for the answer card (icon + words; never colour alone). */
export const VERDICT_LINE = {
  insufficient_evidence: "Blind spot: none of the ISS flame tests ran in air like this.",
  extrapolation: "Partly covered: only part of this air has nearby ISS tests.",
  supported: "Covered: ISS flame tests ran in air like this.",
} as const;

/** Cabin coverage chips and the one-line definition of "nearby" (define once, explain in the tooltip). */
export const COVERAGE_LABEL = { none: "Not covered", barely: "Barely covered", covered: "Covered" } as const;
export const NEARBY_DEFINITION = "Nearby means within the model's comparison distance. See How it works.";

/** Counterfactual caption (exact wording is binding, see CONTRACTS section 0). */
export const HYPOTHETICAL_NOTE = "Hypothetical model updates, not experimental results.";
/** Shown on a blind-spot answer when related NASA ground-test studies exist for the cabin. */
export const GROUND_TESTS_NOTE = "Related NASA ground tests exist for air like this; the model does not use them. See them in the Explorer.";

/** Navigation and call-to-action labels. */
export const TOUR_LABEL = "30-second tour";
export const OPEN_IN_EXPLORER_LABEL = "Open this cabin in the Explorer";
