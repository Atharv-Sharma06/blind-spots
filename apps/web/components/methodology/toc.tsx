"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { setSectionOpen } from "./primitives";

export interface TocItem {
  id: string;
  label: string;
}

/** Sticky table of contents; highlights the section nearest the top of the viewport. */
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
    <nav aria-label="Technical details sections" className="hidden lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:block">
      <ol className="flex gap-1.5 overflow-x-auto pb-2 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:pb-0">
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
                "flex min-h-10 items-center gap-2.5 whitespace-nowrap rounded-full py-2 pl-2 pr-4 text-[13px] ring-1 transition-colors lg:whitespace-normal",
                active === it.id ? "bg-subtle font-medium text-fg ring-accent/60" : "bg-surface text-muted ring-border hover:bg-subtle hover:text-fg",
              )}
            >
              <span
                className={cn(
                  "num inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px]",
                  active === it.id ? "bg-accent font-semibold text-[#0B0B0C]" : "bg-black/30 text-muted",
                )}
              >
                {i + 1}
              </span>
              {it.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
