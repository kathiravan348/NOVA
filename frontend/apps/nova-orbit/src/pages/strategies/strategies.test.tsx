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
    expect(within(vwap).getByText("+0.46%")).toBeInTheDocument();
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
    expect(names()).toEqual(["Delivery Mean Reversion"]);
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
    expect(screen.getByText("Off")).toBeInTheDocument();
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

  it("explains python strategies", async () => {
    renderApp("/strategies/stg_002");
    expect(await screen.findByText(/Python strategy/)).toBeInTheDocument();
  });

  it("shows Not found for an unknown id", async () => {
    renderApp("/strategies/nope");
    expect(await screen.findByText("Not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to strategies" })).toBeInTheDocument();
  });
});
