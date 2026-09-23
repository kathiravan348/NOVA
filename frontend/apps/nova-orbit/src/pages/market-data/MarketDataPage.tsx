import { useCallback } from "react";
import { Link, useSearchParams } from "react-router";
import { TimeframeSchema, type Instrument, type Timeframe } from "@nova/contracts";
import { Card, DescriptionList, Select } from "@nova/ui-core";
import { CandlestickChart, formatPercent, formatPrice, formatQuantity } from "@nova/ui-trading";
import { useCandles, useInstruments } from "@nova/services";
import { InstrumentTable } from "../../components/InstrumentTable";
import { QueryError } from "../../components/QueryState";
import { formatPeriod, segmentLabel, timeframeLabel } from "../../lib/format";

const pickTimeframe = (instrument: Instrument, wanted: string | null): Timeframe => {
  const parsed = TimeframeSchema.safeParse(wanted);
  return parsed.success && instrument.timeframes.includes(parsed.data)
    ? parsed.data
    : instrument.timeframes[0]!;
};

function InstrumentChart({
  instrument,
  timeframe,
}: {
  instrument: Instrument;
  timeframe: Timeframe;
}) {
  const [, setParams] = useSearchParams();
  const candles = useCandles(instrument.symbol, timeframe);
  const i = instrument;
  return (
    <Card
      title={`${i.symbol} · ${i.name}`}
      actions={
        <Select
          label="Timeframe"
          value={timeframe}
          options={i.timeframes.map((tf) => ({ value: tf, label: timeframeLabel[tf] }))}
          onChange={(e) => setParams({ symbol: i.symbol, tf: e.target.value }, { replace: true })}
          containerClassName="w-36"
        />
      }
    >
      <div className="flex flex-col gap-4">
        {candles.isError ? (
          <QueryError error={candles.error} onRetry={() => void candles.refetch()} />
        ) : (
          <CandlestickChart
            candles={candles.data ?? []}
            timeframe={timeframe}
            loading={candles.isPending}
            ariaLabel={`${i.symbol} ${timeframe} candles`}
          />
        )}
        <DescriptionList
          columns={2}
          items={[
            { label: "Exchange", value: `${i.exchange} · ${segmentLabel[i.segment]}` },
            { label: "Sector", value: i.sector },
            { label: "Index", value: i.indices.join(", ") || "—" },
            { label: "Last close", value: formatPrice(i.lastClosePaise), numeric: true },
            {
              label: "Day change",
              value: formatPercent(i.changePercent, { signed: true }),
              numeric: true,
            },
            {
              label: "52-week range",
              value: `${formatPrice(i.low52wPaise)} – ${formatPrice(i.high52wPaise)}`,
              numeric: true,
            },
            { label: "Avg daily volume", value: formatQuantity(i.avgDailyVolume), numeric: true },
            {
              label: "F&O lot size",
              value: i.lotSize === null ? "Not in F&O" : formatQuantity(i.lotSize),
              numeric: i.lotSize !== null,
            },
            { label: "Data available", value: formatPeriod(i.dataFrom, i.dataTo) },
            { label: "Bars shown", value: String(candles.data?.length ?? 0), numeric: true },
          ]}
        />
      </div>
    </Card>
  );
}

export function MarketDataPage() {
  const [params] = useSearchParams();
  const instruments = useInstruments();
  const list = instruments.data ?? [];
  const instrument = list.find((i) => i.symbol === params.get("symbol")) ?? list[0];
  const timeframe = instrument ? pickTimeframe(instrument, params.get("tf")) : undefined;
  const tfParam = params.get("tf");
  const current = instrument?.symbol;

  // Stable per selection so the table's columns are not rebuilt on every render.
  const renderSymbol = useCallback(
    (i: Instrument) => (
      <Link
        to={`?symbol=${encodeURIComponent(i.symbol)}&tf=${pickTimeframe(i, tfParam)}`}
        replace
        aria-current={i.symbol === current ? "true" : undefined}
        className="text-action-text hover:underline"
      >
        {i.symbol}
      </Link>
    ),
    [tfParam, current],
  );

  return (
    <div className="flex flex-col gap-6">
      {instrument && timeframe && <InstrumentChart instrument={instrument} timeframe={timeframe} />}
      <InstrumentTable
        caption="Instruments"
        instruments={list}
        loading={instruments.isPending}
        error={
          instruments.isError ? (
            <QueryError error={instruments.error} onRetry={() => void instruments.refetch()} />
          ) : undefined
        }
        renderSymbol={renderSymbol}
      />
    </div>
  );
}
