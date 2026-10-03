import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { handlers, mockBacktestRuns, mockStrategies } from "@nova/mocks";
import { RUN_POLL_MS } from "@nova/services";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);
const posted: unknown[] = [];
server.events.on("request:start", ({ request }) => {
  if (request.method === "POST")
    void request
      .clone()
      .json()
      .then((body) => posted.push(body));
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
  vi.unstubAllEnvs();
  posted.length = 0;
});
afterAll(() => server.close());

describe("Backtests list", () => {
  it("lists every run with its status", async () => {
    renderApp("/backtests");
    // Only the newest version of each backtest is listed (D60): run_006 is v1 of run_002.
    for (const run of mockBacktestRuns.filter((r) => r.id !== "run_006")) {
      const name = run.version > 1 ? `${run.name} · v${run.version}` : run.name;
      expect((await screen.findAllByRole("link", { name })).length).toBeGreaterThan(0);
    }
    for (const label of ["Completed", "Queued", "Failed"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("Running · 56%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("12 symbols").length).toBeGreaterThan(0);
    expect(screen.getAllByText("NIFTY 50").length).toBeGreaterThan(0);
  });
});

describe("Backtest result", () => {
  it("shows metrics, the equity curve and trades for a completed run", async () => {
    renderApp("/backtests/run_001");
    expect(await screen.findByRole("heading", { name: "VWAP Intraday v1 Backtest" }));
    expect((await screen.findAllByText("Net P&L")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+₹4,994\.74/).length).toBeGreaterThan(0);
    expect(await screen.findByText(/From 1 Jun 2026 to .*, equity/)).toBeInTheDocument();
    expect((await screen.findAllByText("RELIANCE")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("TCS").length).toBeGreaterThan(0);
    expect(screen.getByText("RELIANCE, TCS, INFY")).toBeInTheDocument();
    expect(screen.queryByText(/^Skipped \d+ stocks/)).not.toBeInTheDocument();
  });

  it("names skipped members on the NIFTY 100 summary-only run", async () => {
    renderApp("/backtests/run_006");
    expect(
      await screen.findByText("Skipped 2 stocks with no prices in this period: HYUNDAI, TATACAP"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Older version: only the summary is kept/)).toBeInTheDocument();
  });

  it.each(["completed", "running"] as const)(
    "names skipped members on a %s run",
    async (status) => {
      const run = mockBacktestRuns.find((r) => r.id === "run_001")!;
      server.use(
        http.get("*/api/v1/backtests/run_001", () =>
          HttpResponse.json({
            ...run,
            status,
            universe: { type: "index", index: "NIFTY 100" },
            skippedSymbols: ["HYUNDAI", "TATACAP"],
          }),
        ),
      );
      renderApp("/backtests/run_001");
      expect(
        await screen.findByText("Skipped 2 stocks with no prices in this period: HYUNDAI, TATACAP"),
      ).toBeInTheDocument();
    },
  );

  it("lists at most ten skipped members and counts the rest", async () => {
    const run = mockBacktestRuns.find((r) => r.id === "run_006")!;
    const skippedSymbols = Array.from(
      { length: 12 },
      (_, i) => `STOCK${String(i + 1).padStart(2, "0")}`,
    );
    server.use(
      http.get("*/api/v1/backtests/run_006", () => HttpResponse.json({ ...run, skippedSymbols })),
    );
    renderApp("/backtests/run_006");
    const note = await screen.findByText(/^Skipped 12 stocks/);
    expect(note.textContent).toBe(
      `Skipped 12 stocks with no prices in this period: ${skippedSymbols.slice(0, 10).join(", ")} and 2 more`,
    );
    expect(note).not.toHaveTextContent("STOCK11");
    expect(note).not.toHaveTextContent("STOCK12");
  });

  it("uses the singular for one skipped member", async () => {
    const run = mockBacktestRuns.find((r) => r.id === "run_006")!;
    server.use(
      http.get("*/api/v1/backtests/run_006", () =>
        HttpResponse.json({ ...run, skippedSymbols: ["HYUNDAI"] }),
      ),
    );
    renderApp("/backtests/run_006");
    expect(
      await screen.findByText("Skipped 1 stock with no prices in this period: HYUNDAI"),
    ).toBeInTheDocument();
  });

  it("shows results by symbol and filters trades by symbol", async () => {
    renderApp("/backtests/run_001");
    const table = await screen.findByRole("table", { name: "Results by symbol" });
    expect(table).toHaveTextContent("RELIANCE");
    expect(table).toHaveTextContent("100% (2/2)");
    expect(table).toHaveTextContent("−₹1,065.22");
    const trades = await screen.findByRole("table", { name: "Trades" });
    await waitFor(() => expect(trades.querySelectorAll("tbody tr")).toHaveLength(4));
    fireEvent.click(screen.getAllByRole("button", { name: "Show INFY trades" })[0]!);
    expect(screen.getByLabelText("Symbol")).toHaveValue("INFY");
    expect(trades.querySelectorAll("tbody tr")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Symbol"), { target: { value: "" } });
    expect(trades.querySelectorAll("tbody tr")).toHaveLength(4);
  });

  it("opens the charges breakdown for a trade", async () => {
    renderApp("/backtests/run_001");
    const buttons = await screen.findAllByRole("button", { name: /Charges for RELIANCE trade/ });
    fireEvent.click(buttons[0]!);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Brokerage");
    expect(dialog).toHaveTextContent("Total");
  });

  it("shows live progress, a waiting run and where a failed run stopped", async () => {
    renderApp("/backtests/run_003");
    const meter = await screen.findByRole("meter", { name: "Progress" });
    expect(meter).toHaveAttribute("aria-valuenow", "56");
    expect(
      screen.getByText("Simulating — reached 12 Mar 2026 · 14 trades so far"),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Running for /)).toBeInTheDocument();
    cleanup();
    renderApp("/backtests/run_004");
    expect(await screen.findByText("Waiting to start")).toBeInTheDocument();
    cleanup();
    renderApp("/backtests/run_005");
    expect(
      await screen.findByText(/Data missing for symbol SBIN on 2026-04-14/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Stopped while: Loading prices — 1 of 1 stock (20%)"),
    ).toBeInTheDocument();
  });

  it("switches to the results when a running run completes", async () => {
    const completed = mockBacktestRuns.find((r) => r.id === "run_001")!;
    const running = {
      ...completed,
      status: "running",
      finishedAt: null,
      progress: { ...completed.progress!, stage: "simulating", percent: 42 },
    };
    let calls = 0;
    server.use(
      http.get("*/api/v1/backtests/run_001", () => {
        calls += 1;
        return HttpResponse.json(calls === 1 ? running : completed);
      }),
    );
    const original = RUN_POLL_MS.detail;
    RUN_POLL_MS.detail = 50;
    try {
      renderApp("/backtests/run_001");
      expect(await screen.findByRole("meter", { name: "Progress" })).toBeInTheDocument();
      expect((await screen.findAllByText("Net P&L")).length).toBeGreaterThan(0);
      expect(screen.queryByRole("meter", { name: "Progress" })).not.toBeInTheDocument();
    } finally {
      RUN_POLL_MS.detail = original;
    }
  });

  it("shows Not found for an unknown run", async () => {
    renderApp("/backtests/nope");
    expect(await screen.findByText("Not found")).toBeInTheDocument();
  });
});

describe("New backtest form", () => {
  it("follows the universe's index until Benchmark is changed", async () => {
    renderApp("/backtests/new?strategy=stg_001");
    const benchmark = await screen.findByLabelText("Benchmark");
    expect(benchmark).toHaveValue("NIFTY 50");
    await within(benchmark).findByRole("option", { name: /^NIFTY 100 \(/ });
    expect(within(benchmark).getAllByRole("option")).toHaveLength(20);
    fireEvent.change(screen.getByLabelText("Test on"), { target: { value: "index" } });
    fireEvent.change(screen.getByLabelText("Index"), { target: { value: "NIFTY 100" } });
    await waitFor(() => expect(benchmark).toHaveValue("NIFTY 100"));
    fireEvent.change(benchmark, { target: { value: "NIFTY 50" } });
    fireEvent.change(screen.getByLabelText("Index"), { target: { value: "NIFTY BANK" } });
    expect(benchmark).toHaveValue("NIFTY 50");
    fireEvent.change(benchmark, { target: { value: "NIFTY 500" } });
    fireEvent.change(screen.getByLabelText("Index"), { target: { value: "NIFTY 200" } });
    expect(benchmark).toHaveValue("NIFTY 500");
    fireEvent.click(screen.getByRole("button", { name: "Queue backtest" }));
    expect(await screen.findByText("Backtest queued (demo)")).toBeInTheDocument();
    expect(posted[0]).toMatchObject({ benchmark: "NIFTY 500" });
  });

  it("keeps None after changing the universe and submits null", async () => {
    renderApp("/backtests/new?strategy=stg_001");
    const benchmark = await screen.findByLabelText("Benchmark");
    fireEvent.change(benchmark, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Test on"), { target: { value: "index" } });
    expect(benchmark).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Queue backtest" }));
    expect(await screen.findByText("Backtest queued (demo)")).toBeInTheDocument();
    expect(posted[0]).toMatchObject({ benchmark: null });
  });

  it("keeps an explicit Library benchmark and defaults an index-only link to that index", async () => {
    renderApp("/backtests/new?strategy=stg_001&index=NIFTY%20100&benchmark=NIFTY%20500");
    expect(await screen.findByLabelText("Benchmark")).toHaveValue("NIFTY 500");
    cleanup();
    renderApp("/backtests/new?strategy=stg_001&index=NIFTY%20100");
    await waitFor(() => expect(screen.getByLabelText("Benchmark")).toHaveValue("NIFTY 100"));
  });

  it("preselects the strategy from the query string", async () => {
    renderApp("/backtests/new?strategy=stg_001");
    expect(await screen.findByDisplayValue("VWAP Momentum Intraday backtest")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Strategy/)).toHaveValue("stg_001");
    expect(screen.getByLabelText(/^Version/)).toHaveValue("2");
  });

  it("offers every NSE index for a whole-index test (D56)", async () => {
    renderApp("/backtests/new?strategy=stg_001");
    fireEvent.change(await screen.findByLabelText(/^Test on/), { target: { value: "index" } });
    const index = await screen.findByLabelText(/^Index/);
    await within(index).findByRole("option", { name: /^NIFTY MIDCAP 100 \(/ });
    expect(within(index).getAllByRole("option")).toHaveLength(19);
    expect(index).toHaveValue("NIFTY 50");
  });

  it("rejects a start after the end", async () => {
    renderApp("/backtests/new?strategy=stg_001");
    const from = await screen.findByLabelText(/^From/);
    fireEvent.change(from, { target: { value: "2026-09-10" } });
    fireEvent.change(screen.getByLabelText(/^To/), { target: { value: "2026-09-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Queue backtest" }));
    expect(await screen.findByText("Start must be on or before end")).toBeInTheDocument();
  });

  it("queues a valid run (demo) and returns to the list", async () => {
    const { router } = renderApp("/backtests/new?strategy=stg_001");
    fireEvent.click(await screen.findByRole("button", { name: "Queue backtest" }));
    expect(await screen.findByText("Choose at least one symbol")).toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole("checkbox", { name: "Select TCS" }))[0]!);
    fireEvent.click((await screen.findAllByRole("checkbox", { name: "Select INFY" }))[0]!);
    expect(screen.getByText("selected")).toHaveTextContent("2 selected");
    fireEvent.click(screen.getByRole("button", { name: "Queue backtest" }));
    expect(await screen.findByText("Backtest queued (demo)")).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe("/backtests"));
    expect(posted[0]).toMatchObject({
      strategyId: "stg_001",
      universe: { type: "symbols", symbols: ["TCS", "INFY"] },
      initialCapitalPaise: 100_000_000,
      benchmark: "NIFTY 50",
    });
  });

  it("opens the queued run in real mode (D44, D48)", async () => {
    vi.stubEnv("VITE_DATA_MODE", "real");
    const { router } = renderApp("/backtests/new?strategy=stg_001");
    fireEvent.click((await screen.findAllByRole("checkbox", { name: "Select TCS" }))[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Queue backtest" }));
    expect(await screen.findByText("Backtest queued")).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe("/backtests/run_new"));
  });

  it("filters the picker and asks to drop symbols without data for the period", async () => {
    renderApp("/backtests/new?strategy=stg_002"); // a daily strategy
    expect(await screen.findByLabelText(/^From/)).toHaveValue("2026-07-18");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "dabur" } });
    expect(screen.getAllByText("Partial data").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Select DABUR" })[0]!);
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Index"), { target: { value: "NIFTY BANK" } });
    expect(screen.queryAllByRole("checkbox", { name: "Select TCS" })).toHaveLength(0);
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Select SBIN" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Queue backtest" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("DABUR");
    expect(dialog).not.toHaveTextContent("SBIN");
    fireEvent.click(screen.getByRole("button", { name: "Drop and queue" }));
    expect(await screen.findByText("Backtest queued (demo)")).toBeInTheDocument();
  });

  it("checks coverage in the strategy's own timeframe (NOVA-097)", async () => {
    renderApp("/backtests/new?strategy=stg_001"); // 5-minute candles
    fireEvent.change(await screen.findByLabelText("Search"), { target: { value: "SBIN" } });
    expect((await screen.findAllByText("No 5m data")).length).toBeGreaterThan(0); // SBIN: daily only
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Select SBIN" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Queue backtest" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("SBIN");
  });

  it("can test a whole index instead of chosen symbols", async () => {
    renderApp("/backtests/new?strategy=stg_001");
    fireEvent.change(await screen.findByLabelText("Test on"), { target: { value: "index" } });
    expect(screen.queryByLabelText("Search")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Queue backtest" }));
    expect(await screen.findByText("Backtest queued (demo)")).toBeInTheDocument();
  });
});

describe("Data source (D82)", () => {
  it("refuses Recorded data for a delivery strategy and queues nothing", async () => {
    renderApp("/backtests/new?strategy=stg_002");
    const data = await screen.findByLabelText(/^Data/);
    fireEvent.change(data, { target: { value: "recorded" } });
    expect(
      await screen.findByText("Recorded data backtests are intraday only"),
    ).toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole("checkbox", { name: "Select TCS" }))[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Queue backtest" }));
    await waitFor(() =>
      expect(screen.getAllByText("Recorded data backtests are intraday only")).not.toHaveLength(0),
    );
    expect(posted).toHaveLength(0);
  });

  it("starts a seconds strategy on Recorded data and refuses History data", async () => {
    const intraday = mockStrategies[0]!;
    const seconds = {
      ...intraday,
      versions: intraday.versions.map((v) => ({
        ...v,
        spec: { ...v.spec, timeframe: "5s" as const },
      })),
    };
    server.use(http.get("*/api/v1/strategies", () => HttpResponse.json([seconds])));
    renderApp("/backtests/new?strategy=stg_001");
    const data = await screen.findByLabelText(/^Data/);
    await waitFor(() => expect(data).toHaveValue("recorded"));
    expect(screen.getByText(/Candles built from your recorded ticks/)).toBeInTheDocument();
    fireEvent.change(data, { target: { value: "history" } });
    expect(
      await screen.findByText("Seconds candles exist only in recorded data"),
    ).toBeInTheDocument();
  });

  it("shows the data, recorded days and spread cost of a recorded run", async () => {
    renderApp("/backtests/run_001");
    expect(await screen.findByText("Recorded data")).toBeInTheDocument();
    expect(screen.getByText("10 used · 1 skipped")).toHaveAttribute(
      "title",
      "Skipped (feed gaps over 5 minutes): 5 Jun 2026",
    );
    expect(await screen.findByText("Spread cost")).toBeInTheDocument();
  });

  it("shows History data and no recorded lines for a history run", async () => {
    renderApp("/backtests/run_002");
    expect(await screen.findByText("History data")).toBeInTheDocument();
    expect(screen.queryByText("Recorded days")).toBeNull();
    await screen.findByText("Calmar");
    expect(screen.queryByText("Spread cost")).toBeNull();
  });
});
