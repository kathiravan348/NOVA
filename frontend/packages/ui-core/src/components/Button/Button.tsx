import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center font-sans font-medium whitespace-nowrap transition-colors select-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-bg-ground disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-action text-[white] hover:opacity-90 active:opacity-100",
        secondary:
          "bg-bg-surface border border-border-strong text-text-primary hover:bg-bg-raised active:bg-bg-surface",
        ghost: "bg-transparent text-text-primary hover:bg-bg-surface active:bg-bg-raised",
        danger:
          "bg-loss-subtle border border-loss text-loss-text hover:opacity-90 active:opacity-100",
      },
      size: {
        sm: "h-8 px-3 gap-1.5 text-body-sm",
        md: "h-10 px-4 gap-2 text-body",
        lg: "h-12 px-6 gap-2.5 text-body",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      asChild = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    const spinnerSize =
      size === "sm"
        ? "h-3.5 w-3.5 border"
        : size === "lg"
          ? "h-5 w-5 border-2"
          : "h-4 w-4 border-2";

    return (
      <Comp
        ref={ref}
        aria-busy={loading ? "true" : undefined}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && (
              <span
                data-testid="button-spinner"
                className={cn(
                  "inline-block shrink-0 animate-spin rounded-pill border-current border-t-transparent",
                  spinnerSize,
                )}
                aria-hidden="true"
              />
            )}
            {children}
          </>
        )}
      </Comp>
    );
  },
);

Button.displayName = "Button";
