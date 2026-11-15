"use client";

import type { ApiQuery } from "@/hooks/api";
import type { MethodologyResponse } from "@/lib/types";
import { DISCLAIMER } from "@/lib/copy";
import { Callout } from "@/components/ui/callout";
import { Bullets, QueryBoundary, Section } from "./primitives";

/** Fixed caveats that describe how the records and model are built (no data-dependent numbers). */
const STATIC_LIMITATIONS = [
  "Most outcomes come from ordered lists of falling airflow settings, so many “sustained” labels follow from list order. Flame-went-out rows are a small minority.",
  "Oxygen level is tied to the campaign (BASS-II mostly lower oxygen, BASS mostly air-like), so oxygen effects are hard to separate for some materials.",
  "Some flame-setup labels rest on indirect evidence, such as publication titles, or are missing. Read setup-specific results with care.",
  "Some flame-went-out results are steps where airflow was switched off. They are not a real flame-out limit and can make the model look better.",
  "BASS-II airflow displays lag the true flow, so flow may not be steady at every step.",
  "The model has no combustion physics. It only interpolates the records, plus a fixed pressure assumption.",
  "Replays use real held-out experiments. They show how selection rules behave on this data, not that rankings will hold on new experiments.",
  "The public site may serve a saved snapshot of the same analysis. Custom targets and candidates then need the live service.",
];

export function LimitationsSection({ methodology }: { methodology: ApiQuery<MethodologyResponse> }) {
  return (
    <Section id="limitations" number={7} title="Limitations" intro="Read these before relying on any number.">
      <QueryBoundary query={methodology} rows={4}>
        {(m) => (
          <>
            <Bullets>
              {m.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
              {STATIC_LIMITATIONS.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </Bullets>
            <Callout variant="info" title="Status of the output">
              {DISCLAIMER} Candidates are research candidates: they need expert review and safety checks.
            </Callout>
          </>
        )}
      </QueryBoundary>
    </Section>
  );
}
