import { describe, expect, it } from "vitest";
import { CandleSchema, InstrumentSchema } from "./marketData";

const instrument = {
  symbol: "RELIANCE",
  name: "Reliance Industries",
  exchange: "NSE",
  segment: "equity_delivery",
  sector: "Energy",
  indices: ["NIFTY 50"],
  lastClosePaise: 250_000,
  high52wPaise: 300_000,
  low52wPaise: 220_000,
  changePercent: 1.25,
  avgDailyVolume: 1_250_000,
  lotSize: 250,
  timeframes: ["1d", "5m"],
  dataFrom: "2026-06-01",
  dataTo: "2026-09-18",
  coverage: [
    { timeframe: "1d", from: "2026-06-01", to: "2026-09-18" },
    { timeframe: "5m", from: "2026-09-14", to: "2026-09-18" },
  ],
};

const candle = {
  time: "2026-09-18",
  openPaise: 245_000,
  highPaise: 247_500,
  lowPaise: 244_000,
  closePaise: 246_800,
  volume: 182_400,
};

describe("InstrumentSchema", () => {
  it("accepts a valid instrument and accepts null lotSize and empty indices", () => {
    expect(InstrumentSchema.parse(instrument)).toEqual(instrument);
    expect(InstrumentSchema.parse({ ...instrument, lotSize: null }).lotSize).toBeNull();
    expect(InstrumentSchema.parse({ ...instrument, indices: [] }).indices).toEqual([]);
  });

  it("needs coverage matching the timeframes", () => {
    expect(InstrumentSchema.safeParse({ ...instrument, coverage: [] }).success).toBe(false);
    expect(
      InstrumentSchema.safeParse({ ...instrument, coverage: instrument.coverage.slice(0, 1) })
        .success,
    ).toBe(false);
    const backwards = [
      { timeframe: "1d", from: "2026-09-18", to: "2026-06-01" },
      instrument.coverage[1],
    ];
    expect(InstrumentSchema.safeParse({ ...instrument, coverage: backwards }).success).toBe(false);
  });

  it("rejects duplicate indices", () => {
    expect(
      InstrumentSchema.safeParse({
        ...instrument,
        indices: ["NIFTY 50", "NIFTY 50"],
      }).success,
    ).toBe(false);
  });

  it("rejects lastClose outside 52w range", () => {
    expect(
      InstrumentSchema.safeParse({
        ...instrument,
        lastClosePaise: 210_000, // below low52wPaise 220_000
      }).success,
    ).toBe(false);
    expect(
      InstrumentSchema.safeParse({
        ...instrument,
        lastClosePaise: 310_000, // above high52wPaise 300_000
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate timeframes, reversed dates and extra keys", () => {
    expect(InstrumentSchema.safeParse({ ...instrument, timeframes: ["1d", "1d"] }).success).toBe(
      false,
    );
    expect(InstrumentSchema.safeParse({ ...instrument, dataFrom: "2026-10-01" }).success).toBe(
      false,
    );
    expect(InstrumentSchema.safeParse({ ...instrument, timeframes: [] }).success).toBe(false);
    expect(InstrumentSchema.safeParse({ ...instrument, extra: 1 }).success).toBe(false);
  });
});

describe("CandleSchema", () => {
  it("accepts daily and intraday times", () => {
    expect(CandleSchema.parse(candle)).toEqual(candle);
    expect(CandleSchema.safeParse({ ...candle, time: "2026-09-18T03:45:00Z" }).success).toBe(true);
  });

  it("rejects bad times and impossible bars", () => {
    expect(CandleSchema.safeParse({ ...candle, time: "18/09/2026" }).success).toBe(false);
    expect(CandleSchema.safeParse({ ...candle, highPaise: 246_000 }).success).toBe(false);
    expect(CandleSchema.safeParse({ ...candle, lowPaise: 246_000 }).success).toBe(false);
    expect(CandleSchema.safeParse({ ...candle, volume: -1 }).success).toBe(false);
    expect(CandleSchema.safeParse({ ...candle, openPaise: 245_000.5 }).success).toBe(false);
  });
});
