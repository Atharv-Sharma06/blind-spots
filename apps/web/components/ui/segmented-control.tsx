"use client";

import * as React from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/cn";

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onValueChange: (value: string) => void;
  "aria-label": string;
  size?: "sm" | "md";
  className?: string;
}

/** Single-choice toggle group. A selection can be changed but never cleared. */
export function SegmentedControl({ options, value, onValueChange, size = "md", className, ...aria }: SegmentedControlProps) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v)}
      aria-label={aria["aria-label"]}
      className={cn("inline-flex rounded-md border border-border bg-subtle p-0.5", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            "inline-flex items-center justify-center rounded-sm px-2.5 text-ui font-medium text-muted transition-colors",
            "hover:text-fg disabled:opacity-50 data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-[0_0_0_1px_var(--border)]",
            size === "sm" ? "h-6 max-md:h-10" : "h-7 max-md:h-10",
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
