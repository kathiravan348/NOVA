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
    expect(screen.getByText("Entry")).toBeInTheDocument();
    expect(screen.getAllByText(/crosses above/).length).toBeGreaterThan(0);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Versions (2)" }));
    const versions = await screen.findByRole("tab", { name: "Versions (2)", selected: true });
    expect(versions).toBeInTheDocument();
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getAllByText("v1").length).toBeGreaterThan(0);
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
