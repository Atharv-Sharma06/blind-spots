import { cn } from "@/lib/cn";

/** "1  Pick a cabin" heading with a numbered badge. Server-safe. `hintOnPhone: false` hides the hint below 640 px. */
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
    <div className={cn("flex items-start gap-3", className)}>
      <span
        aria-hidden
        className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-fg text-ui font-semibold text-surface md:size-8 md:text-prose"
      >
        {n}
      </span>
      <div className={cn("min-w-0", hintInline && "md:flex md:flex-wrap md:items-baseline md:gap-x-4")}>
        <h2 id={id} className="text-heading font-semibold tracking-[-0.015em] md:text-[1.375rem] md:leading-8">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h2>
        {hint ? <p className={cn("mt-0.5 text-prose text-muted", hintInline && "md:mt-0", !hintOnPhone && "hidden sm:block")}>{hint}</p> : null}
      </div>
    </div>
  );
}
