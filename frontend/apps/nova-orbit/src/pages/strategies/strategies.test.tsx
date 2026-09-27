import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { setupServer } from "msw/node";
import { emptyHandlers, errorHandlers, handlers, mockStrategies } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

describe("Strategies list", () => {
  it("lists every mock strategy with its status", async () => {
    renderApp("/strategies");
    for (const s of mockStrategies) {
      expect((await screen.findAllByRole("link", { name: s.name })).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Archived").length).toBeGreaterThan(0);
  });

  it("shows backtest stats on each card and links the best run", async () => {
    renderApp("/strategies");
    const list = await screen.findByRole("list", { name: "Strategies" });
    const vwap = within(list).getByRole("link", { name: "VWAP Momentum Intraday" }).closest("li")!;
    await within(vwap).findByText("+0.50%");
    expect(within(vwap).getByText("+0.21%")).toBeInTheDocument();
    expect(within(vwap).getByRole("link", { name: "+₹4,994.74" })).toHaveAttribute(
      "href",
      "/backtests/run_001",
    );
    const draft = within(list)
      .getByRole("link", { name: "Delivery Mean Reversion" })
      .closest("li")!;
    expect(within(draft).getByText("No completed runs yet.")).toBeInTheDocument();
  });

  it("filters by status and sorts by best return", async () => {
    renderApp("/strategies");
    const list = await screen.findByRole("list", { name: "Strategies" });
    await within(list).findByText("+0.50%");
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "best" } });
    const names = () =>
      within(list)
        .getAllByRole("heading")
        .map((h) => h.textContent);
    expect(names()[0]).toBe("VWAP Momentum Intraday");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "draft" } });
    expect(names()).toHaveLength(3);
    expect(names()).toEqual(
      expect.arrayContaining([
        "Delivery Mean Reversion",
        "Turtle 55/20 (ranked)",
        "12-1 momentum rotation",
      ]),
    );
  });

  it("opens the detail page from a name", async () => {
    const { router } = renderApp("/strategies");
    fireEvent.click((await screen.findAllByRole("link", { name: "VWAP Momentum Intraday" }))[0]!);
    expect(await screen.findByRole("heading", { level: 2, name: "VWAP Momentum Intraday" }));
    expect(router.state.location.pathname).toBe("/strategies/stg_001");
  });

  it("shows the empty state", async () => {
    server.use(...emptyHandlers);
    renderApp("/strategies");
    expect(await screen.findAllByText("No strategies yet")).not.toHaveLength(0);
  });

  it("shows the error state with a retry", async () => {
    server.use(...errorHandlers);
    renderApp("/strategies");
    expect(
      (await screen.findAllByRole("button", { name: "Try again" }, { timeout: 4000 })).length,
    ).toBeGreaterThan(0);
  });
});

