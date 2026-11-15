"use client";

import { Bullets, P, Section } from "./primitives";

/**
 * "How we used SI": the short, always-visible disclosure (Space Apps requires SI use to be acknowledged in descriptive text).
 * Fixed text, no numbers. The longer account is section 8 of the technical details.
 */
export function SiNote() {
  return (
    <section id="si" aria-labelledby="si-h" className="card scroll-mt-[calc(var(--header-h)+16px)] p-6 sm:p-8" data-testid="si-note">
      <h2 id="si-h" className="text-[20px] font-medium tracking-[-0.015em]">
        How we used SI
      </h2>
      <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed">
        SI is the Space Apps word for AI tools. The code, text and analysis were written with SI help (Claude, by Anthropic). Every number comes from NASA data that this code processed; see{" "}
        <a href="#sources" className="rounded-sm text-accent underline underline-offset-2 hover:decoration-2">
          Sources
        </a>
        . The app itself has no generative AI. Its model is a Gaussian-process classifier (a statistical model) trained on NASA data.
      </p>
    </section>
  );
}

/** AI-assistance disclosure (Space Apps: SI use must be acknowledged in descriptive text). Fixed text, no numbers. */
export function BuiltSection() {
  return (
    <Section id="built" number={8} title="How this was built" intro="What SI helped with, and what the app does.">
      <div className="card max-w-[78ch] space-y-3 p-5 sm:p-7">
      <P>We used Claude (Anthropic) as an SI assistant for:</P>
      <Bullets>
        <li>
          <strong>Code:</strong> the data pipeline, the model, the analysis API and this web app.
        </li>
        <li>
          <strong>Typing up free text:</strong> NASA test tables hold flow schedules and outcomes as free text. We transcribed them twice, independently, and settled any differences. The build then checks that every quoted
          text is an exact copy of the NASA cell, and leaves out any row that fails (section 1).
        </li>
        <li>
          <strong>Writing:</strong> the wording of this site and its documents. Numbers on the site are read from the analysis outputs, not typed into the text.
        </li>
      </Bullets>
      </div>
      <P>
        <strong>What the app does not do.</strong> It has no generative AI. Probabilities come from a Gaussian-process classifier, rankings from expected uncertainty reduction, and every explanation is a fixed template filled with computed
        numbers. The same data and settings always give the same results.
      </P>
    </Section>
  );
}
