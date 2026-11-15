"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List ref={ref} className={cn("flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border bg-subtle p-1", className)} {...props} />
  ),
);
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex h-9 shrink-0 items-center rounded-full px-4 max-md:h-10 text-ui font-medium text-muted transition-colors",
        "hover:text-fg disabled:opacity-50 data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-[0_0_0_1px_var(--border)]",
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
