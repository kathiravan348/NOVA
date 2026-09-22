import * as React from "react";
import type { VariantProps } from "class-variance-authority";
import { Button, buttonVariants } from "../Button/Button";
import { cn } from "../../lib/cn";

export interface IconButtonProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label">,
    VariantProps<typeof buttonVariants> {
  "aria-label": string;
  icon: React.ReactNode;
  loading?: boolean;
  asChild?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ "aria-label": ariaLabel, icon, className, size = "md", loading = false, ...props }, ref) => {
    const squareSizeClass = size === "sm" ? "w-8 p-0" : size === "lg" ? "w-12 p-0" : "w-10 p-0";

    return (
      <Button
        ref={ref}
        aria-label={ariaLabel}
        size={size}
        loading={loading}
        className={cn("shrink-0", squareSizeClass, className)}
        {...props}
      >
        {loading ? null : (
          <span className="inline-flex items-center justify-center shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
      </Button>
    );
  },
);

IconButton.displayName = "IconButton";
