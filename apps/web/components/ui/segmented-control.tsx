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
      className={cn("inline-flex rounded-full border border-white/[0.06] bg-[#141416] p-1 shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)]", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            "inline-flex items-center justify-center rounded-full px-3.5 text-ui font-medium text-muted transition-colors",
            "hover:text-fg disabled:opacity-50 data-[state=on]:bg-[#2a2a2f] data-[state=on]:text-fg data-[state=on]:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_2px_6px_-2px_rgb(0_0_0/0.8)]",
            size === "sm" ? "h-8 max-md:h-10" : "h-9 max-md:h-10",
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
