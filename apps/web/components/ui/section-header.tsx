import * as React from "react";
import { cn } from "@/lib/cn";

export interface SectionHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned controls. */
  actions?: React.ReactNode;
  /** "h1" for page titles (larger), "h2" / "h3" for panel sections. */
  as?: "h1" | "h2" | "h3";
  className?: string;
}

const SIZES = {
  h1: "text-heading font-semibold tracking-tight md:text-display",
  h2: "text-title font-semibold",
  h3: "text-ui font-semibold",
} as const;

export function SectionHeader({ title, description, actions, as: Tag = "h2", className }: SectionHeaderProps) {
  return (
    <div className={cn("flex min-w-0 items-start justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0">
        <Tag className={cn("text-fg", SIZES[Tag])}>{title}</Tag>
        {description ? <p className={cn("mt-1 max-w-[62ch] text-muted", Tag === "h1" ? "text-prose" : "text-ui")}>{description}</p> : null}
      </div>
      {actions ? <div className="flex min-w-0 max-w-full items-center gap-2">{actions}</div> : null}
    </div>
  );
}
