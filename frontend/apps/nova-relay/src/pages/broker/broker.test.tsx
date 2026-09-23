import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { setupServer } from "msw/node";
import { emptyHandlers, errorHandlers, handlers, mockBrokerProfiles } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

describe("Broker page", () => {
  it("shows the profile with only the last 4 key characters", async () => {
    renderApp("/broker");
    expect(await screen.findByText("Kite Connect v3")).toBeInTheDocument();
    expect(screen.getByText("•••• k7Q2")).toBeInTheDocument();
    expect(screen.getByText("Not registered (needed from Phase 3)")).toBeInTheDocument();
    expect(screen.getByText(/valid until 06:00 IST/)).toBeInTheDocument();
  });

  it("opens every useful link from the data in a new tab", async () => {
    renderApp("/broker");
    const card = (await screen.findByText("Useful links")).closest("div.rounded-lg") as HTMLElement;
    const links = within(card).getAllByRole("link");
    expect(links).toHaveLength(mockBrokerProfiles[0]!.links.length);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
    }
  });

  it("shows empty and error states", async () => {
    server.use(...emptyHandlers);
    renderApp("/broker");
    expect(await screen.findByText("No broker profile")).toBeInTheDocument();
    cleanup();
    server.resetHandlers();
    server.use(...errorHandlers);
    renderApp("/broker");
    expect(
      (await screen.findAllByRole("button", { name: "Try again" }, { timeout: 4000 })).length,
    ).toBeGreaterThan(0);
  });
});
