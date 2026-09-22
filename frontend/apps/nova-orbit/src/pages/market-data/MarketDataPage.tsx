import { useSearchParams } from "react-router";
import { TimeframeSchema, type Timeframe } from "@nova/contracts";
import { Card, DescriptionList, Select, Skeleton } from "@nova/ui-core";
import { CandlestickChart } from "@nova/ui-trading";
import { useCandles, useInstruments } from "@nova/services";
import { QueryError } from "../../components/QueryState";
import { formatPeriod, segmentLabel, timeframeLabel } from "../../lib/format";

export function MarketDataPage() {
  const [params, setParams] = useSearchParams();
  const instruments = useInstruments();

  const list = instruments.data ?? [];
  const instrument = list.find((i) => i.symbol === params.get("symbol")) ?? list[0];
  const tfParam = TimeframeSchema.safeParse(params.get("tf"));
  const timeframe: Timeframe | "" = instrument
    ? tfParam.success && instrument.timeframes.includes(tfParam.data)
      ? tfParam.data
      : (instrument.timeframes[0] ?? "")
    : "";
  const candles = useCandles(instrument?.symbol ?? "", timeframe);

  const update = (symbol: string, tf: string) => setParams({ symbol, tf }, { replace: true });

  if (instruments.isPending) return <Skeleton className="h-96 w-full" />;
  if (instruments.isError) {
    return <QueryError error={instruments.error} onRetry={() => void instruments.refetch()} />;
  }
  if (!instrument) {
    return <p className="text-body text-text-muted">No instruments available.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <Select
          label="Instrument"
          value={instrument.symbol}
          options={list.map((i) => ({ value: i.symbol, label: `${i.symbol} · ${i.name}` }))}
          onChange={(e) => {
            const next = list.find((i) => i.symbol === e.target.value)!;
            update(
              next.symbol,
              next.timeframes.includes(timeframe as Timeframe) ? timeframe : next.timeframes[0]!,
            );
          }}
        />
        <Select
          label="Timeframe"
          value={timeframe}
          options={instrument.timeframes.map((tf) => ({ value: tf, label: timeframeLabel[tf] }))}
          onChange={(e) => update(instrument.symbol, e.target.value)}
        />
      </div>
      <Card title={`${instrument.symbol} · ${instrument.name}`}>
        <div className="flex flex-col gap-4">
          {candles.isError ? (
            <QueryError error={candles.error} onRetry={() => void candles.refetch()} />
          ) : (
            <CandlestickChart
              candles={candles.data ?? []}
              timeframe={timeframe || "1d"}
              loading={candles.isPending}
              ariaLabel={`${instrument.symbol} ${timeframe} candles`}
            />
          )}
          <DescriptionList
            columns={2}
            items={[
              { label: "Exchange", value: instrument.exchange },
              { label: "Segment", value: segmentLabel[instrument.segment] },
              {
                label: "Data available",
                value: formatPeriod(instrument.dataFrom, instrument.dataTo),
              },
              { label: "Bars shown", value: String(candles.data?.length ?? 0), numeric: true },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
