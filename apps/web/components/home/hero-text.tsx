/** The hero lines (server-safe, shared by the live hero and the page fallback). */
export const HERO_TITLE = "Do NASA's space-station fire tests cover this cabin's air?";
/** One short sentence on every screen size, so the first row of cabin cards shows above the fold on phones. */
export const HERO_SENTENCE = "NASA burned materials aboard the ISS to learn when flames keep burning.";

export function HeroText({ children }: { children?: React.ReactNode }) {
  return (
    <div data-tour="hero" className="flex flex-col items-start gap-3 md:gap-4">
      <h1 className="max-w-[20ch] text-[clamp(1.875rem,1.25rem+2.6vw,3.25rem)] font-medium leading-[1.06] tracking-[-0.035em] text-fg [text-wrap:balance] sm:max-w-[24ch]">
        Do NASA&apos;s <span className="whitespace-nowrap">space-station</span> fire tests cover this cabin&apos;s air?
      </h1>
      <p className="max-w-[46ch] text-[1rem] font-light leading-6 text-muted md:text-lg md:leading-7">{HERO_SENTENCE}</p>
      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  );
}
