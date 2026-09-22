import * as React from "react";
import { Badge, type BadgeProps } from "../Badge/Badge";
import { cn } from "../../lib/cn";

const dotToneClasses: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-text-muted",
  info: "bg-action",
  success: "bg-profit",
  warning: "bg-warning",
  danger: "bg-loss",
};

export interface StatusBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
  label: React.ReactNode;
}

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, tone = "neutral", label, ...props }, ref) => {
    return (
      <Badge ref={ref} tone={tone} className={cn("rounded-pill px-2.5", className)} {...props}>
        <span
          data-testid="status-dot"
          className={cn("inline-block h-1.5 w-1.5 rounded-pill shrink-0", dotToneClasses[tone])}
          aria-hidden="true"
        />
        <span>{label}</span>
      </Badge>
    );
  },
);

StatusBadge.displayName = "StatusBadge";
