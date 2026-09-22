import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { setupServer } from "msw/node";
import { handlers } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

const table = () => screen.getByRole("table", { name: "Metrics comparison" });

describe("Compare runs", () => {
  it("starts with the picker and an empty state", async () => {
    renderApp("/compare");
    expect(await screen.findByText("Runs to compare")).toBeInTheDocument();
    expect(screen.getByText("Choose at least two runs")).toBeInTheDocument();
    // Only completed runs are offered.
    expect(screen.getByRole("checkbox", { name: /VWAP Intraday v1 Backtest/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /September Dry Run/ })).not.toBeInTheDocument();
  });

  it("compares two runs chosen in the picker and writes them to the URL", async () => {
    const { router } = renderApp("/compare");
    fireEvent.click(await screen.findByRole("checkbox", { name: /VWAP Intraday v1 Backtest/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /VWAP Intraday v2 Backtest/ }));
    await waitFor(() => expect(router.state.location.search).toBe("?runs=run_001%2Crun_002"));
    await waitFor(() => expect(table()).toBeInTheDocument());
    expect(within(table()).getByText("VWAP Intraday v1 Backtest")).toBeInTheDocument();
    expect(within(table()).getByText("VWAP Intraday v2 Backtest")).toBeInTheDocument();
    expect(within(table()).getAllByText("Best").length).toBeGreaterThan(0);
  });

  it("renders straight from the URL and skips runs that are not completed", async () => {
    renderApp("/compare?runs=run_001,run_002,run_003");
    await waitFor(() => expect(table()).toBeInTheDocument());
    expect(screen.getByText(/Skipped \(not a completed run\): run_003/)).toBeInTheDocument();
    expect(screen.getAllByText(/equity/).length).toBeGreaterThan(0);
  });
});
