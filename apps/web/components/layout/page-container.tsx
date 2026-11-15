import * as React from "react";
import { cn } from "@/lib/cn";

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** "full" for workspaces (map, tables); "reading" for prose (~72ch). */
  width?: "full" | "reading";
}

export function PageContainer({ width = "full", className, ...props }: PageContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full px-4 py-6 md:px-6 md:py-8", width === "full" ? "max-w-[1680px]" : "max-w-[880px]", className)}
      {...props}
    />
  );
}
