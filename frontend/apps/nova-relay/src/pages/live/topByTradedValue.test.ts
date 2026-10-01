import { describe, expect, it } from "vitest";
import type { Instrument } from "@nova/contracts";
import { mockInstruments } from "@nova/mocks";
import { topByTradedValue } from "./topByTradedValue";

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
});
