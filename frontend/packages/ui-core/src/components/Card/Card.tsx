import * as React from "react";
import { cn } from "../../lib/cn";

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, title, actions, footer, children, ...props }, ref) => {
    const hasHeader = title !== undefined || actions !== undefined;

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border border-border-default bg-bg-raised overflow-hidden",
          className,
        )}
        {...props}
      >
        {hasHeader && (
          <div className="flex items-center justify-between gap-4 border-b border-border-default p-4">
            {title !== undefined && (
              <h3 className="font-sans text-card-title font-semibold text-text-primary">{title}</h3>
            )}
            {actions !== undefined && (
              <div className="flex items-center gap-2 shrink-0">{actions}</div>
            )}
          </div>
        )}
        {children !== undefined && <div className="p-4">{children}</div>}
        {footer !== undefined && <div className="border-t border-border-default p-4">{footer}</div>}
      </div>
    );
  },
);

Card.displayName = "Card";
