import { describe, expect, it } from "vitest";
import type { Instrument } from "@nova/contracts";
import { mockInstruments } from "@nova/mocks";
import { isInav, topByTradedValue, unrankedStocks } from "./topByTradedValue";

const base = mockInstruments[0]!;
const stock = (symbol: string, avgDailyVolume: number, lastClosePaise: number): Instrument => ({
  ...base,
  symbol,
  avgDailyVolume,
  lastClosePaise,
  low52wPaise: 1,
  high52wPaise: lastClosePaise,
});

describe("topByTradedValue", () => {
  const instruments = [
    stock("LOW", 10, 100), // 1,000
    stock("HIGH", 100, 100), // 10,000
    stock("TIEB", 50, 100), // 5,000
    stock("TIEA", 25, 200), // 5,000
    stock("UNSYNCED", 1000, 1000),
  ];
  const synced = ["LOW", "HIGH", "TIEB", "TIEA", "NOHIST2", "NOHIST1"];

  it("ranks by volume × close, ties by symbol, unranked stocks last by symbol", () => {
    expect(topByTradedValue(synced, instruments, 10)).toEqual([
      "HIGH",
      "TIEA",
      "TIEB",
      "LOW",
      "NOHIST1",
      "NOHIST2",
    ]);
  });

  it("ignores stocks that are not synced", () => {
    expect(topByTradedValue(synced, instruments, 10)).not.toContain("UNSYNCED");
  });

  it("returns exactly the limit when more stocks exist", () => {
    expect(topByTradedValue(synced, instruments, 3)).toEqual(["HIGH", "TIEA", "TIEB"]);
    expect(topByTradedValue(synced, instruments, 5)).toEqual([
      "HIGH",
      "TIEA",
      "TIEB",
      "LOW",
      "NOHIST1",
    ]);
  });

  it("returns nothing when nothing is synced", () => {
    expect(topByTradedValue([], instruments, 3)).toEqual([]);
  });

  it("skips iNAV symbols, even the highest valued, and keeps them out of the unranked tail", () => {
    const withInav = [...instruments, stock("ABCINAV", 10_000, 10_000)];
    const picked = topByTradedValue([...synced, "ABCINAV", "XYZINAV"], withInav, 10);
    expect(picked).not.toContain("ABCINAV");
    expect(picked).not.toContain("XYZINAV");
    expect(picked[0]).toBe("HIGH");
  });
});

describe("isInav", () => {
  it("matches symbols ending in INAV only", () => {
    expect(isInav("NIFTYBEESINAV")).toBe(true);
    expect(isInav("INAVX")).toBe(false);
    expect(isInav("INFY")).toBe(false);
  });
});

describe("unrankedStocks", () => {
  it("returns synced non-iNAV stocks with no instrument row, sorted", () => {
    const instruments = [stock("INFY", 1, 1)];
    expect(unrankedStocks(["ZED", "INFY", "ABCINAV", "ALPHA", "ZED"], instruments)).toEqual([
      "ALPHA",
      "ZED",
    ]);
  });

  it("is empty when every stock is ranked", () => {
    expect(unrankedStocks(["INFY"], [stock("INFY", 1, 1)])).toEqual([]);
  });
});
