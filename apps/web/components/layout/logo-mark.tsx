import { cn } from "@/lib/cn";

/**
 * Diamond mark in a small black disc: an open white diamond (the unexplored region) around a small green diamond
 * (a candidate). No agency logo.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#161616]", className)}>
      <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
        <path d="M8 1.25 14.75 8 8 14.75 1.25 8Z" stroke="#ffffff" strokeWidth="1.25" strokeLinejoin="miter" />
        <path d="M8 5.5 10.5 8 8 10.5 5.5 8Z" fill="#2FD067" />
      </svg>
    </span>
  );
}
