import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, Info, CircleSlash } from "lucide-react";
import { cn } from "@/lib/cn";
import { INSUFFICIENT_EVIDENCE_TEXT } from "@/lib/copy";

const calloutVariants = cva("flex gap-2.5 rounded-md border px-3 py-2.5 text-[13px] leading-snug", {
  variants: {
    variant: {
      info: "border-border bg-subtle text-fg",
      warning: "border-warn/25 bg-warn-tint text-fg",
      // Uncertainty hue (plum): the model has too little evidence to say anything.
      insufficient: "border-plum-3 bg-plum-1 text-fg",
    },
  },
  defaultVariants: { variant: "info" },
});

const ICONS = { info: Info, warning: AlertTriangle, insufficient: CircleSlash } as const;
const ICON_COLOR = { info: "text-muted", warning: "text-warn", insufficient: "text-plum-7" } as const;

export interface CalloutProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">, VariantProps<typeof calloutVariants> {
  title?: React.ReactNode;
}

/**
 * Notice block. The "insufficient" variant always starts with the exact mandated sentence
 * (CONTRACTS section 4); children (e.g. backend `reasons`) render beneath it.
 */
export function Callout({ className, variant = "info", title, children, ...props }: CalloutProps) {
  const v = variant ?? "info";
  const Icon = ICONS[v];
  return (
    <div role={v === "info" ? "note" : "status"} className={cn(calloutVariants({ variant: v }), className)} {...props}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", ICON_COLOR[v])} aria-hidden />
      <div className="min-w-0">
        {v === "insufficient" ? (
          <>
            <p className="font-medium">{INSUFFICIENT_EVIDENCE_TEXT}</p>
            {children ? <div className="mt-1 text-muted">{children}</div> : null}
          </>
        ) : (
          <>
            {title ? <p className="font-medium">{title}</p> : null}
            {children ? <div className={cn(title && "mt-0.5", "text-muted")}>{children}</div> : null}
          </>
        )}
      </div>
    </div>
  );
}
