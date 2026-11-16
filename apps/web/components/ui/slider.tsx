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

/** Single- or range-slider. The number of thumbs follows the length of value/defaultValue. Black filled line, light grey
 *  remainder, and a round black knob inside a 40 px target. */
export const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ className, value, defaultValue, thumbLabels, ...props }, ref) => {
    const count = (value ?? defaultValue ?? [0]).length;
    return (
      <SliderPrimitive.Root
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        className={cn("relative flex h-7 w-full touch-none max-md:h-10 select-none items-center data-[disabled]:opacity-50", className)}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-[3px] grow rounded-full bg-border-strong">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-fg" />
        </SliderPrimitive.Track>
        {Array.from({ length: count }, (_, i) => (
          <SliderPrimitive.Thumb
            key={i}
            aria-label={thumbLabels?.[i]}
            className="relative block size-10 rounded-full outline-offset-0 before:absolute before:top-1/2 before:left-1/2 before:size-[18px] before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border-2 before:border-surface before:bg-fg before:shadow-[0_0_0_1px_var(--soft-line)] before:transition-colors before:content-[''] hover:before:bg-[var(--ink-hover)] focus-visible:bg-accent/15"
          />
        ))}
      </SliderPrimitive.Root>
    );
  },
);
Slider.displayName = "Slider";
