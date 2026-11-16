import { cn } from "@/lib/cn";

/** "1  Pick a cabin": a column-style title (28 px, medium) with a small outlined numbered badge. The hint is optional. Server-safe. */
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
      <span
        aria-hidden
        className="num inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-fg/20 bg-surface text-ui font-medium text-fg"
      >
        {n}
      </span>
      <div className={cn("min-w-0", hintInline && "md:flex md:flex-wrap md:items-baseline md:gap-x-4")}>
        <h2 id={id} className="text-[1.5rem] font-medium leading-[1.2] tracking-[-0.02em] text-fg md:text-[1.75rem] md:leading-[2.125rem]">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h2>
        {hint ? <p className={cn("mt-0.5 text-prose text-muted", hintInline && "md:mt-0", !hintOnPhone && "hidden sm:block")}>{hint}</p> : null}
      </div>
    </div>
  );
}
