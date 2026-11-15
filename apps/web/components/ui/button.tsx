import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex max-w-full shrink-0 items-center justify-center gap-2 border text-center text-ui max-md:leading-tight md:whitespace-nowrap font-medium transition-[background-color,border-color,color,filter] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Black pill (radius 14): the one primary action per view.
        primary: "pill-ink",
        // Outlined pill: the secondary action.
        secondary: "pill-outline",
        ghost: "rounded-full border-transparent bg-transparent text-fg hover:bg-fg/[0.06]",
        // Circular outlined icon button (pair with size="icon"; give it an aria-label).
        icon: "btn-round",
      },
      size: {
        // Compact desktop sizes. On phones (max-md) every size is at least 40 px tall, even when a caller passes its own
        // h-*; the label may wrap instead of forcing sideways scroll. max-md rules are emitted after plain utilities.
        sm: "h-9 px-3.5 max-md:h-auto max-md:min-h-10 max-md:px-4 max-md:py-1",
        md: "h-10 px-4.5 max-md:h-auto max-md:min-h-10 max-md:px-4.5 max-md:py-1",
        lg: "h-[52px] px-6 text-prose max-md:h-auto max-md:min-h-12 max-md:px-5 max-md:py-1 [&_svg]:size-4.5",
        icon: "size-10 rounded-full p-0 [&_svg]:size-[18px]",
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
