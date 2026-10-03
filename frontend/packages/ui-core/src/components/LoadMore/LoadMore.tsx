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
  /** Also load when the button scrolls into view (infinite scroll); the button stays as a fallback. */
  auto?: boolean;
}

/** A "Load more" button under a list that is fetched one page at a time. */
export const LoadMore = React.forwardRef<HTMLDivElement, LoadMoreProps>(
  (
    {
      hasMore,
      loading = false,
      onLoadMore,
      label = "Load more",
      auto = false,
      className,
      ...props
    },
    ref,
  ) => {
    const [node, setNode] = React.useState<HTMLDivElement | null>(null);
    const latest = React.useRef(onLoadMore);
    latest.current = onLoadMore;
    const setRef = React.useCallback(
      (element: HTMLDivElement | null) => {
        setNode(element);
        if (typeof ref === "function") ref(element);
        else if (ref) ref.current = element;
      },
      [ref],
    );
    React.useEffect(() => {
      if (!auto || !hasMore || loading || !node || typeof IntersectionObserver === "undefined")
        return;
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) latest.current();
      });
      observer.observe(node);
      return () => observer.disconnect();
    }, [auto, hasMore, loading, node]);
    if (!hasMore) return null;
    return (
      <div ref={setRef} className={cn("flex justify-center py-2", className)} {...props}>
        <Button variant="secondary" onClick={onLoadMore} disabled={loading} aria-busy={loading}>
          {loading ? "Loading…" : label}
        </Button>
      </div>
    );
  },
);
LoadMore.displayName = "LoadMore";
