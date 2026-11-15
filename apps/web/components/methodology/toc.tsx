"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

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
    <nav aria-label="Methodology sections" className="lg:sticky lg:top-[calc(var(--header-h)+24px)]">
      <p className="mb-2 hidden text-xs font-medium uppercase tracking-wide text-muted lg:block">On this page</p>
      <ol className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
        {items.map((it, i) => (
          <li key={it.id} className="shrink-0">
            <a
              href={`#${it.id}`}
              aria-current={active === it.id ? "location" : undefined}
              onClick={() => setActive(it.id)}
              className={cn(
                "flex items-baseline gap-2 whitespace-nowrap rounded-md border-l-2 px-2.5 py-1.5 text-[13px] transition-colors lg:whitespace-normal",
                active === it.id ? "border-accent bg-accent-tint font-medium text-fg" : "border-transparent text-muted hover:bg-subtle hover:text-fg",
              )}
            >
              <span className="num text-xs text-muted">{i + 1}</span>
              {it.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
