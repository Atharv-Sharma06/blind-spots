"use client";

import { Bullets, P, Section } from "./primitives";

/** AI-assistance disclosure (Space Apps: SI use must be acknowledged in descriptive text). Fixed text, no numbers. */
export function BuiltSection() {
  return (
    <Section id="built" number={8} title="How this was built" intro="What was done with AI assistance, and what the app itself does.">
      <P>Blind Spots was built with the help of Claude (Anthropic), used as an AI assistant for:</P>
      <Bullets>
        <li>
          <strong>Code:</strong> the data pipeline, the model and active-learning code, the analysis API and this web app.
        </li>
        <li>
          <strong>Curation of free-text cells:</strong> the flow schedules and outcomes written as free text in the NASA test matrices were transcribed into the curation tables twice, independently, and the two versions were adjudicated. The
          build then checks automatically that every quoted token is an exact substring of the cited NASA cell, and excludes any row that fails (section 1).
        </li>
        <li>
          <strong>Documentation drafts:</strong> first drafts of this methodology text and the project documents.
        </li>
      </Bullets>
      <P>
        <strong>What the app does not do.</strong> There is no generative AI inside the app. Its outputs are deterministic and numbers-driven: probabilities come from a Gaussian-process classifier, rankings from expected uncertainty reduction, and every
        explanation is a fixed template filled with computed numbers. The same data and settings always give the same results.
      </P>
    </Section>
  );
}
