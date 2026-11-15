"use client";

import { Bullets, P, Section } from "./primitives";

/**
 * "How we used SI": the short, always-visible disclosure (Space Apps requires SI use to be acknowledged in descriptive text).
 * Fixed text, no numbers. The longer account is section 8 of the technical details.
 */
export function SiNote() {
  return (
    <section id="si" aria-labelledby="si-h" className="scroll-mt-[calc(var(--header-h)+16px)]" data-testid="si-note">
      <h2 id="si-h" className="text-[20px] font-semibold tracking-[-0.015em]">
        How we used SI
      </h2>
      <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed">
        SI is the Space Apps challenge&apos;s word for AI tools such as machine learning and language models. The code, the text and the analysis pipeline were written with SI assistance (Claude, by Anthropic). Every number on this site comes from NASA data that this code processed. The sources are cited under{" "}
        <a href="#sources" className="rounded-sm text-accent underline underline-offset-2 hover:decoration-2">
          Sources and context
        </a>{" "}
        below. The app itself contains no generative AI: its model is a Gaussian-process classifier trained on the NASA data.
      </p>
    </section>
  );
}

/** AI-assistance disclosure (Space Apps: SI use must be acknowledged in descriptive text). Fixed text, no numbers. */
export function BuiltSection() {
  return (
    <Section id="built" number={8} title="How this was built" intro="What SI assistance did, and what the app itself does.">
      <P>Blind Spots was built with the help of Claude (Anthropic), used as an SI assistant for:</P>
      <Bullets>
        <li>
          <strong>Code:</strong> the data pipeline, the model and active-learning code, the analysis API and this web app.
        </li>
        <li>
          <strong>Curation of free-text cells:</strong> the flow schedules and outcomes written as free text in the NASA test matrices were transcribed into the curation tables twice, independently, and the two versions were adjudicated. The
          build then checks automatically that every quoted token is an exact substring of the cited NASA cell, and excludes any row that fails (section 1).
        </li>
        <li>
          <strong>Text:</strong> the wording of this site, this methodology page and the project documents. The numbers on the site are read from the analysis outputs, not written into the text.
        </li>
      </Bullets>
      <P>
        <strong>What the app does not do.</strong> There is no generative AI inside the app. Its outputs are deterministic and numbers-driven: probabilities come from a Gaussian-process classifier, rankings from expected uncertainty reduction, and every
        explanation is a fixed template filled with computed numbers. The same data and settings always give the same results.
      </P>
    </Section>
  );
}
