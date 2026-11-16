"use client";

import * as React from "react";

/**
 * Scroll reveal: content fades in and rises ~20 px the first time it enters the viewport.
 * Never leaves content hidden: shown at once under reduced motion, without IntersectionObserver,
 * during the tour (?demo=1, sticky for the page session), and by a 1.5 s safety timer. Transform/opacity only.
 */
let tourSeen = false;

function skipAnimation(): boolean {
  if (typeof window === "undefined") return true;
  if (/[?&]demo=1(?:&|$)/.test(window.location.search)) tourSeen = true;
  if (tourSeen) return true;
  if (typeof IntersectionObserver === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

type RevealProps = {
  children?: React.ReactNode;
  as?: React.ElementType;
  delay?: number;
  className?: string;
} & Record<`data-${string}`, string | undefined>;

export function Reveal({ children, as: Tag = "div", delay = 0, className, ...rest }: RevealProps) {
  const ref = React.useRef<HTMLElement | null>(null);
  const [state, setState] = React.useState<"pending" | "armed" | "shown">("pending");

  React.useEffect(() => {
    const el = ref.current;
    if (!el || skipAnimation()) {
      setState("shown");
      return;
    }
    setState("armed");
    let fired = false;
    const io = new IntersectionObserver(
      (entries) => {
        fired = true;
        if (entries.some((e) => e.isIntersecting)) {
          setState("shown");
          io.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px" },
    );
    io.observe(el);
    // Safety: if the observer never reports, show the content anyway.
    const t = window.setTimeout(() => {
      if (!fired) setState("shown");
    }, 1500);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, []);

  const style = delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined;
  return (
    <Tag ref={ref} data-reveal={state} className={className} style={style} {...rest}>
      {children}
    </Tag>
  );
}

/** Subtle scroll-linked drift (translateY only, capped at `max` px). Off under reduced motion and during the tour. */
export function Parallax({ children, className, factor = 0.12, max = 40 }: { children: React.ReactNode; className?: string; factor?: number; max?: number }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || skipAnimation()) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const y = Math.min(max, Math.max(0, window.scrollY * factor));
      el.style.transform = y > 0 ? `translate3d(0, ${y.toFixed(1)}px, 0)` : "";
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, [factor, max]);
  return (
    <div ref={ref} className={className} data-parallax="">
      {children}
    </div>
  );
}
