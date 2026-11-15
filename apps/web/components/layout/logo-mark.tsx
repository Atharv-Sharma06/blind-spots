import { cn } from "@/lib/cn";

/** Diamond mark: an open ink diamond (the unexplored region) around a small accent diamond (a candidate). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden className={cn("shrink-0", className)}>
      <path d="M8 1.25 14.75 8 8 14.75 1.25 8Z" stroke="var(--fg)" strokeWidth="1.25" strokeLinejoin="miter" />
      <path d="M8 5.5 10.5 8 8 10.5 5.5 8Z" fill="var(--accent)" />
    </svg>
  );
}
