import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Tones carry one meaning each (CONTRACTS section 9):
 *  neutral / outline: no data meaning; observed: blue measurements; gap: amber, coverage gaps ONLY;
 *  accent: teal, research candidates / focus / selection ONLY; plum: uncertainty / insufficient evidence;
 *  warn: red TEXT only (no fill), extrapolation and real warnings.
 * For verdicts use <VerdictBadge verdict=... /> rather than picking a tone by hand.
 */
export const badgeVariants = cva(
  "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 text-label font-medium leading-none [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-border bg-subtle text-fg",
        outline: "border-border bg-surface text-fg",
        observed: "border-observed/25 bg-observed-tint text-observed",
        gap: "border-gap/30 bg-gap-tint text-gap-fg",
        accent: "border-accent/25 bg-accent-tint text-accent",
        plum: "border-plum-3 bg-plum-1 text-plum-7",
        warn: "border-transparent bg-transparent px-0 text-warn",
        quiet: "border-transparent bg-transparent px-0 text-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export type VerdictKind = "supported" | "extrapolation" | "insufficient_evidence";

const VERDICT_TONE = { supported: "outline", extrapolation: "warn", insufficient_evidence: "plum" } as const;
const VERDICT_LABEL: Record<VerdictKind, string> = {
  supported: "Supported",
  extrapolation: "Extrapolation",
  insufficient_evidence: "Insufficient evidence",
};

export interface VerdictBadgeProps extends Omit<BadgeProps, "tone"> {
  verdict: VerdictKind | null | undefined;
}

/** Verdict badge: Supported = neutral outline, Extrapolation = red text only, Insufficient evidence = plum.
 *  Never amber (coverage gaps) or teal (candidates). Children override the label. */
export function VerdictBadge({ verdict, children, ...props }: VerdictBadgeProps) {
  if (!verdict) return null;
  return (
    <Badge tone={VERDICT_TONE[verdict]} data-verdict={verdict} {...props}>
      {children ?? VERDICT_LABEL[verdict]}
    </Badge>
  );
}
