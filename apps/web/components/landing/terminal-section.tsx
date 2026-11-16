"use client";

import * as React from "react";
import { Hold } from "./ui";
import { useHeadlineCounts, useTopCut } from "./use-landing-data";

function Frame({ children }: { children: React.ReactNode }) {
  // A thin blue selection box with square corner handles, around the product image.
  const handle = "absolute size-2.5 border border-[#4C7DFF] bg-white";
  return (
    <div className="relative border border-[#4C7DFF]">
      <span aria-hidden="true" className={`${handle} -top-[5px] -left-[5px]`} />
      <span aria-hidden="true" className={`${handle} -top-[5px] -right-[5px]`} />
      <span aria-hidden="true" className={`${handle} -bottom-[5px] -left-[5px]`} />
      <span aria-hidden="true" className={`${handle} -right-[5px] -bottom-[5px]`} />
      {children}
    </div>
  );
}

function Prompt({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="mt-4 first:mt-0 text-white">
      <span aria-hidden="true" className="mr-2 text-[#8A8A8A]">
        ›
      </span>
      <span className="text-[#8A8A8A]">{n}</span> {children}
    </p>
  );
}

function Line({ children, blue }: { children: React.ReactNode; blue?: boolean }) {
  return (
    <p className="pl-5" style={blue ? { color: "#7CA6FF" } : undefined}>
      <span aria-hidden="true" className="mr-2">
        ●
      </span>
      {children}
    </p>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="pl-5 text-[#A3A3A3]">{children}</p>;
}

function TerminalCard() {
  const { q, iss, moonMars, total } = useHeadlineCounts();
  const { cut, failed } = useTopCut();
  const ready = iss !== null && moonMars !== null && total !== null;
  const countsHold = q.isError ? (
    <Line>Could not load the counts.</Line>
  ) : (
    <Hold dark className="ml-5 h-4 w-56 rounded" label="Loading the counts" />
  );
  return (
    <div className="overflow-hidden rounded-[10px] bg-[#1E1E1E] text-left shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9),0_0_0_1px_rgb(255_255_255/0.08)]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3" aria-hidden="true">
        <span className="size-3 rounded-full bg-[#FF5F57]" />
        <span className="size-3 rounded-full bg-[#FEBC2E]" />
        <span className="size-3 rounded-full bg-[#28C840]" />
      </div>
      <div className="px-4 py-4 font-mono text-[13px] leading-[22px] text-[#D4D4D4] md:px-5">
        <Prompt n="1">Pick a cabin</Prompt>
        <Note>Choose the air of a spacecraft or habitat: the ISS, Orion, or a future Moon and Mars cabin.</Note>
        {ready ? <Line>{total} cabins to choose from</Line> : countsHold}

        <Prompt n="2">See the answer</Prompt>
        <Note>We count the ISS fire tests run in similar air. Few or none means a blind spot.</Note>
        {ready ? (
          <>
            <Line>{iss.comparable_observations} nearby ISS test results for ISS air</Line>
            <Line blue>{moonMars.comparable_observations} for Moon &amp; Mars air</Line>
          </>
        ) : (
          countsHold
        )}

        <Prompt n="3">What to test next</Prompt>
        <Note>A model suggests the tests that would teach us the most about that blind spot.</Note>
        {cut ? (
          <Line>The top test cuts uncertainty by {cut}</Line>
        ) : failed ? (
          <Line>The top test is not available.</Line>
        ) : (
          <Hold dark className="ml-5 h-4 w-56 rounded" label="Loading the top test" />
        )}
      </div>
    </div>
  );
}

/** Reference B: pure black, a two-line white headline, then the three steps (terminal card) beside the product. */
export function TerminalSection() {
  return (
    <section id="how" aria-labelledby="landing-how" className="scroll-mt-4 bg-black px-4 py-20 text-white md:px-10 md:py-28">
      <p className="text-center text-[12px] font-medium tracking-[0.08em] text-white/60 uppercase">How it works</p>
      <h2
        id="landing-how"
        className="mx-auto mt-3 max-w-[22ch] text-center text-[clamp(2rem,6vw,3.5rem)] leading-[1.06] font-bold tracking-[-0.035em] text-balance"
      >
        A model that says when it does not know
      </h2>

      <div className="mx-auto mt-14 grid w-full max-w-[1160px] items-center gap-8 md:mt-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
        <TerminalCard />
        <Frame>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/video/poster.jpg"
            alt="The Blind Spots Cabins page: a cabin's air, the answer and the next test."
            width={1600}
            height={900}
            className="block aspect-[16/10] w-full object-cover object-left-top"
          />
        </Frame>
      </div>
    </section>
  );
}
