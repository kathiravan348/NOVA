import { http, HttpResponse } from "msw";
import {
  BacktestRunCreateSchema,
  LoginRequestSchema,
  StrategyCreateSchema,
  StrategyUpdateSchema,
  StrategyVersionCreateSchema,
  type BacktestRun,
  type Strategy,
} from "@nova/contracts";
import {
  mockBacktestResults,
  mockBacktestRuns,
  mockStrategies,
  mockStrategyStats,
  mockTrades,
  mockUser,
} from "../data";
import { apiPath, badRequest, notFound, paginate } from "./api";

/** Mock writes (D43) answer with the resulting strategy; nothing is stored. */
const MOCK_NOW = "2026-09-22T04:30:00Z";

export const orbitHandlers = [
  http.get(apiPath("/me"), () => {
    return HttpResponse.json(mockUser);
  }),

  // Mock sign-in (D38 shape): any valid email and password signs in as the mock user.
  http.post(apiPath("/auth/login"), async ({ request }) => {
    const parsed = LoginRequestSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) return badRequest("Body must be { email, password }");
    return HttpResponse.json(mockUser);
  }),

  http.post(apiPath("/auth/logout"), () => new HttpResponse(null, { status: 204 })),

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

  http.post(apiPath("/strategies"), async ({ request }) => {
    const parsed = StrategyCreateSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) return badRequest("Body must be { name, description, spec }");
    const { name, description, spec } = parsed.data;
    const created: Strategy = {
      id: "stg_new",
      name,
      description,
      status: "draft",
      latestVersion: 1,
      versions: [{ version: 1, createdAt: MOCK_NOW, note: "First version", spec }],
      createdAt: MOCK_NOW,
      updatedAt: MOCK_NOW,
    };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.post(apiPath("/strategies/:id/versions"), async ({ params, request }) => {
    const strategy = mockStrategies.find((s) => s.id === (params["id"] as string));
    if (!strategy) return notFound(`Strategy ${params["id"] as string} not found`);
    const parsed = StrategyVersionCreateSchema.safeParse(
      await request.json().catch(() => undefined),
    );
    if (!parsed.success) return badRequest("Body must be { note, spec }");
    const version = strategy.latestVersion + 1;
    const updated: Strategy = {
      ...strategy,
      latestVersion: version,
      versions: [...strategy.versions, { version, createdAt: MOCK_NOW, ...parsed.data }],
      updatedAt: MOCK_NOW,
    };
    return HttpResponse.json(updated, { status: 201 });
  }),

  http.patch(apiPath("/strategies/:id"), async ({ params, request }) => {
    const strategy = mockStrategies.find((s) => s.id === (params["id"] as string));
    if (!strategy) return notFound(`Strategy ${params["id"] as string} not found`);
    const parsed = StrategyUpdateSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) return badRequest("Change at least one of name, description, status");
    return HttpResponse.json({ ...strategy, ...parsed.data, updatedAt: MOCK_NOW });
  }),

  http.get(apiPath("/backtests"), ({ request }) => {
    const strategyId = new URL(request.url).searchParams.get("strategyId");
    const runs = strategyId
      ? mockBacktestRuns.filter((r) => r.strategyId === strategyId)
      : mockBacktestRuns;
    return paginate(runs, request.url);
  }),

  http.post(apiPath("/backtests"), async ({ request }) => {
    const parsed = BacktestRunCreateSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) return badRequest("Body must be a valid BacktestRunCreate");
    const strategy = mockStrategies.find((s) => s.id === parsed.data.strategyId);
    if (!strategy) return notFound(`Strategy ${parsed.data.strategyId} not found`);
    const queued: BacktestRun = {
      id: "run_new",
      ...parsed.data,
      status: "queued",
      createdAt: MOCK_NOW,
      startedAt: null,
      finishedAt: null,
      error: null,
      progress: null,
    };
    return HttpResponse.json(queued, { status: 201 });
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
