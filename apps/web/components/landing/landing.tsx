"use client";

import Link from "next/link";
import { Bento } from "./bento";

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL;

const STEPS = [
  { n: "1", title: "Pick a cabin", text: "Choose the air of a spacecraft or habitat: the ISS, Orion, or a future Moon and Mars cabin." },
  { n: "2", title: "See the answer", text: "We count the ISS fire tests run in similar air. Few or none means a blind spot." },
  { n: "3", title: "What to test next", text: "A model suggests the tests that would teach us the most about that blind spot." },
] as const;

function CircleLink({ href, label, children, external }: { href: string; label: string; children: React.ReactNode; external?: boolean }) {
  const cls =
    "card flex size-14 shrink-0 items-center justify-center !rounded-full text-fg transition hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  return external ? (
    <a href={href} aria-label={label} title={label} className={cls} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <Link href={href} aria-label={label} title={label} className={cls}>
      {children}
    </Link>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z"
      />
    </svg>
  );
}

function Hero() {
  return (
    <section className="pt-10 pb-12 md:pt-8 md:pb-10" aria-labelledby="landing-question">
      <p className="text-ui font-semibold tracking-[0.2em] text-accent uppercase">Blind Spots</p>
      <h1 id="landing-question" className="mt-5 max-w-[30ch] text-[2.25rem] leading-[1.08] font-medium tracking-tight text-fg md:text-[3.25rem]">
        Do NASA&apos;s space-station fire tests cover the air of future Moon and Mars cabins?
      </h1>
      <p className="mt-6 max-w-[58ch] text-title text-muted">
        Pick a cabin and see how many ISS fire tests were run in air like it, where the blind spots are, and which test to run next.
      </p>
      <div className="mt-9 flex flex-wrap items-center gap-4">
        <Link href="/cabins" className="pill-yellow inline-flex min-h-14 items-center gap-2 px-8 text-title">
          Check a cabin <span aria-hidden="true">→</span>
        </Link>
        <div className="flex items-center gap-3">
          <CircleLink href="/cabins?demo=1" label="Watch the 30-second tour">
            <PlayIcon />
          </CircleLink>
          <span className="text-ui text-muted">Watch the 30-second tour</span>
        </div>
        {REPO_URL ? (
          <CircleLink href={REPO_URL} label="Source code on GitHub" external>
            <GitHubIcon />
          </CircleLink>
        ) : null}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="pt-20 md:pt-28" aria-labelledby="landing-how">
      <h2 id="landing-how" className="text-display font-medium text-fg">
        How it works
      </h2>
      <ol className="mt-8 grid gap-4 md:grid-cols-3 md:gap-5">
        {STEPS.map((s) => (
          <li key={s.n} className="card flex flex-col gap-4 p-7 md:p-8">
            <span className="flex size-12 items-center justify-center rounded-full bg-subtle text-fg" aria-hidden="true">
              <span className="dotnum text-[1.75rem]">{s.n}</span>
            </span>
            <h3 className="text-heading font-medium text-fg">{s.title}</h3>
            <p className="text-prose text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DemoVideo() {
  return (
    <section className="pt-20 pb-16 md:pt-28 md:pb-24" aria-labelledby="landing-video">
      <h2 id="landing-video" className="text-display font-medium text-fg">
        The 30-second tour
      </h2>
      <div className="card mt-8 overflow-hidden p-2 md:p-3">
        <video
          src="/video/blind-spots-demo-30s.webm"
          poster="/video/poster.jpg"
          controls
          muted
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-[calc(var(--radius-2xl)-8px)] bg-black"
        />
      </div>
      <p className="mt-6 text-ui text-muted">
        Made for the NASA Space Apps Challenge 2026.
      </p>
    </section>
  );
}

export function Landing() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 md:px-8">
      <Hero />
      <Bento />
      <HowItWorks />
      <DemoVideo />
    </div>
  );
}
