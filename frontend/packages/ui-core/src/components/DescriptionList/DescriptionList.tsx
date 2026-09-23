import * as React from "react";
import { cn } from "../../lib/cn";

export interface DescriptionItem {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Mono font, right-aligned. */
  numeric?: boolean;
}

export interface DescriptionListProps extends React.HTMLAttributes<HTMLDListElement> {
  items: DescriptionItem[];
  /** 2 = two columns from `md`. */
  columns?: 1 | 2;
}

export const DescriptionList = React.forwardRef<HTMLDListElement, DescriptionListProps>(
  ({ items, columns = 1, className, ...props }, ref) => {
    return (
      <dl
        ref={ref}
        className={cn("grid grid-cols-1 gap-x-8", columns === 2 && "md:grid-cols-2", className)}
        {...props}
      >
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-baseline justify-between gap-4 border-b border-border-default py-2"
          >
            <dt className="shrink-0 text-body-sm text-text-muted">{item.label}</dt>
            <dd
              className={cn(
                "min-w-0 text-right text-body text-text-primary",
                item.numeric && "font-mono text-number",
              )}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    );
  },
);

DescriptionList.displayName = "DescriptionList";
