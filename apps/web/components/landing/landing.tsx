"use client";

import { Hero } from "./hero";
import { TerminalSection } from "./terminal-section";
import { Stats } from "./stats";

function DemoVideo() {
  return (
    <section className="px-4 pb-20 md:px-10 md:pb-28" aria-labelledby="landing-video">
      <div className="mx-auto max-w-[1200px]">
        <h2 id="landing-video" className="text-[28px] leading-[34px] font-medium tracking-[-0.02em] text-fg md:text-[40px] md:leading-[44px]">
          The 30-second tour
        </h2>
        <div className="mt-8 overflow-hidden rounded-[20px] border border-border bg-surface p-2 md:mt-10 md:rounded-[24px] md:p-3">
          <video
            src="/video/blind-spots-demo-30s.webm"
            poster="/video/poster.jpg"
            controls
            muted
            playsInline
            preload="metadata"
            className="aspect-video w-full rounded-[14px] bg-black md:rounded-[16px]"
          />
        </div>
        <p className="mt-6 text-[14px] leading-5 text-muted">Made for the NASA Space Apps Challenge 2026.</p>
      </div>
    </section>
  );
}

/** "/" = Reference A hero (header, cream canvas and footer come from SiteChrome), a Reference B black section, a Reference C stats row, then the tour video. */
export function Landing() {
  return (
    <div className="flex w-full flex-1 flex-col font-sans text-fg">
      <div className="flex min-h-[max(36rem,calc(100svh-4.5rem))] flex-col">
        <Hero />
      </div>
      <TerminalSection />
      <Stats />
      <DemoVideo />
    </div>
  );
}
