import { describe, expect, it } from "vitest";
import { UniverseEntrySchema, UniverseEntryWriteSchema } from "./universe";

const entry = {
  symbol: "M&M",
  name: "Mahindra & Mahindra",
  sector: "Automobile",
  indices: ["NIFTY 50"],
};

describe("universe contracts", () => {
  it("accepts a stock and its listed form", () => {
    expect(UniverseEntryWriteSchema.parse(entry)).toEqual(entry);
    expect(
      UniverseEntrySchema.parse({ ...entry, synced: false, newListing: true }).newListing,
    ).toBe(true);
  });

  it.each([
    { symbol: "infy" },
    { symbol: "TOO-LONG-SYMBOL-NAME-X" },
    { name: " " },
    { sector: "x".repeat(81) },
    { indices: ["nifty it"] },
    { synced: true },
  ])("rejects %o in a write body", (change) => {
    expect(UniverseEntryWriteSchema.safeParse({ ...entry, ...change }).success).toBe(false);
  });
});
