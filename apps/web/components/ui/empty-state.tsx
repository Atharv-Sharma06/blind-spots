import * as React from "react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Tighter padding for use inside side panels. */
  compact?: boolean;
  align?: "start" | "center";
  className?: string;
}

export function EmptyState({ icon, title, description, action, compact, align = "start", className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col gap-1", align === "center" ? "items-center text-center" : "items-start text-left", compact ? "py-3" : "py-8", className)}>
      {icon ? <div className="mb-1 text-muted [&_svg]:size-5">{icon}</div> : null}
      <p className="text-[13px] font-medium text-fg">{title}</p>
      {description ? <p className="max-w-[56ch] text-[13px] text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
