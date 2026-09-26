import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { setupServer } from "msw/node";
import { handlers, mockBacktestRuns } from "@nova/mocks";
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
    for (const run of mockBacktestRuns) {
      expect((await screen.findAllByRole("link", { name: run.name })).length).toBeGreaterThan(0);
    }
    for (const label of ["Completed", "Running", "Queued", "Failed"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
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

  it("explains unfinished and failed runs", async () => {
    renderApp("/backtests/run_003");
    expect(await screen.findByText("This run hasn't finished")).toBeInTheDocument();
    cleanup();
    renderApp("/backtests/run_005");
    expect(
      await screen.findByText("Data missing for symbol SBIN on 2026-04-14"),
    ).toBeInTheDocument();
  });

  it("shows Not found for an unknown run", async () => {
    renderApp("/backtests/nope");
    expect(await screen.findByText("Not found")).toBeInTheDocument();
  });
});

describe("New backtest form", () => {
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
    renderApp("/backtests/new?strategy=stg_001");
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

  it("can test a whole index instead of chosen symbols", async () => {
    renderApp("/backtests/new?strategy=stg_001");
    fireEvent.change(await screen.findByLabelText("Test on"), { target: { value: "index" } });
    expect(screen.queryByLabelText("Search")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Queue backtest" }));
    expect(await screen.findByText("Backtest queued (demo)")).toBeInTheDocument();
  });
});
