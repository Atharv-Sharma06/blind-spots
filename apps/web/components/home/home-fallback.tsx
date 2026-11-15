import { HeroText } from "./hero-text";
import { StepHeading } from "./step-heading";
import { PickerSkeleton } from "./cabin-picker";
import { HOME_CONTAINER } from "./home-layout";

/** Server-rendered first paint of "/cabins": the hero text and an empty card grid (no numbers, no fake status). */
export function HomeFallback() {
  return (
    <div className={HOME_CONTAINER}>
      <HeroText>
        {/* Same footprint as the tour pill, so the cards do not jump when it mounts. */}
        <div aria-hidden className="h-11 w-[10.5rem] rounded-full border border-border-strong bg-surface" />
      </HeroText>
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
