import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Rotating chevron for any disclosure trigger. Pass `open` when the state is known; otherwise it follows a
 *  surrounding `<details>` (group/disclosure) or a Radix trigger with data-state="open" (group/trigger). */
export function DisclosureChevron({ open, className }: { open?: boolean; className?: string }) {
  return (
    <ChevronRight
      aria-hidden
      className={cn(
        "size-3.5 shrink-0 text-muted transition-transform duration-150",
        open === undefined
          ? "group-open/disclosure:rotate-90 group-data-[state=open]/trigger:rotate-90"
          : open && "rotate-90",
        className,
      )}
    />
  );
}

export interface DisclosureProps extends Omit<React.DetailsHTMLAttributes<HTMLElement>, "title"> {
  /** Trigger text. Keep it short and specific ("Why is this region uncertain?"). */
  summary: React.ReactNode;
  defaultOpen?: boolean;
  /** "muted" (default): quiet secondary detail; "strong": the trigger reads as a sub-heading. */
  tone?: "muted" | "strong";
  summaryClassName?: string;
  contentClassName?: string;
}

/**
 * One disclosure for the whole app: native <details> (keyboard and screen-reader support for free, works without
 * JS), a small chevron instead of the UA triangle, no box around it. Content is indented to the summary text.
 */
export function Disclosure({
  summary,
  defaultOpen,
  tone = "muted",
  className,
  summaryClassName,
  contentClassName,
  children,
  ...props
}: DisclosureProps) {
  return (
    <details className={cn("group/disclosure", className)} {...(defaultOpen ? { open: true } : {})} {...props}>
      <summary
        data-disclosure=""
        className={cn(
          "inline-flex min-h-8 items-center gap-1.5 rounded-sm text-ui transition-colors select-none max-md:min-h-10 max-md:py-1",
          tone === "muted" ? "text-muted hover:text-fg" : "font-medium text-fg",
          summaryClassName,
        )}
      >
        <DisclosureChevron />
        <span className="min-w-0">{summary}</span>
      </summary>
      <div className={cn("mt-1.5 pl-5 text-ui text-muted max-md:mt-1", contentClassName)}>{children}</div>
    </details>
  );
}
