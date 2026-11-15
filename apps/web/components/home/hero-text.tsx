/** The three hero lines (server-safe, shared by the live hero and the page fallback). */
export const HERO_TITLE = "Do NASA's space-station fire tests cover this cabin's air?";
export const HERO_SENTENCE =
  "NASA burned materials aboard the ISS to learn when flames keep burning. Pick a crew cabin to see whether those tests cover its air, and which experiment would teach the most next.";
/** Phones get the same idea in one short line so the first row of cabin cards shows above the fold. */
export const HERO_SENTENCE_SHORT = "NASA burned materials aboard the ISS. Pick a cabin to see if those tests cover its air.";
export const HERO_METHOD = "Blind Spots · machine learning that says when it does not know · data: NASA PSI (BASS, BASS-II)";
export const HERO_METHOD_SHORT = "Data: NASA ISS burn tests (BASS, BASS-II)";

export function HeroText({ children }: { children?: React.ReactNode }) {
  return (
    <div data-tour="hero" className="flex flex-col items-start gap-3 md:gap-4">
      <h1 className="max-w-[22ch] text-[clamp(1.625rem,1.2rem+2vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-fg [text-wrap:balance] sm:max-w-[26ch]">
        Do NASA&apos;s <span className="whitespace-nowrap">space-station</span> fire tests cover this cabin&apos;s air?
      </h1>
      <p className="max-w-[48rem] text-[1rem] leading-6 text-fg/80 md:text-lg md:leading-7">
        <span className="sm:hidden">{HERO_SENTENCE_SHORT}</span>
        <span className="hidden sm:inline">{HERO_SENTENCE}</span>
      </p>
      <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-0 sm:gap-x-5 sm:gap-y-1">
        {/* On phones the tour button leads the row, inline with the short data line. */}
        <p className="text-label text-muted">
          <span className="sm:hidden">{HERO_METHOD_SHORT}</span>
          <span className="hidden sm:inline">{HERO_METHOD}</span>
        </p>
        <div className="order-first -ml-2 sm:order-none sm:ml-0">{children}</div>
      </div>
    </div>
  );
}
