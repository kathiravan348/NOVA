import { http, HttpResponse } from "msw";
import {
  mockBacktestResults,
  mockBacktestRuns,
  mockStrategies,
  mockStrategyStats,
  mockTrades,
  mockUser,
} from "../data";
import { apiPath, notFound, paginate } from "./api";

export const orbitHandlers = [
  http.get(apiPath("/me"), () => {
    return HttpResponse.json(mockUser);
  }),

  http.get(apiPath("/strategies"), () => {
    return HttpResponse.json(mockStrategies);
  }),

  // Registered before `/strategies/:id` so "stats" is not read as an id.
  http.get(apiPath("/strategies/stats"), () => {
    return HttpResponse.json(mockStrategyStats);
  }),

  http.get(apiPath("/strategies/:id"), ({ params }) => {
    const id = params["id"] as string;
    const strategy = mockStrategies.find((s) => s.id === id);
    if (!strategy) {
      return notFound(`Strategy ${id} not found`);
    }
    return HttpResponse.json(strategy);
  }),

  http.get(apiPath("/backtests"), ({ request }) => {
    const strategyId = new URL(request.url).searchParams.get("strategyId");
    const runs = strategyId
      ? mockBacktestRuns.filter((r) => r.strategyId === strategyId)
      : mockBacktestRuns;
    return paginate(runs, request.url);
  }),

  http.get(apiPath("/backtests/:id"), ({ params }) => {
    const id = params["id"] as string;
    const run = mockBacktestRuns.find((r) => r.id === id);
    if (!run) {
      return notFound(`Backtest run ${id} not found`);
    }
    return HttpResponse.json(run);
  }),

  http.get(apiPath("/backtests/:id/result"), ({ params }) => {
    const id = params["id"] as string;
    const run = mockBacktestRuns.find((r) => r.id === id);
    if (!run) {
      return notFound(`Backtest run ${id} not found`);
    }
    const result = mockBacktestResults.find((res) => res.runId === id);
    if (!result) {
      return notFound(`Backtest result for run ${id} not found`);
    }
    return HttpResponse.json(result);
  }),

  http.get(apiPath("/backtests/:id/trades"), ({ params, request }) => {
    const id = params["id"] as string;
    const run = mockBacktestRuns.find((r) => r.id === id);
    if (!run) {
      return notFound(`Backtest run ${id} not found`);
    }
    const trades = mockTrades.filter((t) => t.runId === id);
    return paginate(trades, request.url);
  }),
];
