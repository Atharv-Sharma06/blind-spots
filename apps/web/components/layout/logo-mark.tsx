import { cn } from "@/lib/cn";

/**
 * Diamond mark in a small dark disc: an open light diamond (the unexplored region) around a small signal-yellow
 * diamond (a candidate).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[linear-gradient(160deg,#242428,#141416)] shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]",
        className,
      )}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
        <path d="M8 1.25 14.75 8 8 14.75 1.25 8Z" stroke="var(--fg)" strokeWidth="1.25" strokeLinejoin="miter" />
        <path d="M8 5.5 10.5 8 8 10.5 5.5 8Z" fill="var(--accent)" />
      </svg>
    </span>
  );
}
