"use client";

import { HomeTour } from "@/components/demo/home-tour";
import { HeroText } from "./hero-text";

/**
 * The tour launcher as a charcoal pill with a round yellow play mark (the reference's circular controls).
 * Styled from here through HomeTour's className so the tour logic stays untouched.
 */
const TOUR_PILL =
  "min-h-11 gap-2.5 rounded-full border border-border-strong bg-surface py-1.5 pl-1.5 pr-4 text-fg no-underline shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_12px_28px_-16px_rgb(0_0_0/0.9)] hover:bg-subtle hover:text-fg hover:no-underline [&>span]:inline-flex [&>span]:size-8 [&>span]:items-center [&>span]:justify-center [&>span]:rounded-full [&>span]:bg-accent [&>span]:pl-0.5 [&>span]:text-[12px] [&>span]:text-on-accent";

/** Hero: the question, one short sentence, and the "30-second tour" pill. */
export function Hero() {
  return (
    <HeroText>
      <HomeTour className={TOUR_PILL} />
    </HeroText>
  );
}
