/** The hero lines (server-safe, shared by the live hero and the page fallback). */
export const HERO_TITLE = "Do NASA's space-station fire tests cover this cabin's air?";
/** One short sentence on every screen size, so the first row of cabin cards shows above the fold on phones. */
export const HERO_SENTENCE = "NASA burned materials aboard the ISS to learn when flames keep burning.";

export function HeroText({ children }: { children?: React.ReactNode }) {
  return (
    <div data-tour="hero" className="flex flex-col items-start gap-2 md:gap-3">
      <h1 className="max-w-[22ch] text-[clamp(1.625rem,1.2rem+2vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-fg [text-wrap:balance] sm:max-w-[26ch]">
        Do NASA&apos;s <span className="whitespace-nowrap">space-station</span> fire tests cover this cabin&apos;s air?
      </h1>
      <p className="text-[1rem] leading-6 text-fg/80 md:text-lg md:leading-7">{HERO_SENTENCE}</p>
      <div className="-ml-2">{children}</div>
    </div>
  );
}
