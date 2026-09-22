import * as React from "react";
import { cn } from "../../lib/cn";

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "neutral" | "error";
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, tone = "neutral", className, ...props }, ref) => {
    const isError = tone === "error";

    return (
      <div
        ref={ref}
        role={isError ? "alert" : undefined}
        className={cn(
          "flex flex-col items-center justify-center text-center py-12 px-4 max-w-md mx-auto",
          className,
        )}
        {...props}
      >
        {icon && (
          <div
            className={cn(
              "mb-4 flex items-center justify-center p-3 rounded-full bg-bg-raised text-text-muted",
              isError && "text-loss",
            )}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <h3 className="font-sans text-card-title font-semibold text-text-primary">{title}</h3>
        {description && <p className="mt-2 text-body text-text-secondary">{description}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    );
  },
);

EmptyState.displayName = "EmptyState";
