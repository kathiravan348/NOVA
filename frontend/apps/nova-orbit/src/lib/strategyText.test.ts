import { describe, expect, it } from "vitest";
import {
  describeCondition,
  describeOperand,
  describeRisk,
  describeRuleGroup,
  describeSizing,
  describeUniverse,
  summarizeUniverse,
} from "./strategyText";
import { formatCalendarDate, formatIstDate, formatIstDateTime } from "./format";

describe("strategyText", () => {
  it("describes each operand kind", () => {
    expect(describeOperand({ kind: "price", field: "close" })).toBe("Close");
    expect(describeOperand({ kind: "number", value: 30 })).toBe("30");
    expect(describeOperand({ kind: "indicator", name: "vwap", params: {} })).toBe("VWAP");
    expect(describeOperand({ kind: "indicator", name: "rsi", params: { period: 14 } })).toBe(
      "RSI(14)",
    );
  });

  it("describes conditions with every op", () => {
    const close = { kind: "price", field: "close" } as const;
    const n = { kind: "number", value: 5 } as const;
    expect(describeCondition({ left: close, op: "crosses_above", right: n })).toBe(
      "Close crosses above 5",
    );
    expect(describeCondition({ left: close, op: "crosses_below", right: n })).toBe(
      "Close crosses below 5",
    );
    expect(
      ["gt", "gte", "lt", "lte", "eq"].map((op) =>
        describeCondition({ left: close, op: op as "gt", right: n }),
      ),
    ).toEqual(["Close > 5", "Close ≥ 5", "Close < 5", "Close ≤ 5", "Close = 5"]);
  });

  it("describes rule groups", () => {
    const group = describeRuleGroup({
      combinator: "any",
      conditions: [
        {
          left: { kind: "indicator", name: "rsi", params: { period: 14 } },
          op: "lt",
          right: { kind: "number", value: 30 },
        },
      ],
    });
    expect(group).toEqual({ heading: "Any of", lines: ["RSI(14) < 30"] });
  });

  it("describes universe, sizing and risk", () => {
    expect(describeUniverse({ type: "symbols", symbols: ["TCS", "INFY"] })).toBe("TCS, INFY");
    expect(describeUniverse({ type: "index", index: "NIFTY 50" })).toBe("NIFTY 50 stocks");
    expect(summarizeUniverse({ type: "index", index: "NIFTY BANK" })).toBe("NIFTY BANK");
    expect(summarizeUniverse({ type: "symbols", symbols: ["TCS", "INFY"] })).toBe("TCS, INFY");
    expect(summarizeUniverse({ type: "symbols", symbols: ["A", "B", "C", "D"] })).toBe("4 symbols");
    expect(describeSizing({ type: "fixed_qty", qty: 50 })).toBe("50 shares per trade");
    expect(describeSizing({ type: "fixed_amount", amountPaise: 1_00_000_00 })).toBe(
      "₹1,00,000 per trade",
    );
    expect(describeSizing({ type: "percent_equity", percent: 10 })).toBe("10% of equity per trade");
    expect(describeRisk({ stopLossPercent: 1.5, targetPercent: 3 })).toBe(
      "Stop-loss 1.5% · Target 3%",
    );
    expect(describeRisk({ stopLossPercent: null, targetPercent: null })).toBe("None");
  });

  it("formats dates in IST", () => {
    expect(formatIstDate("2026-09-21T20:00:00Z")).toBe("22 Sep 2026");
    expect(formatIstDateTime("2026-09-21T06:30:00Z")).toBe("21 Sep 2026, 12:00 IST");
    expect(formatCalendarDate("2026-09-21")).toBe("21 Sep 2026");
  });
});
