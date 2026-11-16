import { HeroText } from "./hero-text";
import { StepHeading } from "./step-heading";
import { PickerSkeleton } from "./cabin-picker";
import { StatsSkeleton } from "./stats-row";
import { HOME_BAND, HOME_CONTAINER } from "./home-layout";

/** Server-rendered first paint of "/cabins": the hero text, an empty stats row and an empty board (no numbers, no fake status). */
export function HomeFallback() {
  return (
    <div className={HOME_CONTAINER}>
      <section className={HOME_BAND}>
        <HeroText>
          {/* Same footprint as the tour pill, so the layout does not jump when it mounts. */}
          <div aria-hidden className="h-11 w-[10.5rem] rounded-full border border-fg/20 bg-surface" />
        </HeroText>
        <StatsSkeleton />
      </section>
      <section aria-labelledby="cabins-h-fallback">
        <StepHeading n={1} id="cabins-h-fallback" title="Pick a cabin" />
        <div className="mt-6">
          <PickerSkeleton />
        </div>
      </section>
      {/* Reserves the height of steps 2 and 3 (no text, no numbers) so the footer does not jump when they load. */}
      <div aria-hidden className="h-[56rem] md:h-[52rem]" />
    </div>
  );
}
