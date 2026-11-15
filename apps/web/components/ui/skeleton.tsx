import * as React from "react";
import { cn } from "@/lib/cn";

/** Loading placeholder. Pulses only when the user has not asked for reduced motion. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("rounded-sm bg-subtle motion-safe:animate-pulse", className)} {...props} />;
}
