/** The hero lines (server-safe, shared by the live hero and the page fallback). */
export const HERO_TITLE = "Do NASA's space-station fire tests cover this cabin's air?";
/** One short sentence on every screen size. */
export const HERO_SENTENCE = "NASA burned materials aboard the ISS to learn when flames keep burning.";

/** Compact page title ("Cabins") and the question; `children` (the tour button) sits at the right from 768 px. */
export function HeroText({ children }: { children?: React.ReactNode }) {
  return (
    <div data-tour="hero" className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-prose font-medium text-muted">Cabins</p>
        <h1 className="max-w-[24ch] text-[clamp(1.75rem,1.15rem+1.8vw,2.5rem)] font-medium leading-[1.08] tracking-[-0.03em] text-fg [text-wrap:balance]">
          Do NASA&apos;s <span className="whitespace-nowrap">space-station</span> fire tests cover this cabin&apos;s air?
        </h1>
        <p className="max-w-[52ch] text-prose text-muted">{HERO_SENTENCE}</p>
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}
