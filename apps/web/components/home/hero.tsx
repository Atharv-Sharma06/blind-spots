"use client";

import { HomeTour } from "@/components/demo/home-tour";
import { HeroText } from "./hero-text";

/** Hero: the question, one sentence, one muted method line, and the quiet "30-second tour" button. */
export function Hero() {
  return (
    <HeroText>
      <HomeTour />
    </HeroText>
  );
}
