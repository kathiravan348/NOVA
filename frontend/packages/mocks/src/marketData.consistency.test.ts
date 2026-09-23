import { describe, expect, it } from "vitest";
import { mockCandles, mockInstruments } from "./data";

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

  it("every instrument timeframe has a series", () => {
    for (const i of mockInstruments) {
      for (const tf of i.timeframes) expect(mockCandles[`${i.symbol}:${tf}`]).toBeDefined();
    }
  });

  it("daily bars are calendar dates inside the instrument's data range, ascending", () => {
    for (const i of mockInstruments) {
      const bars = mockCandles[`${i.symbol}:1d`]!;
      expect(bars.every((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.time))).toBe(true);
      expect(bars[0]!.time).toBe(i.dataFrom);
      expect(bars[bars.length - 1]!.time).toBe(i.dataTo);
      for (let n = 1; n < bars.length; n += 1) expect(bars[n]!.time > bars[n - 1]!.time).toBe(true);
    }
  });

  it("5m bars are UTC times exactly 5 minutes apart", () => {
    for (const i of mockInstruments) {
      const bars = mockCandles[`${i.symbol}:5m`]!;
      expect(bars.every((b) => b.time.endsWith("Z"))).toBe(true);
      for (let n = 1; n < bars.length; n += 1) {
        expect(Date.parse(bars[n]!.time) - Date.parse(bars[n - 1]!.time)).toBe(5 * 60_000);
      }
    }
  });
});
