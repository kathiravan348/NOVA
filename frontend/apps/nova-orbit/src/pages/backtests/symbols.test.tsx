import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { setupServer } from "msw/node";
import { handlers, mockBacktestResults } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";
import { SymbolBreakdown } from "./SymbolBreakdown";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

const rows = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    ...mockBacktestResults[0]!.bySymbol[0]!,
    symbol: index === 0 ? "TCS" : `STOCK${String(index).padStart(2, "0")}`,
    tradeCount: 2,
    winCount: 1,
    winRatePercent: 50,
    netPnlPaise: (index - 15) * 10000,
  }));

describe("symbol result popup", () => {
  it("shows the best and worst five, then all 30 across two pages", () => {
    render(<SymbolBreakdown rows={rows(30)} onShowTrades={vi.fn()} />);
    const best = screen.getByRole("table", { name: "Best 5" });
    const worst = screen.getByRole("table", { name: "Worst 5" });
    expect(within(best).getAllByRole("row")).toHaveLength(6);
    expect(within(worst).getAllByRole("row")).toHaveLength(6);
    expect(within(best).getByText("STOCK29")).toBeInTheDocument();
    expect(within(worst).getByText("TCS")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Results by symbol · 30 symbols · 14 profitable" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View all 30 symbols" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-w-6xl");
    expect(within(dialog).getAllByRole("row")).toHaveLength(26);
    fireEvent.click(within(dialog).getByRole("button", { name: "Next page" }));
    expect(within(dialog).getAllByRole("row")).toHaveLength(6);
    expect(within(dialog).getByLabelText("Jump to page")).toHaveValue(2);
  });

  it("searches and filters losers, then closes and shows the selected stock's trades", () => {
    const onShowTrades = vi.fn();
    render(<SymbolBreakdown rows={rows(30)} onShowTrades={onShowTrades} />);
    fireEvent.click(screen.getByRole("button", { name: "View all 30 symbols" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Search"), { target: { value: "tcs" } });
    fireEvent.change(within(dialog).getByLabelText("Show"), { target: { value: "losers" } });
    expect(within(dialog).getAllByRole("row")).toHaveLength(2);
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Show TCS trades" })[0]!);
    expect(onShowTrades).toHaveBeenCalledWith("TCS");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps one table for six symbols and offers the full popup", () => {
    render(<SymbolBreakdown rows={rows(6)} onShowTrades={vi.fn()} />);
    expect(screen.getByRole("table", { name: "Results by symbol" })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(7);
    expect(screen.queryByRole("heading", { name: "Best 5" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View all 6 symbols" })).toBeInTheDocument();
  });

  it("applies Show trades to the actual run page", async () => {
    renderApp("/backtests/run_001");
    fireEvent.click(await screen.findByRole("button", { name: /^View all \d+ symbols$/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Show TCS trades" })[0]!);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Symbol")).toHaveValue("TCS");
    const table = screen.getByRole("table", { name: "Trades" });
    expect(within(table).getAllByText("TCS").length).toBeGreaterThan(0);
    expect(within(table).queryByText("RELIANCE")).not.toBeInTheDocument();
  });
});
