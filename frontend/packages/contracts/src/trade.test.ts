import { describe, expect, it } from "vitest";
import { Trade, TradeSchema } from "./trade";

describe("TradeSchema", () => {
  const validClosedTrade: Trade = {
    id: "trd-001",
    runId: "run-101",
    symbol: "RELIANCE",
    exchange: "NSE",
    segment: "equity_delivery",
    side: "buy",
    qty: 25,
    entryAt: "2026-09-01T09:30:00Z",
    entryPricePaise: 290000,
    exitAt: "2026-09-02T15:15:00Z",
    exitPricePaise: 295000,
    grossPnlPaise: 125000,
    charges: {
      brokeragePaise: 2000,
      sttPaise: 1250,
      exchangeTxnPaise: 350,
      sebiFeePaise: 10,
      stampDutyPaise: 300,
      gstPaise: 425,
      dpPaise: 1550,
      totalPaise: 5885,
    },
    netPnlPaise: 119115, // 125000 - 5885
  };

  it("accepts a valid closed trade", () => {
    expect(TradeSchema.safeParse(validClosedTrade).success).toBe(true);
  });

  it("accepts a valid open trade with null exit details", () => {
    const validOpenTrade: Trade = {
      ...validClosedTrade,
      exitAt: null,
      exitPricePaise: null,
      grossPnlPaise: 0,
      charges: {
        brokeragePaise: 2000,
        sttPaise: 0,
        exchangeTxnPaise: 0,
        sebiFeePaise: 0,
        stampDutyPaise: 0,
        gstPaise: 360,
        dpPaise: 0,
        totalPaise: 2360,
      },
      netPnlPaise: -2360,
    };
    expect(TradeSchema.safeParse(validOpenTrade).success).toBe(true);
  });

  it("rejects when netPnlPaise does not match grossPnlPaise - charges.totalPaise", () => {
    const invalid = { ...validClosedTrade, netPnlPaise: 120000 };
    expect(TradeSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects when exitAt is provided but exitPricePaise is null", () => {
    const invalid = { ...validClosedTrade, exitPricePaise: null };
    expect(TradeSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects when exitAt is null but exitPricePaise is provided", () => {
    const invalid = { ...validClosedTrade, exitAt: null };
    expect(TradeSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects an invalid enum value for side", () => {
    const invalid = { ...validClosedTrade, side: "hold" };
    expect(TradeSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects zero or negative qty", () => {
    const invalid = { ...validClosedTrade, qty: 0 };
    expect(TradeSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects zero or negative prices", () => {
    expect(TradeSchema.safeParse({ ...validClosedTrade, entryPricePaise: 0 }).success).toBe(false);
    expect(TradeSchema.safeParse({ ...validClosedTrade, exitPricePaise: -1 }).success).toBe(false);
  });
});
