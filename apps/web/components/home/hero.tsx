"use client";

import { HomeTour } from "@/components/demo/home-tour";
import { HeroText } from "./hero-text";

/**
 * The tour launcher as an outlined pill with a round black play mark (Reference C's quiet text buttons).
 * Styled from here through HomeTour's className so the tour logic stays untouched.
 */
const TOUR_PILL =
  "min-h-11 gap-2.5 rounded-full border border-fg/20 bg-surface py-1.5 pl-1.5 pr-4 text-fg no-underline hover:bg-subtle hover:text-fg hover:no-underline [&>span]:inline-flex [&>span]:size-8 [&>span]:items-center [&>span]:justify-center [&>span]:rounded-full [&>span]:bg-fg [&>span]:pl-0.5 [&>span]:text-[12px] [&>span]:text-bg";

/** Hero: the page title, the question, one short sentence, and the "30-second tour" pill. */
export function Hero() {
  return (
    <HeroText>
      <HomeTour className={TOUR_PILL} />
    </HeroText>
  );
}
