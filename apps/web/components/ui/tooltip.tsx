"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/cn";

export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps {
  /** Tooltip content. Keep it short; do not put essential information only here. */
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}

/** Wraps a single focusable child. Opens on hover and keyboard focus. */
export function Tooltip({ content, children, side = "top", align = "center", className }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-50 max-w-xs rounded-md border border-ink-card bg-ink-card px-2.5 py-1.5 text-xs leading-snug text-on-ink shadow-popover",
            "data-[state=delayed-open]:animate-fade-in data-[state=instant-open]:animate-fade-in",
            className,
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
