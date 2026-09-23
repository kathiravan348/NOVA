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
    expect(BacktestRunSchema.array().parse(data)).toEqual(mockBacktestRuns);
  });

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
    const trades = TradeSchema.array().parse(data);
    expect(trades.length).toBeGreaterThan(0);
    expect(trades.every((t) => t.runId === runId)).toBe(true);
    expect(trades).toEqual(mockTrades.filter((t) => t.runId === runId));
  });

  it("GET /api/v1/backtests/:id/trades returns empty list for valid run with no trades", async () => {
    // run_003 is valid but has no trades in mockTrades
    const res = await fetch("http://localhost/api/v1/backtests/run_003/trades");
    expect(res.status).toBe(200);
    const data = await res.json();
    const trades = TradeSchema.array().parse(data);
    expect(trades).toEqual([]);
  });

  it("GET /api/v1/backtests/:id/trades returns 404 ApiError for unknown run id", async () => {
    const res = await fetch("http://localhost/api/v1/backtests/unknown_run/trades");
    expect(res.status).toBe(404);
    const data = await res.json();
    const parsed = ApiErrorSchema.parse(data);
    expect(parsed.error.code).toBe("not_found");
  });
});
