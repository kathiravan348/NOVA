import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
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

const stat = (label: string) => screen.getByText(label).closest("div.rounded-lg") as HTMLElement;

describe("Relay overview", () => {
  it("counts accounts and sessions from the mocks", async () => {
    renderApp("/");
    await screen.findByText("Accounts");
    expect(within(stat("Accounts")).getByText("3")).toBeInTheDocument();
    expect(within(stat("Active sessions")).getByText("1")).toBeInTheDocument();
    expect(within(stat("Need login")).getByText("1")).toBeInTheDocument();
    expect(within(stat("Disabled")).getByText("1")).toBeInTheDocument();
  });

  it("prompts the daily login for the expired account and shows a demo toast", async () => {
    renderApp("/");
    expect(
      await screen.findByText("Daily login needed for Secondary Algorithmic Account"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Log in to Kite" }));
    expect(await screen.findByText("Demo only")).toBeInTheDocument();
  });

  it("lists the five most recent audit entries", async () => {
    renderApp("/");
    expect(await screen.findByText("Queued backtest VWAP September Dry Run")).toBeInTheDocument();
    const card = screen.getByText("Recent activity").closest("div.rounded-lg") as HTMLElement;
    expect(within(card).getAllByRole("listitem")).toHaveLength(5);
    expect(within(card).getByRole("link", { name: "View audit log" })).toHaveAttribute(
      "href",
      "/audit",
    );
  });
});
