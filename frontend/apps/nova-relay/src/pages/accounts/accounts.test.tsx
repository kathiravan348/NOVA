import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { setupServer } from "msw/node";
import { emptyHandlers, handlers, mockBrokerAccounts } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

describe("Broker accounts", () => {
  it("lists every account with its session status", async () => {
    renderApp("/accounts");
    for (const a of mockBrokerAccounts) {
      expect((await screen.findAllByRole("link", { name: a.label })).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Expired").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not logged in").length).toBeGreaterThan(0);
  });

  it("shows the empty state", async () => {
    server.use(...emptyHandlers);
    renderApp("/accounts");
    expect((await screen.findAllByText("No broker accounts")).length).toBeGreaterThan(0);
  });

  it("shows an active account without a login prompt", async () => {
    renderApp("/accounts/brk_001");
    expect(await screen.findByRole("heading", { name: "Primary Trading Account" }));
    expect(screen.getByText("Kite session")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log in to Kite" })).not.toBeInTheDocument();
  });

  it("shows the time left on an active session and the account's limits", async () => {
    renderApp("/accounts/brk_001");
    expect(await screen.findByText("18 h 00 m")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Rate limits" })).toBeInTheDocument();
    expect(screen.getByText("120 / 4,000 · 3%")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Edit limits on the rate limits page" }),
    ).toHaveAttribute("href", "/rate-limits");
  });

  it("prompts login on an expired account", async () => {
    renderApp("/accounts/brk_002");
    expect(await screen.findByRole("button", { name: "Log in to Kite" })).toBeInTheDocument();
  });

  it("shows Not found for an unknown account", async () => {
    renderApp("/accounts/nope");
    expect(await screen.findByText("Not found")).toBeInTheDocument();
  });
});
