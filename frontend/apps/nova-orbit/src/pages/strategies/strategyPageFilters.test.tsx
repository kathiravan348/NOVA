import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { setupServer } from "msw/node";
import { handlers, mockStrategies } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

describe("Strategy page filters", () => {
  it("searches and filters the latest spec, shows the count, and restores URL filters", async () => {
    const { router } = renderApp("/strategies");
    await screen.findByRole("list", { name: "Strategies" });
    expect(screen.queryByLabelText("Segment")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "BREAKOUT" } });
    fireEvent.click(screen.getByRole("button", { name: "More filters" }));
    fireEvent.change(screen.getByLabelText("Segment"), { target: { value: "equity_intraday" } });
    await screen.findByText(`1 of ${mockStrategies.length} strategies`);
    expect(
      within(screen.getByRole("list", { name: "Strategies" })).getAllByRole("heading"),
    ).toHaveLength(1);
    expect(screen.getByRole("link", { name: "SMA Breakout Archived" })).toBeInTheDocument();
    const savedPath = `/strategies${router.state.location.search}`;
    expect(savedPath).toContain("q=BREAKOUT");
    expect(savedPath).toContain("segment=equity_intraday");
    cleanup();
    renderApp(savedPath);
    await screen.findByRole("list", { name: "Strategies" });
    expect(screen.getByLabelText("Search")).toHaveValue("BREAKOUT");
    expect(screen.getByLabelText("Segment")).toHaveValue("equity_intraday");
    expect(screen.getByText(`1 of ${mockStrategies.length} strategies`)).toBeInTheDocument();
  });

  it("uses Recorded results for card metrics and completed-run filtering", async () => {
    renderApp("/strategies?dataSource=recorded&tested=tested");
    const list = await screen.findByRole("list", { name: "Strategies" });
    expect(within(list).getAllByRole("heading")).toHaveLength(1);
    const card = within(list).getByRole("link", { name: "VWAP Momentum Intraday" }).closest("li")!;
    expect(within(card).getByText("CAGR")).toBeInTheDocument();
    expect(within(card).getByText("+13.87%")).toBeInTheDocument();
    expect(within(card).queryByText("Worst CAGR")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Results from")).toHaveValue("recorded");
    expect(screen.getByLabelText("Tested")).toHaveValue("tested");
    fireEvent.change(screen.getByLabelText("Tested"), { target: { value: "untested" } });
    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: "VWAP Momentum Intraday" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByText(`${mockStrategies.length - 1} of ${mockStrategies.length} strategies`),
    ).toBeInTheDocument();
  });

  it("restores Name sorting and orders cards A–Z", async () => {
    renderApp("/strategies?sort=name");
    const list = await screen.findByRole("list", { name: "Strategies" });
    expect(
      within(list)
        .getAllByRole("heading")
        .map((heading) => heading.textContent),
    ).toEqual(
      mockStrategies
        .map((strategy) => strategy.name)
        .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
    );
    expect(screen.getByLabelText("Sort by")).toHaveValue("name");
    expect(screen.getByRole("option", { name: "Best net P&L" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Smallest drawdown" })).toBeInTheDocument();
  });

  it("clears all filters from an empty result, including the selected source and sorting", async () => {
    const { router } = renderApp("/strategies?q=unknown&mode=python&dataSource=recorded&sort=name");
    await screen.findByText("No strategies match");
    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[1]!);
    await screen.findByRole("list", { name: "Strategies" });
    expect(router.state.location.search).toBe("");
    expect(screen.getByLabelText("Search")).toHaveValue("");
    expect(screen.getByLabelText("Results from")).toHaveValue("all");
    expect(screen.getByLabelText("Sort by")).toHaveValue("updated");
  });
});
