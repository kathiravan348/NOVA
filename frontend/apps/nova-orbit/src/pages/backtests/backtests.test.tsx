import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { handlers, mockBacktestRuns } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
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
  });
});

describe("Backtest result", () => {
  it("shows metrics, the equity curve and trades for a completed run", async () => {
    renderApp("/backtests/run_001");
    expect(await screen.findByRole("heading", { name: "VWAP Intraday v1 Backtest" }));
    expect(await screen.findByText("Net P&L")).toBeInTheDocument();
    expect(screen.getAllByText(/\+₹4,994\.74/).length).toBeGreaterThan(0);
    expect(await screen.findByText(/From 1 Jun 2026 to .*, equity/)).toBeInTheDocument();
    expect((await screen.findAllByText("RELIANCE")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("TCS").length).toBeGreaterThan(0);
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
    expect(await screen.findByText("Backtest queued (demo)")).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe("/backtests"));
  });
});
