import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import {
  ApiErrorSchema,
  LedgerDaySchema,
  LedgerEventSchema,
  BacktestResultSchema,
  BacktestDeleteResultSchema,
  BacktestRunListItemSchema,
  BacktestRunSchema,
  BacktestVersionSchema,
  StrategyLibrarySchema,
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
  mockStrategyLibrary,
  mockStrategyStats,
  mockTrades,
  mockUser,
} from "../data";
import { orbitHandlers } from "./orbit";
import { toListItem } from "./backtestList";

const server = setupServer(...orbitHandlers);
// The list shows only the newest version of each backtest (D60): run_006 is v1 of run_002.
const listed = mockBacktestRuns.filter((r) => r.id !== "run_006").map(toListItem);

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
  it("serves static ledger pages, date and symbol filters, and portfolio cash", async () => {
    const path = "http://localhost/api/v1/backtests/run_001/ledger";
    const first = pageSchema(LedgerDaySchema).parse(await (await fetch(`${path}?limit=2`)).json());
    expect(first.total).toBe(4);
    expect(first.items.map((day) => day.date)).toEqual(["2026-06-02", "2026-06-05"]);
    const rest = pageSchema(LedgerDaySchema).parse(
      await (await fetch(`${path}?offset=2&limit=2`)).json(),
    );
    expect(rest.items.at(-1)?.cashPaise).toBe(100499474);
    const all = pageSchema(LedgerDaySchema).parse(
      await (await fetch(`${path}?allDays=true`)).json(),
    );
    expect(all.total).toBe(11);
    const filtered = pageSchema(LedgerDaySchema).parse(
      await (await fetch(`${path}?symbol=RELIANCE&from=2026-06-03&to=2026-06-15`)).json(),
    );
    expect(filtered.total).toBe(1);
    expect(filtered.items[0]?.cashPaise).toBe(100499474);
    const events = LedgerEventSchema.array().parse(
      await (await fetch(`${path}/2026-06-02?symbol=RELIANCE`)).json(),
    );
    expect(events.map((event) => event.cashAfterPaise)).toEqual([85500000, 100241725]);
    expect(events[1]?.reason).toBeNull();
    expect(events.map((event) => event.entryAt)).toEqual([null, "2026-06-02T04:00:00Z"]);
  });

  it("serves the timeline oldest first with paging and filters", async () => {
    const path = "http://localhost/api/v1/backtests/run_001/timeline";
    const parse = async (query: string) =>
      pageSchema(LedgerEventSchema).parse(await (await fetch(`${path}${query}`)).json());
    const first = await parse("?limit=5");
    const rest = await parse("?offset=5&limit=5");
    expect(first.total).toBe(8);
    expect(first.nextCursor).toBeNull();
    const events = [...first.items, ...rest.items];
    expect(events.map((event) => event.at)).toEqual([...events.map((event) => event.at)].sort());
    expect(events.filter((event) => event.side === "sell").every((event) => event.entryAt)).toBe(
      true,
    );
    expect(events.at(-1)?.cashAfterPaise).toBe(100499474);
    const filtered = await parse("?symbol=RELIANCE&from=2026-06-03");
    expect(filtered.items.map((event) => event.side)).toEqual(["buy", "sell"]);
    expect((await fetch(`${path}?from=2026-06-05&to=2026-06-01`)).status).toBe(400);
  });

  it.each([
    ["nope", "ledger", 404],
    ["run_003", "ledger", 400],
    ["run_006", "ledger", 400],
    ["nope", "timeline", 404],
    ["run_003", "timeline", 400],
    ["run_006", "timeline", 400],
  ])("refuses %s %s", async (id, suffix, status) => {
    const response = await fetch(`http://localhost/api/v1/backtests/${id}/${suffix}`);
    expect(response.status).toBe(status);
    expect(ApiErrorSchema.safeParse(await response.json()).success).toBe(true);
  });

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
    expect(pageSchema(BacktestRunListItemSchema).parse(data)).toEqual({
      items: listed,
      total: listed.length,
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
      const page = pageSchema(BacktestRunListItemSchema).parse(await res.json());
      expect(page.items).toHaveLength(1);
      seen.push(...page.items.map((r) => r.id));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor !== null && pages < 100);
    expect(seen).toEqual(listed.map((r) => r.id));
  });

  it("GET /api/v1/backtests?strategyId= returns only that strategy's runs", async () => {
    const strategyId = mockBacktestRuns[0]!.strategyId;
    const res = await fetch(`http://localhost/api/v1/backtests?strategyId=${strategyId}`);
    const page = pageSchema(BacktestRunListItemSchema).parse(await res.json());
    expect(page.items).toEqual(listed.filter((r) => r.strategyId === strategyId));
    expect(page.items.length).toBeLessThan(listed.length);
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

  it("GET /api/v1/backtests/:id reports skipped index members", async () => {
    const res = await fetch("http://localhost/api/v1/backtests/run_006");
    expect(BacktestRunSchema.parse(await res.json())).toMatchObject({
      universe: { type: "index", index: "NIFTY 100" },
      skippedSymbols: ["HYUNDAI", "TATACAP"],
    });
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
    expect(pageSchema(TradeSchema).parse(data)).toEqual({ items: [], nextCursor: null, total: 0 });
  });

  it("GET /api/v1/backtests/:id/trades returns 404 ApiError for unknown run id", async () => {
    const res = await fetch("http://localhost/api/v1/backtests/unknown_run/trades");
    expect(res.status).toBe(404);
    const data = await res.json();
    const parsed = ApiErrorSchema.parse(data);
    expect(parsed.error.code).toBe("not_found");
  });

  it("GET /api/v1/strategies/library returns the library sample (D62)", async () => {
    const res = await fetch("http://localhost/api/v1/strategies/library");
    expect(StrategyLibrarySchema.parse(await res.json())).toEqual(mockStrategyLibrary);
  });

  it("POST /api/v1/strategies/library/install answers one draft per id; unknown ids are 400", async () => {
    const install = (ids: string[]) =>
      fetch("http://localhost/api/v1/strategies/library/install", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
    const res = await install(["B01", "A01"]);
    expect(res.status).toBe(201);
    const created = StrategySchema.array().parse(await res.json());
    expect(created.map((s) => [s.name, s.status])).toEqual([
      ["Turtle 55/20", "draft"],
      ["12-1 momentum", "draft"],
    ]);
    expect(created[1]!.versions[0]!.note).toBe("From the library (A01)");
    const bad = await install(["A01", "B99"]);
    expect(bad.status).toBe(400);
    expect(ApiErrorSchema.parse(await bad.json()).error.message).toContain("B99");
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
      skippedSymbols: [],
    });
    const bad = await fetch("http://localhost/api/v1/backtests", {
      method: "POST",
      body: JSON.stringify({ ...body, strategyId: "nope" }),
    });
    expect(bad.status).toBe(404);
  });

  it("GET /api/v1/backtests/:id/versions lists a backtest's versions, newest first (D60)", async () => {
    const res = await fetch("http://localhost/api/v1/backtests/run_002/versions");
    const versions = BacktestVersionSchema.array().parse(await res.json());
    expect(versions.map((v) => [v.runId, v.version, v.reportKept])).toEqual([
      ["run_002", 2, true],
      ["run_006", 1, false],
    ]);
    expect(versions[1]!.metrics?.returnPercent).toBe(0.21);
  });

  it("POST /api/v1/backtests/:id/versions queues the next version", async () => {
    const body = {
      strategyVersion: 2,
      name: "VWAP v3",
      universe: { type: "symbols", symbols: ["INFY"] },
      from: "2025-01-01",
      to: "2025-06-30",
      initialCapitalPaise: 10_000_000,
      benchmark: null,
    };
    const post = (id: string) =>
      fetch(`http://localhost/api/v1/backtests/${id}/versions`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    const res = await post("run_006");
    expect(res.status).toBe(201);
    expect(BacktestRunSchema.parse(await res.json())).toMatchObject({
      rootId: "run_006",
      version: 3,
      strategyId: "stg_001",
      status: "queued",
      skippedSymbols: [],
    });
    expect((await post("run_003")).status).toBe(400); // run_003 is still running
  });

  it("DELETE /api/v1/backtests/:id removes a backtest or one old version", async () => {
    const del = (path: string) =>
      fetch(`http://localhost/api/v1/backtests/${path}`, { method: "DELETE" });
    const all = BacktestDeleteResultSchema.parse(await (await del("run_002")).json());
    expect(all.deletedRuns).toBe(2);
    const one = BacktestDeleteResultSchema.parse(await (await del("run_006?scope=version")).json());
    expect(one.deletedRuns).toBe(1);
    expect((await del("run_002?scope=version")).status).toBe(400);
    expect((await del("run_003")).status).toBe(400);
    expect((await del("nope")).status).toBe(404);
  });

  it("DELETE /api/v1/strategies/:id deletes it with its backtests (D62)", async () => {
    const del = (id: string) =>
      fetch(`http://localhost/api/v1/strategies/${id}`, { method: "DELETE" });
    const res = await del("stg_001");
    expect(res.status).toBe(200);
    expect(BacktestDeleteResultSchema.parse(await res.json()).deletedRuns).toBe(4);
    expect((await del("stg_002")).status).toBe(400); // one of its runs is running
    expect((await del("stg_nope")).status).toBe(404);
  });

  it("POST /api/v1/backtests/delete removes whole backtests", async () => {
    const post = (ids: string[]) =>
      fetch("http://localhost/api/v1/backtests/delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
    const res = await post(["run_002", "run_005"]);
    expect(BacktestDeleteResultSchema.parse(await res.json()).deletedRuns).toBe(3);
    expect((await post(["run_003"])).status).toBe(400);
    expect((await post([])).status).toBe(400);
  });
});

describe("Backtests list filters (D82)", () => {
  const ids = async (query: string) => {
    const res = await fetch(`http://localhost/api/v1/backtests?${query}`);
    expect(res.status).toBe(200);
    return pageSchema(BacktestRunListItemSchema)
      .parse(await res.json())
      .items.map((r) => r.id);
  };

  it("filters by source, results and name like the backend", async () => {
    expect(await ids("dataSource=recorded")).toEqual(["run_001"]);
    expect(await ids("minCagr=12")).toEqual(["run_001"]);
    expect(await ids("profitable=true")).toEqual(["run_001", "run_002"]);
    expect(await ids("status=failed")).toEqual(["run_005"]);
    expect(await ids("q=delivery")).toEqual(["run_003"]);
  });

  it("sorts by a result with runs without one last, and refuses a cursor with it", async () => {
    expect((await ids("sort=cagr&order=asc")).slice(0, 2)).toEqual(["run_002", "run_001"]);
    const res = await fetch("http://localhost/api/v1/backtests?sort=cagr&cursor=abc");
    expect(res.status).toBe(400);
    expect((await fetch("http://localhost/api/v1/backtests?minCagr=x")).status).toBe(400);
  });

  it("serves strategy stats for one data source", async () => {
    const res = await fetch("http://localhost/api/v1/strategies/stats?dataSource=recorded");
    const rows = StrategyStatsSchema.array().parse(await res.json());
    const vwap = rows.find((r) => r.strategyId === "stg_001")!;
    expect(vwap.runsTotal).toBe(1);
    expect(vwap.bestNetPnl).toEqual({ runId: "run_001", netPnlPaise: 499_474 });
  });
});
