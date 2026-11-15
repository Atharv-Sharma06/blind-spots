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

/** Single- or range-slider. The number of thumbs follows the length of value/defaultValue. Yellow filled line, dotted
 *  remainder, and a yellow triangular marker inside a 40 px round target. */
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
        <SliderPrimitive.Track className="relative h-[3px] grow rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.42)_1px,transparent_1.6px)] bg-[length:8px_3px] bg-repeat-x">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-accent" />
        </SliderPrimitive.Track>
        {Array.from({ length: count }, (_, i) => (
          <SliderPrimitive.Thumb
            key={i}
            aria-label={thumbLabels?.[i]}
            className="relative block size-10 rounded-full outline-offset-0 before:absolute before:bottom-[calc(50%-4px)] before:left-1/2 before:h-[13px] before:w-[15px] before:-translate-x-1/2 before:bg-accent before:transition-colors before:content-[''] before:[clip-path:polygon(0_0,100%_0,50%_100%)] hover:before:bg-[#ffe24a] focus-visible:bg-accent/15"
          />
        ))}
      </SliderPrimitive.Root>
    );
  },
);
Slider.displayName = "Slider";
