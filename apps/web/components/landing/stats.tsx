"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { CANDIDATE_FRAMING } from "@/lib/copy";
import { Hold, RoundLink } from "./ui";
import { TickGauge } from "./tick-gauge";
import { useHeadlineCounts, useTopCut } from "./use-landing-data";

const NUM = "text-[40px] leading-[44px] font-medium tracking-[-0.02em] tabular-nums text-[#161616] md:text-[48px] md:leading-[52px]";

function Cell({ title, children, href, hrefLabel }: { title: string; children: React.ReactNode; href: string; hrefLabel: string }) {
  return (
    <div className="flex min-h-[15rem] flex-col justify-between gap-6 p-6 md:p-8">
      <p className="text-[16px] leading-6 text-[#161616]">{title}</p>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">{children}</div>
        <RoundLink href={href} label={hrefLabel} className="border-[#161616]/20">
          <ArrowRight className="size-[18px]" aria-hidden="true" />
        </RoundLink>
      </div>
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 max-w-[24ch] text-[14px] leading-5 text-[#6F6D68]">{children}</p>;
}

/** Reference C stats row on the beige band: a big number, a radial tick gauge, a big number. */
export function Stats() {
  const { q, iss, moonMars, none, total } = useHeadlineCounts();
  const { cut, failed } = useTopCut();
  const ready = iss !== null && moonMars !== null && none !== null && total !== null;
  const digits = cut?.match(/^(\d+(?:\.\d+)?)\s*%$/)?.[1] ?? null;
  const gaugeValue = ready && total > 0 ? none / total : null;

  return (
    <section aria-labelledby="landing-today" className="px-4 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-[1200px]">
        <h2 id="landing-today" className="text-[28px] leading-[34px] font-medium tracking-[-0.02em] text-[#161616] md:text-[40px] md:leading-[44px]">
          Where the tests are, today
        </h2>
        <div className="mt-8 grid overflow-hidden rounded-[24px] bg-[#ECE9E0] md:mt-10 md:grid-cols-3 md:rounded-[32px] md:[&>*+*]:border-l md:[&>*+*]:border-[#161616]/10 max-md:[&>*+*]:border-t max-md:[&>*+*]:border-[#161616]/10">
          <Cell title="Nearby ISS test results" href="/explore" hrefLabel="Open the Explorer">
            {iss ? (
              <p className={NUM}>{iss.comparable_observations}</p>
            ) : q.isError ? (
              <p className="text-[16px] text-[#6F6D68]">Could not load the count.</p>
            ) : (
              <Hold className="h-11 w-24 md:h-[52px]" label="Loading the ISS count" />
            )}
            <Caption>ISS fire tests run in air like the ISS cabin</Caption>
          </Cell>

          <div className="flex min-h-[15rem] flex-col justify-between gap-5 p-6 md:p-8">
            <p className="text-[16px] leading-6 text-[#161616]">Cabins with no nearby ISS test</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {ready ? (
                <TickGauge
                  value={gaugeValue}
                  label={none}
                  sublabel={`of ${total} cabins`}
                  ariaLabel={`${none} of ${total} cabins are not covered: they have no nearby ISS test result`}
                />
              ) : q.isError ? (
                <p className="text-[16px] text-[#6F6D68]">Could not load the counts.</p>
              ) : (
                <Hold className="size-44 rounded-full" label="Loading the cabin counts" />
              )}
              {ready ? (
                <div className="max-w-[18ch] text-[14px] leading-5 text-[#6F6D68]">
                  <p className="text-[16px] leading-6 font-medium text-[#161616]">not covered</p>
                  <p className="mt-1">
                    Moon &amp; Mars air: {moonMars.comparable_observations} nearby ISS test results
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <Cell title="What to test next" href="/cabins" hrefLabel="Check a cabin">
            {digits ? (
              <p className={NUM}>
                {digits}
                <span className="ml-1 text-[0.6em]">%</span>
              </p>
            ) : cut ? (
              <p className={NUM}>{cut}</p>
            ) : failed ? (
              <p className="text-[16px] text-[#6F6D68]">Not available</p>
            ) : (
              <Hold className="h-11 w-28 md:h-[52px]" label="Loading the top test" />
            )}
            <Caption>The top test cuts uncertainty by this much</Caption>
          </Cell>
        </div>
        <p className="mt-5 max-w-[80ch] text-[12px] leading-4 text-[#6F6D68]">{CANDIDATE_FRAMING}</p>
      </div>
    </section>
  );
}
