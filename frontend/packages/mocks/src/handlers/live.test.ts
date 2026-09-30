import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { LiveDaySummarySchema, LiveSnapshotItemSchema } from "@nova/contracts";
import { liveHandlers } from "./live";
const server = setupServer(...liveHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const get = (path: string) => fetch(`http://localhost/api/v1/live/${path}`);

describe("live mocks", () => {
  it("returns requested stocks in selection order", async () => {
    const rows = LiveSnapshotItemSchema.array().parse(
      await (await get("snapshot?symbols=TCS,INFY")).json(),
    );
    expect(rows.map((row) => row.symbol)).toEqual(["TCS", "INFY"]);
  });
  it("returns date cards with faults and shared silence", async () => {
    const rows = LiveDaySummarySchema.array().parse(await (await get("days?symbol=TCS")).json());
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.missingSeconds > 0 && row.noTradeSeconds > 0)).toBe(true);
  });
  it("rejects duplicate, invalid and unknown symbols", async () => {
    expect((await get("snapshot?symbols=INFY,INFY")).status).toBe(400);
    expect((await get("snapshot?symbols=../INFY")).status).toBe(400);
    expect((await get("snapshot?symbols=UNKNOWN")).status).toBe(404);
    expect((await get("days?symbol=UNKNOWN")).status).toBe(404);
  });
});
