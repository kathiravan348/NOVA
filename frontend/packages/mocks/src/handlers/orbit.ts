import { http, HttpResponse } from "msw";
import {
  BacktestDeleteRequestSchema,
  BacktestRunCreateSchema,
  BacktestVersionCreateSchema,
  LibraryInstallSchema,
  LoginRequestSchema,
  StrategyCreateSchema,
  StrategyUpdateSchema,
  StrategyVersionCreateSchema,
  type BacktestDeleteResult,
  type BacktestRun,
  type BacktestVersion,
  type Strategy,
} from "@nova/contracts";
import {
  mockBacktestResults,
  mockBacktestRuns,
  mockStrategies,
  mockStrategyLibrary,
  mockStrategyStats,
  mockTrades,
  mockUser,
} from "../data";
import { apiPath, badRequest, notFound, paginate } from "./api";

/** Mock writes (D43) answer with the resulting strategy; nothing is stored. */
const MOCK_NOW = "2026-09-22T04:30:00Z";

/** Every version of the backtest `run` belongs to, newest first (D60). */
function chainOf(run: BacktestRun): BacktestRun[] {
  return mockBacktestRuns
    .filter((r) => r.rootId === run.rootId)
    .sort((a, b) => b.version - a.version);
}

function isNewest(run: BacktestRun): boolean {
  return chainOf(run)[0]!.id === run.id;
}

function toVersion(run: BacktestRun): BacktestVersion {
  const result = mockBacktestResults.find((r) => r.runId === run.id);
  return {
    runId: run.id,
    version: run.version,
    status: run.status,
    strategyVersion: run.strategyVersion,
    name: run.name,
    universe: run.universe,
    from: run.from,
    to: run.to,
    initialCapitalPaise: run.initialCapitalPaise,
    benchmark: run.benchmark,
    createdAt: run.createdAt,
    error: run.error,
    reportKept: run.reportKept,
    metrics: run.status === "completed" && result ? result.metrics : null,
  };
}

/** Mock deletes answer with the count; nothing is removed (D60). */
function deleted(targets: BacktestRun[]): Response {
  if (targets.some((r) => r.status === "running")) {
    return badRequest("A running backtest cannot be deleted");
  }
  const body: BacktestDeleteResult = { deletedRuns: targets.length };
  return HttpResponse.json(body);
}

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

  http.get(apiPath("/strategies/library"), () => {
    return HttpResponse.json(mockStrategyLibrary);
  }),

  // Stateless like the other mock writes: answers the drafts, stores nothing (D62 (7)).
  http.post(apiPath("/strategies/library/install"), async ({ request }) => {
    const parsed = LibraryInstallSchema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) return badRequest("Body must be { ids } with each id once");
    const unknown = parsed.data.ids.filter(
      (id) => !mockStrategyLibrary.entries.some((e) => e.id === id),
    );
    if (unknown.length > 0) return badRequest(`Unknown library strategies: ${unknown.join(", ")}`);
    const created: Strategy[] = parsed.data.ids.map((id) => {
      const entry = mockStrategyLibrary.entries.find((e) => e.id === id)!;
      return {
        id: `stg_lib_${id.toLowerCase()}`,
        name: entry.name,
        description: entry.summary,
        status: "draft",
        latestVersion: 1,
        versions: [
          { version: 1, createdAt: MOCK_NOW, note: `From the library (${id})`, spec: entry.spec },
        ],
        createdAt: MOCK_NOW,
        updatedAt: MOCK_NOW,
      };
    });
    return HttpResponse.json(created, { status: 201 });
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

  http.delete(apiPath("/strategies/:id"), ({ params }) => {
    const id = params["id"] as string;
    if (!mockStrategies.some((s) => s.id === id)) return notFound(`Strategy ${id} not found`);
    const runs = mockBacktestRuns.filter((r) => r.strategyId === id);
    if (runs.some((r) => r.status === "running")) {
      return badRequest("Wait for the running backtest to finish");
    }
    const body: BacktestDeleteResult = { deletedRuns: runs.length };
    return HttpResponse.json(body);
  }),

  http.get(apiPath("/backtests"), ({ request }) => {
    const strategyId = new URL(request.url).searchParams.get("strategyId");
    const newest = mockBacktestRuns.filter(isNewest);
    const runs = strategyId ? newest.filter((r) => r.strategyId === strategyId) : newest;
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
      rootId: "run_new",
      version: 1,
      reportKept: true,
    };
    return HttpResponse.json(queued, { status: 201 });
  }),

  http.post(apiPath("/backtests/delete"), async ({ request }) => {
    const parsed = BacktestDeleteRequestSchema.safeParse(
      await request.json().catch(() => undefined),
    );
    if (!parsed.success) return badRequest("Body must be { ids } with 1-100 run ids");
    const runs = parsed.data.ids.map((id) => mockBacktestRuns.find((r) => r.id === id));
    const missing = parsed.data.ids.filter((_, i) => runs[i] === undefined);
    if (missing.length) return notFound(`Backtest run ${missing[0]} not found`);
    const roots = new Set(runs.map((r) => r!.rootId));
    return deleted(mockBacktestRuns.filter((r) => roots.has(r.rootId)));
  }),

  http.get(apiPath("/backtests/:id/versions"), ({ params }) => {
    const run = mockBacktestRuns.find((r) => r.id === params["id"]);
    if (!run) return notFound(`Backtest run ${String(params["id"])} not found`);
    return HttpResponse.json(chainOf(run).map(toVersion));
  }),

  http.post(apiPath("/backtests/:id/versions"), async ({ params, request }) => {
    const run = mockBacktestRuns.find((r) => r.id === params["id"]);
    if (!run) return notFound(`Backtest run ${String(params["id"])} not found`);
    const parsed = BacktestVersionCreateSchema.safeParse(
      await request.json().catch(() => undefined),
    );
    if (!parsed.success) return badRequest("Body must be a valid BacktestVersionCreate");
    const chain = chainOf(run);
    if (chain.some((r) => r.status === "queued" || r.status === "running")) {
      return badRequest("Wait for the running version to finish");
    }
    const queued: BacktestRun = {
      id: "run_new_version",
      strategyId: run.strategyId,
      ...parsed.data,
      status: "queued",
      createdAt: MOCK_NOW,
      startedAt: null,
      finishedAt: null,
      error: null,
      progress: null,
      rootId: run.rootId,
      version: chain[0]!.version + 1,
      reportKept: true,
    };
    return HttpResponse.json(queued, { status: 201 });
  }),

  http.delete(apiPath("/backtests/:id"), ({ params, request }) => {
    const run = mockBacktestRuns.find((r) => r.id === params["id"]);
    if (!run) return notFound(`Backtest run ${String(params["id"])} not found`);
    if (new URL(request.url).searchParams.get("scope") === "version") {
      if (isNewest(run)) return badRequest("Delete the whole backtest instead");
      return deleted([run]);
    }
    return deleted(chainOf(run));
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
