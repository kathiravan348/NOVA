import { useEffect, useState } from "react";
import type { BacktestRun } from "@nova/contracts";
import { useBacktestTimeline, useStrategy } from "@nova/services";
import { DateTimePicker, Input, LoadMore, Modal } from "@nova/ui-core";
import { TradeTimeline, type TradeTimelineClock } from "@nova/ui-trading";
import { QueryError } from "../../components/QueryState";
import { exitReasonLabel } from "../../lib/format";

interface TimelineDialogProps {
  run: BacktestRun;
  onOpenChange: (open: boolean) => void;
}

const trades = (count: number) => `${count} ${count === 1 ? "trade" : "trades"}`;

export function TimelineDialog({ run, onOpenChange }: TimelineDialogProps) {
  const [stock, setStock] = useState("");
  const [symbol, setSymbol] = useState("");
  const [from, setFrom] = useState<string | undefined>(run.from);
  const [to, setTo] = useState<string | undefined>(run.to);
  useEffect(() => {
    if (stock.trim().toUpperCase() === symbol) return;
    const timer = setTimeout(() => setSymbol(stock.trim().toUpperCase()), 400);
    return () => clearTimeout(timer);
  }, [stock, symbol]);
  const query = useBacktestTimeline(run.id, { symbol: symbol || undefined, from, to });
  const strategy = useStrategy(run.strategyId);
  const spec = strategy.data?.versions.find((v) => v.version === run.strategyVersion)?.spec;
  const averaging = Boolean(spec && "averaging" in spec && spec.averaging);
  const timeframe = spec?.timeframe;
  const clock: TradeTimelineClock =
    run.dataSource === "recorded" || timeframe?.endsWith("s")
      ? "seconds"
      : timeframe === "1d"
        ? "none"
        : "minutes";
  const bound = (value: string | null) =>
    value ? (value < run.from ? run.from : value > run.to ? run.to : value) : undefined;
  const events = query.data ?? [];
  return (
    <Modal open onOpenChange={onOpenChange} title="Timeline" description={run.name} size="xl">
      <div className="flex flex-col gap-4">
        <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-border-default bg-bg-surface pb-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Input
              containerClassName="col-span-2 sm:col-span-1"
              label="Stock"
              type="search"
              placeholder="All stocks"
              value={stock}
              onChange={(event) => setStock(event.target.value)}
            />
            <DateTimePicker
              label="From"
              mode="date"
              value={from}
              min={run.from}
              max={to ?? run.to}
              onChange={(value) => setFrom(bound(value))}
            />
            <DateTimePicker
              label="To"
              mode="date"
              value={to}
              min={from ?? run.from}
              max={run.to}
              onChange={(value) => setTo(bound(value))}
            />
          </div>
          <p className="text-body-sm text-text-muted">
            {[
              query.isSuccess ? trades(query.total) : "",
              averaging ? "Added buys are shown as one buy at the average price." : "",
            ]
              .filter(Boolean)
              .join(". ")}
          </p>
        </div>
        <p className="text-body-sm text-text-muted">
          Cash after is the money available after each trade, for the whole backtest even when you
          filter a stock.
        </p>
        {query.isError ? (
          <QueryError error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <TradeTimeline
            events={events}
            clock={clock}
            reasonLabels={exitReasonLabel}
            loading={query.isPending}
            emptyState="No trades for these filters"
          />
        )}
        <LoadMore
          auto
          hasMore={!query.isError && query.hasNextPage}
          loading={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
          label="Load more trades"
        />
        {query.isSuccess && !query.hasNextPage && events.length > 0 && (
          <p className="text-center text-body-sm text-text-muted">
            End of timeline · {trades(query.total)}
          </p>
        )}
      </div>
    </Modal>
  );
}
