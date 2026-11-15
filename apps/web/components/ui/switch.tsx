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
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border-strong bg-subtle p-[3px] transition-colors before:absolute before:-inset-2 before:content-[''] max-md:before:-inset-3",
          "data-[state=checked]:border-fg data-[state=checked]:bg-fg disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb className="block size-[18px] rounded-full bg-fg/70 transition-[transform,background-color] data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-white" />
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
