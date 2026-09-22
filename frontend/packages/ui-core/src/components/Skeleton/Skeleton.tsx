import * as React from "react";
import { cn } from "../../lib/cn";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-testid="skeleton"
        aria-hidden="true"
        className={cn("animate-pulse rounded-md bg-border-default", className)}
        {...props}
      />
    );
  },
);

Skeleton.displayName = "Skeleton";
