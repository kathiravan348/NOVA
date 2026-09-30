import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Activity } from "lucide-react";
import type { LiveTick } from "@nova/contracts";
import { EmptyState, Pager, Select, Skeleton } from "@nova/ui-core";
import {
  useLiveSnapshot,
  useLiveTicks,
  useMarketIndices,
  usePageState,
  useRecorder,
  useUniverse,
} from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { LiveStockCard } from "@nova/ui-trading";
import { formatClock, isStale } from "../../lib/live";

const RECORDED = "";

/** Live monitor (D74 (1)): one card per stock of an index, updated as ticks arrive. */
export function MonitorPage() {
  const universe = useUniverse();
  const indices = useMarketIndices();
  const recorder = useRecorder();
  const [source, setSource] = useState(RECORDED);
  const paging = usePageState(source);
  const [ticks, setTicks] = useState<Record<string, LiveTick>>({});
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const stocks = useMemo(() => {
    const all = universe.data ?? [];
    if (source !== RECORDED) return all.filter((s) => s.indices.includes(source));
    const chosen = recorder.data?.symbols ?? [];
    return chosen.length ? all.filter((s) => chosen.includes(s.symbol)) : all;
  }, [universe.data, recorder.data, source]);

  const start = (paging.page - 1) * paging.pageSize;
  const shown = useMemo(
    () => stocks.slice(start, start + paging.pageSize),
    [stocks, start, paging.pageSize],
  );
  const symbols = useMemo(() => shown.map((s) => s.symbol), [shown]);

  const snapshot = useLiveSnapshot(symbols);
  const onTick = useCallback(
    (tick: LiveTick) => setTicks((prev) => ({ ...prev, [tick.symbol]: tick })),
    [],
  );
  useLiveTicks(symbols, onTick);

  const base = useMemo(
    () => new Map((snapshot.data ?? []).map((row) => [row.symbol, row])),
    [snapshot.data],
  );

  const options = [
    { value: RECORDED, label: "Recorded stocks" },
    ...(indices.data ?? []).map((i) => ({ value: i.name, label: i.name })),
  ];

  const body = () => {
    if (universe.isPending) return <Skeleton className="h-40 w-full" />;
    if (universe.isError)
      return <QueryError error={universe.error} onRetry={() => void universe.refetch()} />;
    if (snapshot.isError)
      return <QueryError error={snapshot.error} onRetry={() => void snapshot.refetch()} />;
    if (recorder.data && !recorder.data.enabled && !snapshot.data?.some((r) => r.at !== null))
      return (
        <EmptyState
          icon={<Activity className="h-6 w-6" />}
          title="Recording is off"
          description="Switch on live price recording to see prices here."
          action={<Link to="/live/config">Open Live config</Link>}
        />
      );
    if (stocks.length === 0)
      return <EmptyState title="No stocks to show" description="Choose another list." />;
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((stock) => {
          const row = base.get(stock.symbol);
          const tick = ticks[stock.symbol];
          const fresh = tick && (!row?.at || tick.at >= row.at) ? tick : undefined;
          const at = fresh?.at ?? row?.at ?? null;
          return (
            <LiveStockCard
              key={stock.symbol}
              symbol={stock.symbol}
              name={stock.name}
              price={fresh?.price ?? row?.price ?? null}
              changePercent={fresh ? fresh.changePercent : (row?.changePercent ?? null)}
              lastTick={at ? formatClock(at) : null}
              secondsWithTick={row?.secondsWithTick ?? 0}
              secondsExpected={row?.secondsExpected ?? 0}
              stale={isStale(at, now)}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xs">
        <Select
          label="Stocks"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          options={options}
        />
      </div>
      {body()}
      <Pager
        page={paging.page}
        pageSize={paging.pageSize}
        total={stocks.length}
        onPageChange={paging.setPage}
        onPageSizeChange={paging.setPageSize}
        loading={snapshot.isFetching}
      />
    </div>
  );
}
