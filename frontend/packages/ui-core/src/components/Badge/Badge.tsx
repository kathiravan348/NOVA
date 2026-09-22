import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2 py-0.5 font-sans text-label uppercase font-semibold select-none rounded-md transition-colors",
  {
    variants: {
      tone: {
        neutral: "bg-bg-raised text-text-secondary border border-border-default",
        info: "bg-action-subtle text-action-text",
        success: "bg-profit-subtle text-profit-text",
        warning: "bg-warning-subtle text-warning-text",
        danger: "bg-loss-subtle text-loss-text",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone = "neutral", children, ...props }, ref) => {
    return (
      <span ref={ref} className={cn(badgeVariants({ tone }), className)} {...props}>
        {children}
      </span>
    );
  },
);

Badge.displayName = "Badge";
