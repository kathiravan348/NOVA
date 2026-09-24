import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import {
  ApiErrorSchema,
  BacktestResultSchema,
  BacktestRunSchema,
  StrategySchema,
  StrategyStatsSchema,
  TradeSchema,
  UserSchema,
  pageSchema,
} from "@nova/contracts";
import {
  mockBacktestResults,
  mockBacktestRuns,
  mockStrategies,
  mockStrategyStats,
  mockTrades,
  mockUser,
} from "../data";
import { orbitHandlers } from "./orbit";

const server = setupServer(...orbitHandlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("Orbit MSW handlers", () => {
  it("GET /api/v1/me returns current mock user", async () => {
    const res = await fetch("http://localhost/api/v1/me");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(UserSchema.parse(data)).toEqual(mockUser);
  });

  it("GET /api/v1/strategies returns list of strategies", async () => {
    const res = await fetch("http://localhost/api/v1/strategies");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(StrategySchema.array().parse(data)).toEqual(mockStrategies);
  });

  it("GET /api/v1/strategies/stats returns one summary per strategy", async () => {
    const res = await fetch("http://localhost/api/v1/strategies/stats");
    expect(res.status).toBe(200);
    expect(StrategyStatsSchema.array().parse(await res.json())).toEqual(mockStrategyStats);
  });

  it("GET /api/v1/strategies/:id returns single strategy for valid id", async () => {
    const target = mockStrategies[0]!;
    const res = await fetch(`http://localhost/api/v1/strategies/${target.id}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(StrategySchema.parse(data)).toEqual(target);
  });

  it("GET /api/v1/strategies/:id returns 404 ApiError for unknown id", async () => {
    const res = await fetch("http://localhost/api/v1/strategies/unknown_id");
    expect(res.status).toBe(404);
    const data = await res.json();
    const parsed = ApiErrorSchema.parse(data);
    expect(parsed.error.code).toBe("not_found");
    expect(parsed.error.message).toContain("unknown_id");
  });

  it("GET /api/v1/backtests returns list of backtest runs", async () => {
    const res = await fetch("http://localhost/api/v1/backtests");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(pageSchema(BacktestRunSchema).parse(data)).toEqual({
      items: mockBacktestRuns,
      nextCursor: null,
    });
  });

  it("GET /api/v1/backtests with limit 1 walks every run exactly once", async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const query: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
      const res = await fetch(`http://localhost/api/v1/backtests?limit=1${query}`);
      expect(res.status).toBe(200);
      const page = pageSchema(BacktestRunSchema).parse(await res.json());
      expect(page.items).toHaveLength(1);
      seen.push(...page.items.map((r) => r.id));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor !== null && pages < 100);
    expect(seen).toEqual(mockBacktestRuns.map((r) => r.id));
  });

  it("GET /api/v1/backtests?strategyId= returns only that strategy's runs", async () => {
    const strategyId = mockBacktestRuns[0]!.strategyId;
    const res = await fetch(`http://localhost/api/v1/backtests?strategyId=${strategyId}`);
    const page = pageSchema(BacktestRunSchema).parse(await res.json());
    expect(page.items).toEqual(mockBacktestRuns.filter((r) => r.strategyId === strategyId));
    expect(page.items.length).toBeLessThan(mockBacktestRuns.length);
  });

  it.each(["limit=0", "limit=201", "limit=abc", "limit=1.5", "cursor=nope", "cursor=b2Zmc2V0Ojk5"])(
    "GET /api/v1/backtests?%s answers 400 invalid_request",
    async (query) => {
      const res = await fetch(`http://localhost/api/v1/backtests?${query}`);
      expect(res.status).toBe(400);
      expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("invalid_request");
    },
  );

  it("GET /api/v1/backtests/:id returns single backtest run for valid id", async () => {
    const target = mockBacktestRuns[0]!;
    const res = await fetch(`http://localhost/api/v1/backtests/${target.id}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(BacktestRunSchema.parse(data)).toEqual(target);
  });

  it("GET /api/v1/backtests/:id returns 404 ApiError for unknown id", async () => {
    const res = await fetch("http://localhost/api/v1/backtests/unknown_run");
    expect(res.status).toBe(404);
    const data = await res.json();
    const parsed = ApiErrorSchema.parse(data);
    expect(parsed.error.code).toBe("not_found");
    expect(parsed.error.message).toContain("unknown_run");
  });

  it("GET /api/v1/backtests/:id/result returns result for completed run", async () => {
    const target = mockBacktestResults[0]!;
    const res = await fetch(`http://localhost/api/v1/backtests/${target.runId}/result`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(BacktestResultSchema.parse(data)).toEqual(target);
  });

  it("GET /api/v1/backtests/:id/result returns 404 ApiError for unknown run id", async () => {
    const res = await fetch("http://localhost/api/v1/backtests/unknown_run/result");
    expect(res.status).toBe(404);
    const data = await res.json();
    const parsed = ApiErrorSchema.parse(data);
    expect(parsed.error.code).toBe("not_found");
  });

  it("GET /api/v1/backtests/:id/result returns 404 ApiError for run without result", async () => {
    // run_003 is 'running' and has no entry in backtestResults.json
    const res = await fetch("http://localhost/api/v1/backtests/run_003/result");
    expect(res.status).toBe(404);
    const data = await res.json();
    const parsed = ApiErrorSchema.parse(data);
    expect(parsed.error.code).toBe("not_found");
  });

  it("GET /api/v1/backtests/:id/trades returns matching trades for completed run", async () => {
    const runId = mockBacktestResults[0]!.runId;
    const res = await fetch(`http://localhost/api/v1/backtests/${runId}/trades`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const trades = pageSchema(TradeSchema).parse(data).items;
    expect(trades.length).toBeGreaterThan(0);
    expect(trades.every((t) => t.runId === runId)).toBe(true);
    expect(trades).toEqual(mockTrades.filter((t) => t.runId === runId));
  });

  it("GET /api/v1/backtests/:id/trades returns empty list for valid run with no trades", async () => {
    // run_003 is valid but has no trades in mockTrades
    const res = await fetch("http://localhost/api/v1/backtests/run_003/trades");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(pageSchema(TradeSchema).parse(data)).toEqual({ items: [], nextCursor: null });
  });

  it("GET /api/v1/backtests/:id/trades returns 404 ApiError for unknown run id", async () => {
    const res = await fetch("http://localhost/api/v1/backtests/unknown_run/trades");
    expect(res.status).toBe(404);
    const data = await res.json();
    const parsed = ApiErrorSchema.parse(data);
    expect(parsed.error.code).toBe("not_found");
  });

  it("POST /api/v1/strategies answers with a draft version 1 (D43)", async () => {
    const spec = mockStrategies[0]!.versions[0]!.spec;
    const res = await fetch("http://localhost/api/v1/strategies", {
      method: "POST",
      body: JSON.stringify({ name: "New", description: "", spec }),
    });
    expect(res.status).toBe(201);
    const created = StrategySchema.parse(await res.json());
    expect(created).toMatchObject({ name: "New", status: "draft", latestVersion: 1 });
  });

  it("POST /api/v1/strategies/:id/versions adds latest + 1", async () => {
    const target = mockStrategies[0]!;
    const res = await fetch(`http://localhost/api/v1/strategies/${target.id}/versions`, {
      method: "POST",
      body: JSON.stringify({ note: "Tweak", spec: target.versions[0]!.spec }),
    });
    const updated = StrategySchema.parse(await res.json());
    expect(updated.latestVersion).toBe(target.latestVersion + 1);
    expect(updated.versions).toHaveLength(target.versions.length + 1);
  });

  it("PATCH /api/v1/strategies/:id changes the status; bad bodies are 400", async () => {
    const target = mockStrategies[0]!;
    const url = `http://localhost/api/v1/strategies/${target.id}`;
    const ok = await fetch(url, { method: "PATCH", body: JSON.stringify({ status: "archived" }) });
    expect(StrategySchema.parse(await ok.json()).status).toBe("archived");
    const bad = await fetch(url, { method: "PATCH", body: JSON.stringify({}) });
    expect(bad.status).toBe(400);
    const missing = await fetch("http://localhost/api/v1/strategies/nope", {
      method: "PATCH",
      body: JSON.stringify({ status: "active" }),
    });
    expect(missing.status).toBe(404);
  });

  it("POST /api/v1/backtests answers a queued run (D44)", async () => {
    const body = {
      strategyId: "stg_001",
      strategyVersion: 2,
      name: "Queued",
      universe: { type: "symbols", symbols: ["INFY"] },
      from: "2025-01-01",
      to: "2025-06-30",
      initialCapitalPaise: 10_000_000,
      benchmark: null,
    };
    const res = await fetch("http://localhost/api/v1/backtests", {
      method: "POST",
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(201);
    expect(BacktestRunSchema.parse(await res.json())).toMatchObject({
      status: "queued",
      name: "Queued",
    });
    const bad = await fetch("http://localhost/api/v1/backtests", {
      method: "POST",
      body: JSON.stringify({ ...body, strategyId: "nope" }),
    });
    expect(bad.status).toBe(404);
  });
});
