import { useMemo, useState } from "react";
import { Database } from "lucide-react";
import { EmptyState, Input, Pager, Skeleton } from "@nova/ui-core";
import { useLiveStocks, usePageState, useRecorder, useUniverse } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { KiteCheckCard } from "./KiteCheckCard";
import { RecordedStockCard } from "./RecordedStockCard";

/** Recorded data (D74 (2), D78, D80): a card per recorded stock with its stored history. */
export function RecordedDataPage() {
  const universe = useUniverse();
  const recorder = useRecorder();
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const paging = usePageState(query);

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
  const history = useLiveStocks(shown.map((s) => s.symbol));
  const rows = useMemo(
    () => new Map((history.data ?? []).map((row) => [row.symbol, row])),
    [history.data],
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
    if (history.isError)
      return <QueryError error={history.error} onRetry={() => void history.refetch()} />;
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((stock) => (
          <RecordedStockCard
            key={stock.symbol}
            symbol={stock.symbol}
            name={stock.name}
            history={rows.get(stock.symbol)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <KiteCheckCard />
      <div className="flex flex-col gap-1">
        <Input
          containerClassName="w-full sm:w-64"
          label="Search stocks"
          placeholder="Symbol or name"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <p className="text-body-sm text-text-muted">Updated after each market close.</p>
      </div>
      {body()}
      <Pager
        page={paging.page}
        pageSize={paging.pageSize}
        total={stocks.length}
        onPageChange={paging.setPage}
        onPageSizeChange={paging.setPageSize}
        loading={history.isFetching}
      />
    </div>
  );
}
