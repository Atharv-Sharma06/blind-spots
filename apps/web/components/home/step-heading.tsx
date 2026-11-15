import { cn } from "@/lib/cn";

/** "1  Pick a cabin": a short heading with a round numbered badge. The hint is optional; leave it out unless it adds something. Server-safe. */
export function StepHeading({
  n,
  id,
  title,
  hint,
  hintOnPhone = true,
  hintInline = false,
  className,
}: {
  n: number;
  id: string;
  title: string;
  hint?: string;
  hintOnPhone?: boolean;
  /** From 768 px the hint sits on the heading's line instead of under it (saves one row of height). */
  hintInline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 md:gap-4", className)}>
      {/* Charcoal coin with a yellow numeral, like the reference's round dark controls. */}
      <span
        aria-hidden
        className="num inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-[linear-gradient(160deg,#2A2A2F_0%,#18181B_100%)] text-prose font-semibold text-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_10px_24px_-12px_rgb(0_0_0/0.9)] md:size-11 md:text-title"
      >
        {n}
      </span>
      <div className={cn("min-w-0", hintInline && "md:flex md:flex-wrap md:items-baseline md:gap-x-4")}>
        <h2 id={id} className="text-heading font-medium tracking-[-0.02em] text-fg md:text-[1.625rem] md:leading-8">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h2>
        {hint ? <p className={cn("mt-0.5 text-prose text-muted", hintInline && "md:mt-0", !hintOnPhone && "hidden sm:block")}>{hint}</p> : null}
      </div>
    </div>
  );
}
