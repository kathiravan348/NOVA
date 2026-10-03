import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { handlers, mockBacktestRuns, mockStrategies } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);
const listCalls: string[] = [];
server.events.on("request:start", ({ request }) => {
  if (new URL(request.url).pathname === "/api/v1/backtests") listCalls.push(request.url);
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
  listCalls.length = 0;
});
afterAll(() => server.close());

const table = () => screen.getByRole("table", { name: "Metrics comparison" });
const openPicker = async () => {
  fireEvent.click((await screen.findAllByRole("button", { name: "Choose runs" }))[0]!);
  return screen.getByRole("dialog");
};
const choose = async (dialog: HTMLElement, name: string) => {
  const picker = await within(dialog).findByRole("table", { name: "Runs to compare" });
  const cell = await within(picker).findByText(new RegExp(name));
  fireEvent.click(within(cell.closest("tr")!).getByRole("checkbox"));
};

describe("Compare runs", () => {
  it("starts with compact selection and an empty state without fetching a list", async () => {
    renderApp("/compare");
    expect(await screen.findByText("Choose at least two runs")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Choose runs" })).toHaveLength(2);
    expect(screen.queryByRole("table", { name: "Runs to compare" })).not.toBeInTheDocument();
    expect(listCalls).toEqual([]);
  });

  it("chooses history and recorded runs and applies them only on Compare", async () => {
    const { router } = renderApp("/compare");
    const dialog = await openPicker();
    await choose(dialog, "VWAP Intraday v2 Backtest");
    expect(router.state.location.search).toBe("");
    expect(within(dialog).queryByLabelText("Status")).not.toBeInTheDocument();
    fireEvent.mouseDown(within(dialog).getByRole("tab", { name: "Recorded data" }), {
      button: 0,
      ctrlKey: false,
    });
    await choose(dialog, "VWAP Intraday v1 Backtest");
    expect(within(dialog).getByText("2 of 3 selected")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Compare" }));
    await waitFor(() => expect(router.state.location.search).toBe("?runs=run_002%2Crun_001"));
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
    expect(
      screen.getByRole("button", { name: "Remove VWAP Intraday v1 Backtest" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove VWAP Intraday v2 Backtest" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Runs to compare" })).not.toBeInTheDocument();
    expect(listCalls).toEqual([]);
  });

  it("Cancel keeps the old selection and removing a chip updates the URL", async () => {
    const { router } = renderApp("/compare?runs=run_001,run_002");
    await waitFor(() => expect(table()).toBeInTheDocument());
    const dialog = await openPicker();
    await choose(dialog, "VWAP Intraday v2 Backtest");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(router.state.location.search).toBe("?runs=run_001,run_002");
    fireEvent.click(screen.getByRole("button", { name: "Remove VWAP Intraday v1 Backtest" }));
    await waitFor(() => expect(router.state.location.search).toBe("?runs=run_002"));
  });

  it("filters by Min CAGR without changing the page URL", async () => {
    const { router } = renderApp("/compare");
    const dialog = await openPicker();
    await within(dialog).findAllByText(/VWAP Intraday v2 Backtest/);
    fireEvent.click(within(dialog).getByRole("button", { name: "More filters" }));
    fireEvent.change(within(dialog).getByLabelText("Min CAGR"), { target: { value: "20" } });
    await waitFor(() =>
      expect(listCalls.some((url) => new URL(url).searchParams.get("minCagr") === "20")).toBe(true),
    );
    await waitFor(() =>
      expect(within(dialog).queryAllByText(/VWAP Intraday v2 Backtest/)).toHaveLength(0),
    );
    expect(router.state.location.search).toBe("");
  });

  it("disables a fourth checkbox after selecting three", async () => {
    const run = mockBacktestRuns[0]!;
    const spec = mockStrategies
      .find((strategy) => strategy.id === run.strategyId)!
      .versions.find((version) => version.version === run.strategyVersion)!.spec;
    server.use(
      http.get("*/api/v1/backtests", () =>
        HttpResponse.json({
          items: Array.from({ length: 4 }, (_, index) => ({
            ...run,
            id: `run_pick_${index}`,
            rootId: `run_pick_${index}`,
            name: `Candidate ${index}`,
            dataSource: "history",
            segment: spec.segment,
            timeframe: spec.timeframe,
            summary: null,
          })),
          total: 4,
          nextCursor: null,
        }),
      ),
    );
    renderApp("/compare");
    const dialog = await openPicker();
    for (const index of [0, 1, 2]) await choose(dialog, `Candidate ${index}`);
    const picker = within(dialog).getByRole("table", { name: "Runs to compare" });
    const fourth = within(picker)
      .getByText(/Candidate 3/)
      .closest("tr")!;
    expect(within(fourth).getByRole("checkbox")).toBeDisabled();
    expect(within(dialog).getByText("3 of 3 selected")).toBeInTheDocument();
  });
});
