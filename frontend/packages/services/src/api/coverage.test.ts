import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { handlers } from "@nova/mocks";
import { getCoverage, getCoverageDetail } from "./marketData";

const server = setupServer(...handlers);
const urls: string[] = [];
server.events.on("request:start", ({ request }) => {
  urls.push(new URL(request.url).search);
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  urls.length = 0;
});
afterAll(() => server.close());

describe("coverage api (D63)", () => {
  it("sends the timeframe and only the dates given", async () => {
    const list = await getCoverage({ timeframe: "1d" });
    expect(list.timeframe).toBe("1d");
    await getCoverage({ timeframe: "1m", from: "2021-09-18", to: "2026-09-18" });
    expect(urls).toEqual(["?timeframe=1d", "?timeframe=1m&from=2021-09-18&to=2026-09-18"]);
  });

  it("encodes the symbol of a detail and maps an unknown one to not_found", async () => {
    const detail = await getCoverageDetail("NIFTY 50", { timeframe: "1d" });
    expect(detail.symbol).toBe("NIFTY 50");
    await expect(getCoverageDetail("NOPE", { timeframe: "1d" })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
