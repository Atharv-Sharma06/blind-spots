import Link from "next/link";
import { ArrowDown, ArrowUpRight, Map } from "lucide-react";
import { RoundLink, FOCUS } from "./ui";

const SOURCES = ["NASA PSI", "BASS", "BASS-II", "NTRS"] as const;

/** The product screenshot, as a fully rounded pill that sits inside the headline between two words. */
function PillImage() {
  return (
    <span
      aria-hidden="true"
      className="mx-[0.1em] inline-block h-[0.82em] w-[1.6em] translate-y-[0.06em] overflow-hidden rounded-full bg-[#161616] align-baseline"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/video/poster.jpg" alt="" width={1600} height={900} className="size-full object-cover" />
    </span>
  );
}

export function Hero() {
  return (
    <section className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 md:px-10" aria-labelledby="landing-question">
      <div className="flex flex-1 flex-col items-center justify-center py-12 text-center md:py-16">
        <h1
          id="landing-question"
          aria-label="Where ISS tests end."
          className="text-[clamp(2.9rem,14vw,4.5rem)] leading-[0.92] font-extrabold tracking-[-0.045em] text-[#161616] md:text-[clamp(4rem,9.4vw,9rem)]"
        >
          <span aria-hidden="true">
            Where ISS
            <PillImage />
            tests
            <br />
            end.
          </span>
        </h1>
        <p className="mt-7 max-w-[46ch] text-[16px] leading-6 text-[#161616]/70 md:mt-9 md:text-[18px] md:leading-7">
          Do NASA&apos;s space-station fire tests cover the air of future Moon and Mars cabins? Pick a cabin and see how many were run in air like it.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 md:mt-9">
          <Link
            href="/cabins"
            className={`inline-flex h-11 min-w-[9rem] items-center justify-center rounded-full bg-[#2FD067] px-7 text-[12px] font-semibold tracking-[0.06em] text-[#0B2414] uppercase transition hover:brightness-95 ${FOCUS}`}
          >
            Check a cabin
          </Link>
          <Link
            href="/cabins?demo=1"
            aria-label="Watch the tour"
            className={`group inline-flex items-center gap-3 rounded-full text-[11px] font-medium tracking-[0.08em] text-[#161616] uppercase md:text-[12px] ${FOCUS}`}
          >
            <span>Watch the tour</span>
            <span className="inline-flex size-11 items-center justify-center rounded-full border border-[#161616]/15 transition-colors group-hover:bg-[#161616]/5">
              <ArrowUpRight className="size-[18px]" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </div>

      {/* Bottom strip: quick link, the data sources as plain grey words, scroll down. */}
      <div className="grid items-center gap-x-6 gap-y-1 border-t border-[#161616]/10 py-3 md:grid-cols-[1fr_auto_1fr]">
        <Link
          href="/explore"
          className={`flex w-fit items-center gap-3 rounded-full py-1 text-[11px] font-medium tracking-[0.08em] text-[#161616] uppercase ${FOCUS}`}
        >
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-[#161616] text-[#F2EFE8]">
            <Map className="size-[18px]" aria-hidden="true" />
          </span>
          Open the Explorer
        </Link>
        <ul aria-label="Data from" className="flex flex-wrap items-center gap-x-7 gap-y-1 md:justify-center md:gap-x-10">
          {SOURCES.map((s) => (
            <li key={s} className="text-[14px] font-semibold tracking-[0.02em] text-[#161616]/50 md:text-[16px]">
              {s}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 md:justify-end">
          <span className="text-[11px] font-medium tracking-[0.08em] text-[#161616] uppercase">Scroll down</span>
          <RoundLink href="#how" label="Scroll down to how it works">
            <ArrowDown className="size-[18px]" aria-hidden="true" />
          </RoundLink>
        </div>
      </div>
    </section>
  );
}
