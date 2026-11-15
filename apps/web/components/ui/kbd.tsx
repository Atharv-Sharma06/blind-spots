import * as React from "react";
import { cn } from "@/lib/cn";

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-border-strong bg-subtle px-1.5 font-mono text-label font-medium text-muted",
        className,
      )}
      {...props}
    />
  );
}
