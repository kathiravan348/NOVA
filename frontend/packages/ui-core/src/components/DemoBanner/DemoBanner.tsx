import * as React from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "../../lib/cn";

export interface DemoBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const DemoBanner = React.forwardRef<HTMLDivElement, DemoBannerProps>(
  ({ children = "Demo data. Nothing on this screen is real.", className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="note"
        className={cn(
          "w-full flex items-center justify-center gap-2 px-4 py-2 bg-warning-subtle text-warning-text text-body-sm font-sans font-medium select-none",
          className,
        )}
        {...props}
      >
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{children}</span>
      </div>
    );
  },
);

DemoBanner.displayName = "DemoBanner";
