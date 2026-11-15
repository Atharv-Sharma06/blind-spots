"use client";

import { Hero } from "./hero";
import { CabinPicker } from "./cabin-picker";
import { AnswerCard } from "./answer-card";
import { NextTests } from "./next-tests";
import { useHomeSelection } from "./use-home-selection";
import { useLegacyRedirect } from "./legacy-redirect";
import { StatsRow } from "./stats-row";
import { HOME_BAND, HOME_CONTAINER } from "./home-layout";

/** The Cabins page: title and question, a stats row on the beige band, 1 the cabin board, 2 the answer, 3 what to test next. */
export function HomePage() {
  const { cabin, material, setCabin, setMaterial } = useHomeSelection();
  const legacy = useLegacyRedirect();

  if (legacy) {
    // An old Explorer link (/?group=...): forwarded to /explore with the same query string.
    return (
      <div className={HOME_CONTAINER}>
        <p role="status" className="text-prose text-muted">
          Opening the Explorer&hellip;
        </p>
      </div>
    );
  }

  return (
    <div className={HOME_CONTAINER}>
      <section className={HOME_BAND}>
        <Hero />
        <StatsRow onSelect={setCabin} />
      </section>
      <CabinPicker cabin={cabin} onSelect={setCabin} />
      <AnswerCard cabin={cabin} material={material} onMaterialChange={setMaterial} />
      <NextTests cabin={cabin} material={material} />
    </div>
  );
}
