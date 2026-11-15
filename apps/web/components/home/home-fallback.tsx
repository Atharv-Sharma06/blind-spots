import { HeroText } from "./hero-text";
import { StepHeading } from "./step-heading";
import { PickerSkeleton } from "./cabin-picker";
import { HOME_CONTAINER } from "./home-layout";

/** Server-rendered first paint of "/": the hero text and an empty card grid (no numbers, no fake status). */
export function HomeFallback() {
  return (
    <div className={HOME_CONTAINER}>
      <HeroText />
      <section aria-labelledby="cabins-h-fallback">
        <StepHeading n={1} id="cabins-h-fallback" title="Pick a cabin" hint="Each card shows the cabin's air and whether the ISS flame tests cover it." hintOnPhone={false} hintInline />
        <div className="mt-5 md:mt-5">
          <PickerSkeleton />
        </div>
      </section>
      {/* Reserves the height of steps 2 and 3 (no text, no numbers) so the footer does not jump when they load. */}
      <div aria-hidden className="h-[56rem] md:h-[52rem]" />
    </div>
  );
}
