import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { CoverageQuery, UnavailableDay, UnavailableQuery } from "@nova/contracts";
import { Card, LoadMore, Select } from "@nova/ui-core";
import { UnavailableDataTable } from "@nova/ui-trading";
import { useUnavailableDays } from "@nova/services";
import { QueryError } from "../../components/QueryState";

export function UnavailableDataPanel({ query }: { query: CoverageQuery }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<NonNullable<UnavailableQuery["status"]>>("unavailable");
  const history = useUnavailableDays({ ...query, status });
  const recheck = (row: UnavailableDay) => {
    void navigate("/data-jobs/new", {
      state: {
        symbols: [row.symbol],
        timeframe: row.timeframe,
        from: row.day,
        to: row.day,
        mode: "overwrite",
      },
    });
  };
  return (
    <Card title="Unavailable data">
      <div className="flex flex-col gap-4">
        <p className="text-body-sm text-text-muted">
          These trading dates still have no usable candle after a successful broker response. This
          records what the broker returned; it does not confirm why the data is absent. Routine
          downloads skip recorded dates. Check again opens an overwrite download plan; recovered
          dates move to Resolved automatically.
        </p>
        <Select
          label="Availability"
          value={status}
          onChange={(e) => setStatus(e.target.value as NonNullable<UnavailableQuery["status"]>)}
          options={[
            { value: "unavailable", label: "Broker unavailable" },
            { value: "resolved", label: "Resolved" },
            { value: "all", label: "All history" },
          ]}
        />
        <UnavailableDataTable
          rows={history.data?.pages.flatMap((page) => page.items) ?? []}
          loading={history.isPending}
          onRecheck={recheck}
          renderJobLink={(content, jobId) => (
            <Link className="text-action-text hover:underline" to={`/data-jobs/${jobId}`}>
              {content}
            </Link>
          )}
          error={
            history.isError ? (
              <QueryError error={history.error} onRetry={() => void history.refetch()} />
            ) : undefined
          }
        />
        <LoadMore
          hasMore={history.hasNextPage}
          loading={history.isFetchingNextPage}
          onLoadMore={() => void history.fetchNextPage()}
        />
      </div>
    </Card>
  );
}
