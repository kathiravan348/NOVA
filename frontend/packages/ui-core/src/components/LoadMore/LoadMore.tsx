import * as React from "react";
import { cn } from "../../lib/cn";
import { Button } from "../Button/Button";

export interface LoadMoreProps extends React.HTMLAttributes<HTMLDivElement> {
  /** More items exist; when false nothing renders. */
  hasMore: boolean | undefined;
  /** The next items are being fetched. */
  loading?: boolean;
  onLoadMore: () => void;
  label?: string;
}

/** A "Load more" button under a list that is fetched one page at a time. */
export const LoadMore = React.forwardRef<HTMLDivElement, LoadMoreProps>(
  ({ hasMore, loading = false, onLoadMore, label = "Load more", className, ...props }, ref) => {
    if (!hasMore) return null;
    return (
      <div ref={ref} className={cn("flex justify-center py-2", className)} {...props}>
        <Button variant="secondary" onClick={onLoadMore} disabled={loading} aria-busy={loading}>
          {loading ? "Loading…" : label}
        </Button>
      </div>
    );
  },
);
LoadMore.displayName = "LoadMore";
