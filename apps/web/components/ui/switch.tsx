"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

export interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  /** Visible label; when omitted pass aria-label. */
  label?: React.ReactNode;
}

export const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, SwitchProps>(
  ({ className, label, id, ...props }, ref) => {
    const autoId = React.useId();
    const sid = id ?? autoId;
    const control = (
      <SwitchPrimitive.Root
        ref={ref}
        id={sid}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-white/[0.06] bg-[#2a2a2f] p-[3px] shadow-[inset_0_1px_2px_rgb(0_0_0/0.5)] transition-colors before:absolute before:-inset-2 before:content-[''] max-md:before:-inset-3",
          "data-[state=checked]:border-transparent data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb className="block size-[18px] rounded-full bg-[#f4f4f5] shadow-[0_1px_3px_rgb(0_0_0/0.5)] transition-[transform,background-color] data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-on-accent" />
      </SwitchPrimitive.Root>
    );
    if (!label) return control;
    return (
      <div className="inline-flex items-center gap-2">
        {control}
        <label htmlFor={sid} className="cursor-pointer text-ui text-fg">
          {label}
        </label>
      </div>
    );
  },
);
Switch.displayName = "Switch";
