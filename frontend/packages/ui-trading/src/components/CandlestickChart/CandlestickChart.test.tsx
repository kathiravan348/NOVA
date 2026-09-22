import * as React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CandlestickChart } from "./CandlestickChart";
import { dailyCandles, dailyCandlesNoVolume, intradayCandles } from "./storyData";

interface FakeSeries {
  kind: string;
  options: Record<string, unknown>;
  data: Record<string, unknown>[];
  applyOptions: (o: Record<string, unknown>) => void;
  setData: (d: Record<string, unknown>[]) => void;
  priceScale: () => { applyOptions: (o: Record<string, unknown>) => void };
}

const charts: {
  options: Record<string, unknown>[];
  series: FakeSeries[];
  remove: ReturnType<typeof vi.fn>;
}[] = [];

vi.mock("lightweight-charts", () => ({
  CandlestickSeries: "Candlestick",
  HistogramSeries: "Histogram",
  ColorType: { Solid: "solid" },
  TickMarkType: { Year: 0, Month: 1, DayOfMonth: 2, Time: 3, TimeWithSeconds: 4 },
  createChart: vi.fn((_el: HTMLElement, options: Record<string, unknown>) => {
    const chart = { options: [options], series: [] as FakeSeries[], remove: vi.fn() };
    charts.push(chart);
    return {
      addSeries: (kind: string, options: Record<string, unknown>) => {
        const s: FakeSeries = {
          kind,
          options: { ...options },
          data: [],
          applyOptions: (o) => Object.assign(s.options, o),
          setData: (d) => {
            s.data = d;
          },
          priceScale: () => ({ applyOptions: () => undefined }),
        };
        chart.series.push(s);
        return s;
      },
      applyOptions: (o: Record<string, unknown>) => chart.options.push(o),
      timeScale: () => ({ fitContent: () => undefined }),
      remove: chart.remove,
    };
  }),
}));

const root = document.documentElement;

function setTheme(theme: "dark" | "light", profit: string, loss: string) {
  root.style.setProperty("--profit", profit);
  root.style.setProperty("--loss", loss);
  root.dataset["theme"] = theme;
}

beforeEach(() => {
  charts.length = 0;
  setTheme("dark", "#11aa11", "#aa1111");
});

afterEach(() => {
  root.removeAttribute("style");
  delete root.dataset["theme"];
});

const candleSeries = () => charts[0]!.series.find((s) => s.kind === "Candlestick")!;
const volumeSeries = () => charts[0]!.series.find((s) => s.kind === "Histogram");

describe("CandlestickChart", () => {
  it("story data has sane OHLC values", () => {
    expect(dailyCandles).toHaveLength(60);
    expect(intradayCandles).toHaveLength(75);
    for (const c of [...dailyCandles, ...intradayCandles]) {
      expect(c.highPaise).toBeGreaterThanOrEqual(Math.max(c.openPaise, c.closePaise));
      expect(c.lowPaise).toBeLessThanOrEqual(Math.min(c.openPaise, c.closePaise));
    }
    expect(intradayCandles[0]!.time).toBe("2026-09-21T03:45:00Z");
  });

  it("maps daily candles to rupees with date-string times", () => {
    render(<CandlestickChart candles={dailyCandles} timeframe="1d" ariaLabel="Daily" />);
    const first = dailyCandles[0]!;
    expect(candleSeries().data[0]).toEqual({
      time: first.time,
      open: first.openPaise / 100,
      high: first.highPaise / 100,
      low: first.lowPaise / 100,
      close: first.closePaise / 100,
    });
    expect(volumeSeries()!.data).toHaveLength(60);
  });

  it("maps intraday times to UTC seconds", () => {
    render(<CandlestickChart candles={intradayCandles} timeframe="5m" ariaLabel="5m" />);
    expect(candleSeries().data[0]!["time"]).toBe(Date.parse("2026-09-21T03:45:00Z") / 1000);
  });

  it("formats prices and intraday times in IST", () => {
    render(<CandlestickChart candles={intradayCandles} timeframe="5m" ariaLabel="5m" />);
    const localization = charts[0]!.options[0]!["localization"] as {
      priceFormatter: (p: number) => string;
      timeFormatter: (t: number) => string;
    };
    expect(localization.priceFormatter(2512.5)).toBe("2,512.50");
    expect(localization.timeFormatter(Date.parse("2026-09-21T03:45:00Z") / 1000)).toBe(
      "21 Sep 2026 09:15",
    );
  });

  it("omits the volume series when no candle has volume", () => {
    render(<CandlestickChart candles={dailyCandlesNoVolume} timeframe="1d" ariaLabel="Daily" />);
    expect(volumeSeries()).toBeUndefined();
  });

  it("applies theme colours and re-applies them after a theme switch", async () => {
    render(<CandlestickChart candles={dailyCandles} timeframe="1d" ariaLabel="Daily" />);
    expect(candleSeries().options["upColor"]).toBe("#11aa11");
    expect(candleSeries().options["downColor"]).toBe("#aa1111");
    act(() => setTheme("light", "#007700", "#770000"));
    await waitFor(() => expect(candleSeries().options["upColor"]).toBe("#007700"));
    expect(candleSeries().options["wickDownColor"]).toBe("#770000");
  });

  it("removes the chart on unmount", () => {
    const { unmount } = render(
      <CandlestickChart candles={dailyCandles} timeframe="1d" ariaLabel="Daily" />,
    );
    unmount();
    expect(charts[0]!.remove).toHaveBeenCalledTimes(1);
  });

  it("does not create a chart while loading or empty", () => {
    const { rerender } = render(
      <CandlestickChart candles={dailyCandles} timeframe="1d" loading ariaLabel="Daily" />,
    );
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    rerender(<CandlestickChart candles={[]} timeframe="1d" ariaLabel="Daily" />);
    expect(screen.getByText("No candles")).toBeInTheDocument();
    expect(charts).toHaveLength(0);
  });

  it("renders an img with a summary", () => {
    render(<CandlestickChart candles={intradayCandles} timeframe="5m" ariaLabel="Intraday" />);
    expect(screen.getByRole("img", { name: "Intraday" })).toBeInTheDocument();
    expect(
      screen.getByText(/75 candles, 21 Sep 2026 09:15 IST to 21 Sep 2026 15:25 IST, last close/),
    ).toBeInTheDocument();
  });
});
