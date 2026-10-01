import { useEffect, useMemo, useState } from "react";
import { Database } from "lucide-react";
import { EmptyState, Input, Pager, Skeleton } from "@nova/ui-core";
import { useLiveSnapshot, usePageState, useRecorder, useUniverse } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { formatClock } from "../../lib/live";
import { RecordedStockCard, recordingStatus } from "./RecordedStockCard";

/** Recorded data (D74 (2), D78): a card per recorded stock; a card opens its recorded days. */
export function RecordedDataPage() {
  const universe = useUniverse();
  const recorder = useRecorder();
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const paging = usePageState(query);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const recorded = useMemo(() => {
    const all = universe.data ?? [];
    const chosen = recorder.data?.symbols ?? [];
    const list = chosen.length ? all.filter((s) => chosen.includes(s.symbol)) : all;
    return [...list].sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [universe.data, recorder.data]);

  const stocks = useMemo(
    () =>
      query
        ? recorded.filter((s) => `${s.symbol} ${s.name}`.toLowerCase().includes(query))
        : recorded,
    [recorded, query],
  );

  const start = (paging.page - 1) * paging.pageSize;
  const shown = useMemo(
    () => stocks.slice(start, start + paging.pageSize),
    [stocks, start, paging.pageSize],
  );
  const snapshot = useLiveSnapshot(shown.map((s) => s.symbol));
  const rows = useMemo(
    () => new Map((snapshot.data ?? []).map((row) => [row.symbol, row])),
    [snapshot.data],
  );

  const body = () => {
    if (universe.isPending || recorder.isPending) return <Skeleton className="h-40 w-full" />;
    if (universe.isError)
      return <QueryError error={universe.error} onRetry={() => void universe.refetch()} />;
    if (recorded.length === 0)
      return (
        <EmptyState
          icon={<Database className="h-6 w-6" />}
          title="No stocks yet"
          description="Sync with Kite on the Instruments page to get the stock list."
        />
      );
    if (stocks.length === 0) return <EmptyState title={`No stock matches “${search.trim()}”`} />;
    if (snapshot.isError)
      return <QueryError error={snapshot.error} onRetry={() => void snapshot.refetch()} />;
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((stock) => {
          const row = rows.get(stock.symbol);
          const at = row?.at ?? null;
          return (
            <RecordedStockCard
              key={stock.symbol}
              symbol={stock.symbol}
              name={stock.name}
              price={row?.price ?? null}
              lastTick={at ? formatClock(at) : null}
              secondsWithTick={row?.secondsWithTick ?? 0}
              secondsExpected={row?.secondsExpected ?? 0}
              status={row ? recordingStatus(at, row.secondsWithTick, now) : null}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Input
        containerClassName="w-full sm:w-64"
        label="Search stocks"
        placeholder="Symbol or name"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
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
