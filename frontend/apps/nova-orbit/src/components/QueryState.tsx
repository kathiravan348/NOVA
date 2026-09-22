import type { ReactNode } from "react";
import { Link } from "react-router";
import type { UseQueryResult } from "@tanstack/react-query";
import { AlertTriangle, SearchX } from "lucide-react";
import { Button, EmptyState, Skeleton } from "@nova/ui-core";
import { ApiRequestError } from "@nova/services";

export interface QueryErrorProps {
  error: unknown;
  onRetry: () => void;
}

/** Error block for a failed query, with a retry button. */
export function QueryError({ error, onRetry }: QueryErrorProps) {
  return (
    <EmptyState
      tone="error"
      icon={<AlertTriangle className="h-6 w-6" />}
      title="Couldn't load this data"
      description={error instanceof Error ? error.message : "Something went wrong."}
      action={
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

export interface QueryStateProps<T> {
  query: UseQueryResult<T>;
  /** Where "Not found" links back to. */
  back: { to: string; label: string };
  children: (data: T) => ReactNode;
}

/** Loading, 404, error and success states for a single-item query. */
export function QueryState<T>({ query, back, children }: QueryStateProps<T>) {
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (query.isError) {
    if (query.error instanceof ApiRequestError && query.error.status === 404) {
      return (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title="Not found"
          description={query.error.message}
          action={
            <Button asChild variant="secondary">
              <Link to={back.to}>{back.label}</Link>
            </Button>
          }
        />
      );
    }
    return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <>{children(query.data)}</>;
}
