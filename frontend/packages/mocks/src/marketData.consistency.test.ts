import { describe, expect, it } from "vitest";
import { mockBacktestRuns, mockCandles, mockInstruments, mockTrades } from "./data";

describe("Market data consistency rules", () => {
  it("every candle series belongs to a known instrument and timeframe", () => {
    const keys = Object.keys(mockCandles);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const [symbol, timeframe] = key.split(":");
      const instrument = mockInstruments.find((i) => i.symbol === symbol);
      expect(instrument, key).toBeDefined();
      expect(instrument!.timeframes).toContain(timeframe);
    }
  });

  it("RELIANCE, TCS, and INFY have candle series for each timeframe", () => {
    for (const symbol of ["RELIANCE", "TCS", "INFY"]) {
      const inst = mockInstruments.find((i) => i.symbol === symbol)!;
      for (const tf of inst.timeframes) {
        expect(mockCandles[`${symbol}:${tf}`]).toBeDefined();
      }
    }
  });

  it("daily bars are calendar dates inside the instrument's data range, ascending", () => {
    for (const [key, bars] of Object.entries(mockCandles)) {
      if (!key.endsWith(":1d")) continue;
      const [symbol] = key.split(":");
      const inst = mockInstruments.find((i) => i.symbol === symbol)!;
      expect(bars.every((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.time))).toBe(true);
      expect(bars[0]!.time).toBe(inst.dataFrom);
      expect(bars[bars.length - 1]!.time).toBe(inst.dataTo);
      for (let n = 1; n < bars.length; n += 1) expect(bars[n]!.time > bars[n - 1]!.time).toBe(true);
    }
  });

  it("5m bars are UTC times exactly 5 minutes apart", () => {
    for (const [key, bars] of Object.entries(mockCandles)) {
      if (!key.endsWith(":5m")) continue;
      expect(bars.every((b) => b.time.endsWith("Z"))).toBe(true);
      for (let n = 1; n < bars.length; n += 1) {
        expect(Date.parse(bars[n]!.time) - Date.parse(bars[n - 1]!.time)).toBe(5 * 60_000);
      }
    }
  });

  it("RELIANCE, TCS, INFY lastClosePaise equals the close of their last 1d candle", () => {
    for (const symbol of ["RELIANCE", "TCS", "INFY"]) {
      const inst = mockInstruments.find((i) => i.symbol === symbol)!;
      const bars = mockCandles[`${symbol}:1d`]!;
      const lastBar = bars[bars.length - 1]!;
      expect(inst.lastClosePaise).toBe(lastBar.closePaise);
    }
  });

  it("changePercent and 52w range agree with the 1d candles", () => {
    for (const symbol of ["RELIANCE", "TCS", "INFY"]) {
      const inst = mockInstruments.find((i) => i.symbol === symbol)!;
      const bars = mockCandles[`${symbol}:1d`]!;
      const last = bars[bars.length - 1]!.closePaise;
      const prev = bars[bars.length - 2]!.closePaise;
      expect(inst.changePercent).toBeCloseTo(((last - prev) / prev) * 100, 2);
      expect(inst.low52wPaise).toBeLessThanOrEqual(Math.min(...bars.map((b) => b.lowPaise)));
      expect(inst.high52wPaise).toBeGreaterThanOrEqual(Math.max(...bars.map((b) => b.highPaise)));
    }
  });

  it("every symbol in a backtest run universe or trade exists in instruments.json", () => {
    const symbols = new Set(mockInstruments.map((i) => i.symbol));
    for (const run of mockBacktestRuns) {
      if (run.universe.type === "symbols") {
        for (const s of run.universe.symbols) {
          expect(symbols.has(s), `Run ${run.id} symbol ${s}`).toBe(true);
        }
      }
    }
    for (const t of mockTrades) expect(symbols.has(t.symbol), `Trade ${t.id}`).toBe(true);
  });

  it("every trade symbol belongs to its run's universe", () => {
    for (const t of mockTrades) {
      const run = mockBacktestRuns.find((r) => r.id === t.runId)!;
      const inUniverse =
        run.universe.type === "symbols"
          ? run.universe.symbols.includes(t.symbol)
          : mockInstruments
              .find((i) => i.symbol === t.symbol)!
              .indices.includes(run.universe.index);
      expect(inUniverse, `Trade ${t.id} ${t.symbol} in ${run.id}`).toBe(true);
    }
  });

  it("symbols in instruments.json are unique", () => {
    const symbols = mockInstruments.map((i) => i.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(symbols.length).toBe(24);
  });
});
