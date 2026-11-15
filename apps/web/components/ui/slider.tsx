"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/cn";

export interface SliderProps extends Omit<React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>, "value" | "defaultValue"> {
  value?: number[];
  defaultValue?: number[];
  /** One label per thumb for assistive tech, e.g. ["Minimum oxygen", "Maximum oxygen"]. */
  thumbLabels?: string[];
}

/** Single- or range-slider. The number of thumbs follows the length of value/defaultValue. */
export const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ className, value, defaultValue, thumbLabels, ...props }, ref) => {
    const count = (value ?? defaultValue ?? [0]).length;
    return (
      <SliderPrimitive.Root
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        className={cn("relative flex h-5 w-full touch-none select-none items-center data-[disabled]:opacity-50", className)}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-1 grow rounded-sm bg-border">
          <SliderPrimitive.Range className="absolute h-full rounded-sm bg-fg" />
        </SliderPrimitive.Track>
        {Array.from({ length: count }, (_, i) => (
          <SliderPrimitive.Thumb
            key={i}
            aria-label={thumbLabels?.[i]}
            className="relative block size-4 rounded-full border border-fg bg-surface transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-subtle"
          />
        ))}
      </SliderPrimitive.Root>
    );
  },
);
Slider.displayName = "Slider";