describe("Strategy detail", () => {
  it("shows the latest spec in words and the version history", async () => {
    renderApp("/strategies/stg_001");
    expect(await screen.findByText("Specification · v2")).toBeInTheDocument();
    expect(screen.getByText("Cost averaging")).toBeInTheDocument();
    expect(screen.getAllByText("Off").length).toBeGreaterThan(0);
    expect(screen.getByText("Entry")).toBeInTheDocument();
    expect(screen.getAllByText(/crosses above/).length).toBeGreaterThan(0);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Versions (2)" }));
    const versions = await screen.findByRole("tab", { name: "Versions (2)", selected: true });
    expect(versions).toBeInTheDocument();
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getAllByText("v1").length).toBeGreaterThan(0);
  });

  it("shows backtest stats and a Backtests tab with this strategy's runs", async () => {
    renderApp("/strategies/stg_001");
    expect(await screen.findByText("Backtest stats")).toBeInTheDocument();
    expect(await screen.findByText("+0.50%")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Backtests" }));
    const panel = await screen.findByRole("tabpanel");
    expect(
      (await within(panel).findAllByRole("link", { name: "VWAP Intraday v1 Backtest" })).length,
    ).toBeGreaterThan(0);
    expect(within(panel).queryByText("Delivery Mean Reversion Test")).not.toBeInTheDocument();
  });

  it("asks the server for this strategy's runs only (D32)", async () => {
    const searches: string[] = [];
    server.events.on("request:start", ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname === "/api/v1/backtests") searches.push(url.search);
    });
    renderApp("/strategies/stg_001");
    fireEvent.mouseDown(await screen.findByRole("tab", { name: "Backtests" }));
    await screen.findAllByRole("link", { name: "VWAP Intraday v1 Backtest" });
    expect(searches).toContain("?strategyId=stg_001");
    server.events.removeAllListeners();
  });

  it("shows the D62 settings of a ranked strategy and of a rotation", async () => {
    renderApp("/strategies/stg_004");
    expect(
      await screen.findByText("Trailing 15% · 3 × ATR(20) trailing · After 60 bars"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Up to 10 · ranked by Rate of change %(126), highest first"),
    ).toBeInTheDocument();
    expect(screen.getByText("Volume > 1.5 × Volume SMA(50)")).toBeInTheDocument();
    cleanup();

    renderApp("/strategies/stg_005");
    expect(await screen.findByText("Every month")).toBeInTheDocument();
    expect(screen.getByText("Top 10, kept while in the top 20")).toBeInTheDocument();
    expect(screen.getByText("Rate of change %(231) 21 bars ago × weight 1")).toBeInTheDocument();
    expect(
      screen.getByText("NIFTY 50: Close > SMA(200); otherwise sell everything"),
    ).toBeInTheDocument();
  });

  it("explains python strategies", async () => {
    renderApp("/strategies/stg_002");
    expect(await screen.findByText(/Python strategy/)).toBeInTheDocument();
  });

  it("deletes a strategy after a confirm and goes back to the list (D62)", async () => {
    const { router } = renderApp("/strategies/stg_001");
    fireEvent.click(await screen.findByRole("button", { name: "Delete strategy" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete VWAP Momentum Intraday?" });
    expect(
      await within(dialog).findByText(
        "This cannot be undone. All its versions and 4 backtests are deleted too.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Deleted VWAP Momentum Intraday")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/strategies");
  });

  it("keeps the strategy when the confirm is cancelled or a backtest is running", async () => {
    const { router } = renderApp("/strategies/stg_002");
    fireEvent.click(await screen.findByRole("button", { name: "Delete strategy" }));
    let dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep it" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete strategy" }));
    dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Wait for the running backtest to finish")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/strategies/stg_002");
  });

  it("shows Not found for an unknown id", async () => {
    renderApp("/strategies/nope");
    expect(await screen.findByText("Not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to strategies" })).toBeInTheDocument();
  });
});

describe("Strategy versions (D60)", () => {
  it("opens one version's rules and its backtest record", async () => {
    renderApp("/strategies/stg_001");
    fireEvent.mouseDown(await screen.findByRole("tab", { name: "Versions (2)" }));
    fireEvent.click((await screen.findAllByRole("link", { name: "v1" }))[0]!);
    expect(await screen.findByText("Specification · v1")).toBeInTheDocument();
    expect(screen.getByText("Initial VWAP crossover spec")).toBeInTheDocument();
    expect(await screen.findByText(/2 completed backtests · best return/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Run backtest" })).toHaveAttribute(
      "href",
      "/backtests/new?strategy=stg_001&version=1",
    );
  });

  it("needs two ticks to compare, then shows the changed lines", async () => {
    renderApp("/strategies/stg_001");
    fireEvent.mouseDown(await screen.findByRole("tab", { name: "Versions (2)" }));
    const table = await screen.findByRole("table", { name: "Versions" });
    const compare = screen.getByRole("button", { name: "Compare versions" });
    expect(compare).toBeDisabled();
    const boxes = within(table).getAllByRole("checkbox").slice(-2);
    for (const box of boxes) fireEvent.click(box);
    expect(compare).toBeEnabled();
    fireEvent.click(compare);
    const list = await screen.findByRole("list", { name: "Differences between v1 and v2" });
    const stop = within(list).getByText("Stop-loss").closest("li")!;
    expect(stop).toHaveTextContent("Changed");
    expect(stop).toHaveTextContent("1.5%");
    const same = within(list).getByText("Mode").closest("li")!;
    fireEvent.click(screen.getByRole("switch", { name: "Show changes only" }));
    expect(same).not.toBeInTheDocument();
    expect(within(list).getByText("Entry 2")).toBeInTheDocument();
  });
});
