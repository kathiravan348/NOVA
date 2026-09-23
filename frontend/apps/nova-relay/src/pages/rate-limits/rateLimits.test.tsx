import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { setupServer } from "msw/node";
import { emptyHandlers, handlers } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

const card = (title: string) => screen.getByText(title).closest("div.rounded-lg") as HTMLElement;

describe("Rate limits", () => {
  it("shows one card per account with meters and throttling", async () => {
    renderApp("/rate-limits");
    await screen.findByText("Secondary Algorithmic Account");
    const secondary = card("Secondary Algorithmic Account");
    expect(within(secondary).getByText("3,400 / 4,000")).toBeInTheDocument();
    expect(within(secondary).getByText("Throttled 5")).toBeInTheDocument();
    expect(within(secondary).getAllByRole("meter").length).toBeGreaterThan(0);
    const primary = card("Primary Trading Account");
    expect(within(primary).getAllByText("No throttling")).toHaveLength(4);
    expect(within(primary).getByText("120 / 4,000")).toBeInTheDocument();
    expect(within(primary).getAllByText("Per second")).toHaveLength(4);
    expect(within(primary).getByText("Per minute")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    server.use(...emptyHandlers);
    renderApp("/rate-limits");
    expect(await screen.findByText("No rate-limit data")).toBeInTheDocument();
  });
});
