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
          "inline-flex h-4 w-7 shrink-0 items-center rounded-full border border-transparent bg-border-strong p-0.5 transition-colors",
          "data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb className="block size-3 rounded-full bg-surface transition-transform data-[state=checked]:translate-x-3" />
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
