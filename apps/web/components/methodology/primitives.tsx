"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import { DisclosureChevron } from "@/components/ui/disclosure";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiQuery } from "@/hooks/api";

const SECTION_EVENT = "hiw:section";

/** Open ("*" = all) or close a technical section from anywhere (table of contents, group links, expand-all). */
export function setSectionOpen(id: string, open: boolean): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SECTION_EVENT, { detail: { id, open } }));
}

/**
 * One numbered technical section. Collapsed by default: the title and its one-line intro are always in the page
 * (so anchors work), the body is mounted only when opened (charts measure a visible container, nothing heavy renders
 * for readers who stop at the summary). A `#id` or `#id-sub` hash, the table of contents and "Show all" open it.
 */
export function Section({ id, number, title, intro, children }: { id: string; number: number; title: string; intro?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      if (h !== id && !h.startsWith(`${id}-`)) return;
      setOpen(true);
      if (h !== id) window.setTimeout(() => document.getElementById(h)?.scrollIntoView({ block: "start" }), 60);
    };
    fromHash();
    const onCommand = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; open: boolean }>).detail;
      if (d.id === "*" || d.id === id) setOpen(d.open);
    };
    window.addEventListener("hashchange", fromHash);
    window.addEventListener(SECTION_EVENT, onCommand);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener(SECTION_EVENT, onCommand);
    };
  }, [id]);

  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-[calc(var(--header-h)+16px)] border-t border-border first:border-t-0">
      <h2 id={`${id}-h`} className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((o) => !o)}
          className="group/section flex min-h-14 w-full items-center gap-3 rounded-[14px] py-4 text-left text-[18px] font-semibold tracking-[-0.015em] hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span className="num inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-subtle text-[13px] font-normal text-muted ring-1 ring-border group-hover/section:text-accent">{number}</span>
          <span className="min-w-0 flex-1">{title}</span>
          <DisclosureChevron open={open} className="size-4" />
        </button>
      </h2>
      {intro ? <p className="-mt-1.5 max-w-[68ch] pb-4 pl-10 text-[13px] leading-relaxed text-muted">{intro}</p> : null}
      {open ? (
        <div id={`${id}-body`} className="space-y-6 pb-10 pl-0 pt-1 sm:pl-10">
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function Sub({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <div id={id} className="scroll-mt-[calc(var(--header-h)+16px)]">
      <h3 className="mb-2 text-[14px] font-semibold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("max-w-[72ch] text-[14px] leading-relaxed text-fg", className)}>{children}</p>;
}

export function Bullets({ children }: { children: ReactNode }) {
  return <ul className="max-w-[72ch] list-disc space-y-2 pl-5 text-[14px] leading-relaxed marker:text-gap">{children}</ul>;
}

export function Mono({ children }: { children: ReactNode }) {
  return <code className="num rounded-[6px] bg-subtle px-1.5 py-px text-[12.5px] text-fg ring-1 ring-border [overflow-wrap:anywhere]">{children}</code>;
}

/** Legible formula block (plain text in mono; the symbols are defined directly underneath). */
export function Formula({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <figure className="max-w-[72ch] rounded-[20px] border border-border bg-bg/60 px-5 py-4">
      <div tabIndex={0} className="num overflow-x-auto whitespace-pre text-[13px] leading-relaxed text-fg focus-visible:outline-2 focus-visible:outline-accent" role="math" aria-label={label}>
        {children}
      </div>
    </figure>
  );
}

export function ExtLink({ href, children }: { href: string | null | undefined; children: ReactNode }) {
  if (!href) return <span>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-baseline gap-1 rounded-sm text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent focus-visible:outline-2 focus-visible:outline-accent">
      <span>{children}</span>
      <ExternalLink className="size-3 shrink-0 translate-y-0.5" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/** Loading, typed error, or content for one query. */
export function QueryBoundary<T>({ query, children, rows = 3 }: { query: ApiQuery<T>; children: (data: T) => ReactNode; rows?: number }) {
  if (query.isPending) {
    return (
      <div role="status" aria-label="Loading" className="space-y-1.5">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-[10px]" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return <ErrorState code={query.error.code} error={query.error} message={query.error.message} onRetry={() => void query.refetch()} compact />;
  }
  if (!query.data) return null;
  return <>{children(query.data.data)}</>;
}

/** Definition-list row grid for small key/value facts. */
export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid max-w-[72ch] grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,14rem)_1fr]">
      {items.map((it) => (
        <div key={it.label} className="contents">
          <dt className="text-[13px] text-muted">{it.label}</dt>
          <dd className="num min-w-0 break-words text-[13px]">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "n=12" style chip text. */
export const nText = (n: number | null | undefined) => (typeof n === "number" ? `n=${n}` : "n unavailable");

/** Inline value from a query inside running text (no block elements); shows an ellipsis while loading. */
export function inline<T>(query: ApiQuery<T>, pick: (data: T) => ReactNode): ReactNode {
  if (query.isError) return <span className="text-muted">unavailable</span>;
  if (!query.data) return <span className="text-muted" aria-label="loading">…</span>;
  return pick(query.data.data);
}
