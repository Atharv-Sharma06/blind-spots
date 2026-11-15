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
  h1: "text-[22px] font-semibold leading-tight tracking-[-0.02em] md:text-[26px]",
  h2: "text-[15px] font-semibold tracking-[-0.01em]",
  h3: "text-[13px] font-semibold",
} as const;

export function SectionHeader({ title, description, actions, as: Tag = "h2", className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <Tag className={cn("text-fg", SIZES[Tag])}>{title}</Tag>
        {description ? <p className={cn("mt-1 max-w-[62ch] text-muted", Tag === "h1" ? "text-[15px]" : "text-[13px]")}>{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
