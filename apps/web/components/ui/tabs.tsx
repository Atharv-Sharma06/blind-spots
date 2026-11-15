"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List ref={ref} className={cn("flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/[0.06] bg-[#141416] p-1 shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)]", className)} {...props} />
  ),
);
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex h-9 shrink-0 items-center rounded-full px-4 max-md:h-10 text-ui font-medium text-muted transition-colors",
        "hover:text-fg disabled:opacity-50 data-[state=active]:bg-[#2a2a2f] data-[state=active]:text-fg data-[state=active]:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_2px_6px_-2px_rgb(0_0_0/0.8)]",
        className,
      )}
      {...props}
    />
  ),
);
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(
  ({ className, ...props }, ref) => <TabsPrimitive.Content ref={ref} className={cn("pt-4", className)} {...props} />,
);
TabsContent.displayName = "TabsContent";
