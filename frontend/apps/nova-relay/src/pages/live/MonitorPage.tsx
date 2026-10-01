import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Activity } from "lucide-react";
import type { LiveTick } from "@nova/contracts";
import { Button, EmptyState, Input, Pager, Select, Skeleton, useToast } from "@nova/ui-core";
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
import { loadMyList, saveMyList } from "../../lib/myList";
import { MyListModal } from "./MyListModal";

const RECORDED = "";
const MY_LIST = "mylist";

/** Live monitor (D74 (1), D78): one card per stock of a list, updated as ticks arrive. */
export function MonitorPage() {
  const toast = useToast();
  const universe = useUniverse();
  const indices = useMarketIndices();
  const recorder = useRecorder();
  const [source, setSource] = useState(RECORDED);
  const [search, setSearch] = useState("");
  const [myList, setMyList] = useState(loadMyList);
  const [picking, setPicking] = useState(false);
  const query = search.trim().toLowerCase();
  const paging = usePageState(`${source}|${query}`);
  const [ticks, setTicks] = useState<Record<string, LiveTick>>({});
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const listed = useMemo(() => {
    const all = universe.data ?? [];
    if (source === MY_LIST) return all.filter((s) => myList.includes(s.symbol));
    if (source !== RECORDED) return all.filter((s) => s.indices.includes(source));
    const chosen = recorder.data?.symbols ?? [];
    return chosen.length ? all.filter((s) => chosen.includes(s.symbol)) : all;
  }, [universe.data, recorder.data, source, myList]);

  const stocks = useMemo(
    () =>
      query ? listed.filter((s) => `${s.symbol} ${s.name}`.toLowerCase().includes(query)) : listed,
    [listed, query],
  );

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
    { value: MY_LIST, label: `My list (${myList.length})` },
    ...(indices.data ?? []).map((i) => ({ value: i.name, label: i.name })),
  ];

  const saveList = (next: string[]) => {
    const clean = [...new Set(next)].sort();
    saveMyList(clean);
    setMyList(clean); // also works for this visit when the browser blocks storage
    setPicking(false);
    setSource(MY_LIST);
    toast.show({ title: `My list saved (${clean.length} stocks)`, tone: "success" });
  };

  const body = () => {
    if (universe.isPending) return <Skeleton className="h-40 w-full" />;
    if (universe.isError)
      return <QueryError error={universe.error} onRetry={() => void universe.refetch()} />;
    if (source === MY_LIST && listed.length === 0)
      return (
        <EmptyState
          title="Your list is empty"
          description="Use Pick stocks to choose stocks to watch."
        />
      );
    if (stocks.length === 0 && query)
      return <EmptyState title={`No stock matches “${search.trim()}”`} />;
    if (stocks.length === 0)
      return <EmptyState title="No stocks to show" description="Choose another list." />;
    if (snapshot.isError)
      return <QueryError error={snapshot.error} onRetry={() => void snapshot.refetch()} />;
    // Only once prices have loaded: while they load, the cards show "—" instead.
    if (recorder.data && !recorder.data.enabled && snapshot.data?.every((r) => r.at === null))
      return (
        <EmptyState
          icon={<Activity className="h-6 w-6" />}
          title="Recording is off"
          description="Switch on live price recording to see prices here."
          action={<Link to="/live/config">Open Live config</Link>}
        />
      );
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-56">
          <Select
            label="Stocks"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            options={options}
          />
        </div>
        <Input
          containerClassName="w-full sm:w-64"
          label="Search stocks"
          placeholder="Symbol or name"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="button" variant="secondary" onClick={() => setPicking(true)}>
          Pick stocks
        </Button>
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
      <MyListModal
        open={picking}
        symbols={myList}
        onClose={() => setPicking(false)}
        onSave={saveList}
      />
    </div>
  );
}
