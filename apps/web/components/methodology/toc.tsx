"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { setSectionOpen } from "./primitives";

export interface TocItem {
  id: string;
  label: string;
}

/** Table of contents as a row of outlined pills; highlights the section nearest the top of the viewport. */
export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    if (els.length === 0 || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-60px 0px -65% 0px", threshold: 0 },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);

  return (
    <nav aria-label="Technical details sections" className="min-w-0">
      <ol className="-mx-4 flex flex-nowrap gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {items.map((it, i) => (
          <li key={it.id} className="shrink-0">
            <a
              href={`#${it.id}`}
              aria-current={active === it.id ? "location" : undefined}
              onClick={() => {
                setActive(it.id);
                setSectionOpen(it.id, true);
              }}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                active === it.id ? "border-fg bg-surface text-fg" : "border-border-strong bg-transparent text-muted hover:border-fg hover:text-fg",
              )}
            >
              <span className="text-[12px] opacity-70">{i + 1}</span>
              {it.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
