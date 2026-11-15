import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

export const badgeVariants = cva(
  "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 text-xs font-medium leading-none [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-border bg-subtle text-fg",
        observed: "border-observed/25 bg-observed-tint text-observed",
        gap: "border-gap/30 bg-gap-tint text-gap-fg",
        accent: "border-accent/25 bg-accent-tint text-accent",
        warn: "border-warn/25 bg-warn-tint text-warn",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
