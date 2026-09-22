import { describe, expect, it } from "vitest";
import { CandleSchema, InstrumentSchema } from "./marketData";

const instrument = {
  symbol: "RELIANCE",
  name: "Reliance Industries",
  exchange: "NSE",
  segment: "equity_delivery",
  timeframes: ["1d", "5m"],
  dataFrom: "2026-06-01",
  dataTo: "2026-09-18",
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
  it("accepts a valid instrument", () => {
    expect(InstrumentSchema.parse(instrument)).toEqual(instrument);
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
