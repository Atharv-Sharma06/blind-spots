import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-ui font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-fg bg-fg text-surface hover:bg-[#2c2c31]",
        secondary: "border-border bg-surface text-fg hover:border-border-strong hover:bg-subtle",
        ghost: "border-transparent bg-transparent text-fg hover:bg-subtle",
      },
      size: {
        sm: "h-7 px-2.5",
        md: "h-8 px-3",
        lg: "h-9 px-4 text-prose",
        icon: "size-8 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        {...(asChild ? {} : { type: type ?? "button" })}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
