"use client";

import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiQuery } from "@/hooks/api";

/** Top-level page section with an anchor target for the table of contents. */
export function Section({ id, number, title, intro, children }: { id: string; number: number; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-[calc(var(--header-h)+16px)] border-t border-border pt-8 first:border-t-0 first:pt-0">
      <h2 id={`${id}-h`} className="text-[20px] font-semibold tracking-[-0.015em]">
        <span className="num mr-2 text-muted">{number}</span>
        {title}
      </h2>
      {intro ? <p className="mt-2 max-w-[68ch] text-[14px] leading-relaxed text-muted">{intro}</p> : null}
      <div className="mt-5 space-y-6">{children}</div>
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
  return <ul className="max-w-[72ch] list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed marker:text-muted">{children}</ul>;
}

export function Mono({ children }: { children: ReactNode }) {
  return <code className="num rounded-sm bg-subtle px-1 py-px text-[12.5px] [overflow-wrap:anywhere]">{children}</code>;
}

/** Legible formula block (plain text in mono; the symbols are defined directly underneath). */
export function Formula({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <figure className="max-w-[72ch] rounded-md border border-border bg-surface px-4 py-3">
      <div tabIndex={0} className="num overflow-x-auto whitespace-pre text-[13px] leading-relaxed text-fg focus-visible:outline-2 focus-visible:outline-accent" role="math" aria-label={label}>
        {children}
      </div>
    </figure>
  );
}

export function ExtLink({ href, children }: { href: string | null | undefined; children: ReactNode }) {
  if (!href) return <span>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-baseline gap-1 text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
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
          <Skeleton key={i} className="h-8 w-full" />
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
