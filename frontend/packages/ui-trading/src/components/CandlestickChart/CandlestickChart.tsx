import * as React from "react";
import { formatInTimeZone } from "date-fns-tz";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  TickMarkType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Timeframe } from "@nova/contracts";
import { Skeleton, cn } from "@nova/ui-core";
import { formatPrice } from "../../format/money";
import { useThemeColors } from "../../lib/useThemeColors";
import type { Candle } from "./types";

export interface CandlestickChartProps {
  candles: Candle[];
  timeframe: Timeframe;
  /** Default: true when any candle has volume. */
  showVolume?: boolean;
  /** Fixed height in px. Default: 240 below `md`, 320 from `md`. */
  height?: number;
  loading?: boolean;
  emptyText?: string;
  ariaLabel: string;
  className?: string;
}

const IST = "Asia/Kolkata";
const COLOR_VARS = ["profit", "loss", "text-muted", "border-default", "bg-surface", "font-mono"];

/** Chart time for a candle: the `YYYY-MM-DD` string for `1d`, UTC seconds for intraday. */
export function toChartTime(time: string, timeframe: Timeframe): Time {
  if (timeframe === "1d") return time;
  return Math.floor(Date.parse(time) / 1000) as UTCTimestamp;
}

function toDate(time: Time): Date {
  if (typeof time === "number") return new Date(time * 1000);
  if (typeof time === "string") return new Date(`${time}T00:00:00Z`);
  return new Date(Date.UTC(time.year, time.month - 1, time.day));
}

/** Daily dates are calendar days (no zone); intraday times are shown in IST. */
function formatTime(time: Time, pattern: string, intraday: boolean): string {
  const date = toDate(time);
  return intraday ? formatInTimeZone(date, IST, pattern) : formatInTimeZone(date, "UTC", pattern);
}

function tickFormatter(intraday: boolean) {
  return (time: Time, type: TickMarkType): string => {
    switch (type) {
      case TickMarkType.Year:
        return formatTime(time, "yyyy", intraday);
      case TickMarkType.Month:
        return formatTime(time, "MMM", intraday);
      case TickMarkType.DayOfMonth:
        return formatTime(time, "d MMM", intraday);
      default:
        return formatTime(time, "HH:mm", intraday);
    }
  };
}

function summaryTime(candle: Candle, intraday: boolean): string {
  if (!intraday) return formatInTimeZone(`${candle.time}T00:00:00Z`, "UTC", "d MMM yyyy");
  return `${formatInTimeZone(candle.time, IST, "d MMM yyyy HH:mm")} IST`;
}

export function CandlestickChart({
  candles,
  timeframe,
  showVolume,
  height,
  loading = false,
  emptyText = "No candles",
  ariaLabel,
  className,
}: CandlestickChartProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const candleRef = React.useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = React.useRef<ISeriesApi<"Histogram"> | null>(null);
  const colors = useThemeColors(COLOR_VARS);

  const intraday = timeframe !== "1d";
  const hasChart = !loading && candles.length > 0;
  const withVolume = showVolume ?? candles.some((c) => c.volume !== undefined);
  const sizeClass = height === undefined ? "h-[240px] md:h-[320px]" : undefined;
  const sizeStyle = height === undefined ? undefined : { height };

  // Create the chart once per mount (and when it becomes visible).
  React.useEffect(() => {
    const el = containerRef.current;
    if (!hasChart || !el) return;
    const chart = createChart(el, {
      autoSize: true,
      localization: {
        priceFormatter: (rupees: number) => formatPrice(Math.round(rupees * 100)),
        timeFormatter: (time: Time) =>
          formatTime(time, intraday ? "d MMM yyyy HH:mm" : "d MMM yyyy", intraday),
      },
      timeScale: { timeVisible: intraday, tickMarkFormatter: tickFormatter(intraday) },
    });
    chartRef.current = chart;
    candleRef.current = chart.addSeries(CandlestickSeries, {});
    // Volume sits in the bottom 20%; candles keep clear of it.
    candleRef.current
      .priceScale()
      .applyOptions({ scaleMargins: { top: 0.1, bottom: withVolume ? 0.25 : 0.1 } });
    volumeRef.current = withVolume
      ? chart.addSeries(HistogramSeries, {
          priceScaleId: "",
          lastValueVisible: false,
          priceLineVisible: false,
        })
      : null;
    volumeRef.current?.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, [hasChart, intraday, withVolume]);

  // Theme colours.
  React.useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const up = colors["profit"];
    const down = colors["loss"];
    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: colors["bg-surface"] },
        textColor: colors["text-muted"],
        fontFamily: colors["font-mono"],
      },
      grid: {
        vertLines: { color: colors["border-default"] },
        horzLines: { color: colors["border-default"] },
      },
      rightPriceScale: { borderColor: colors["border-default"] },
      timeScale: { borderColor: colors["border-default"] },
    });
    candleRef.current?.applyOptions({
      upColor: up,
      downColor: down,
      wickUpColor: up,
      wickDownColor: down,
      borderVisible: false,
    });
  }, [colors, hasChart, intraday, withVolume]);

  // Data (volume colour follows candle direction, so it also depends on colours).
  React.useEffect(() => {
    if (!candleRef.current) return;
    candleRef.current.setData(
      candles.map((c) => ({
        time: toChartTime(c.time, timeframe),
        open: c.openPaise / 100,
        high: c.highPaise / 100,
        low: c.lowPaise / 100,
        close: c.closePaise / 100,
      })),
    );
    volumeRef.current?.setData(
      candles.map((c) => ({
        time: toChartTime(c.time, timeframe),
        value: c.volume ?? 0,
        color: c.closePaise >= c.openPaise ? colors["profit"] : colors["loss"],
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles, timeframe, colors, hasChart, intraday, withVolume]);

  if (loading) {
    return <Skeleton className={cn("w-full", sizeClass, className)} style={sizeStyle} />;
  }

  if (candles.length === 0) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center text-body-sm text-text-muted",
          sizeClass,
          className,
        )}
        style={sizeStyle}
      >
        {emptyText}
      </div>
    );
  }

  const first = candles[0]!;
  const last = candles[candles.length - 1]!;

  return (
    <div role="img" aria-label={ariaLabel} className={cn("relative w-full min-w-0", className)}>
      <p className="sr-only">
        {candles.length} candles, {summaryTime(first, intraday)} to {summaryTime(last, intraday)},
        last close {formatPrice(last.closePaise)}
      </p>
      <div ref={containerRef} className={cn("w-full", sizeClass)} style={sizeStyle} />
    </div>
  );
}
