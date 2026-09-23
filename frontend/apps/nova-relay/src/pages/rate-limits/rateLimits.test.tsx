import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { setupServer } from "msw/node";
import { emptyHandlers, handlers } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);
let patches: string[] = [];
server.events.on("request:start", ({ request }) => {
  if (request.method === "PATCH") patches.push(new URL(request.url).pathname);
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
  patches = [];
});
afterAll(() => server.close());

const card = (title: string) =>
  screen.getByRole("heading", { name: title }).closest("div.rounded-lg") as HTMLElement;

describe("Rate limits", () => {
  it("shows every window with own and broker limits, reset time and throttling", async () => {
    renderApp("/rate-limits");
    await screen.findByRole("heading", { name: "Secondary Algorithmic Account" });
    const secondary = card("Secondary Algorithmic Account");
    expect(within(secondary).getByText("3,400 / 4,000 · 85%")).toBeInTheDocument();
    expect(within(secondary).getByText("Throttled 5")).toBeInTheDocument();
    expect(within(secondary).getAllByRole("meter").length).toBe(6);
    expect(within(secondary).getAllByText(/Resets 22 Sep, 00:00 IST/)).toHaveLength(1);
    expect(within(secondary).getAllByText("Rolling window · peak").length).toBe(5);
    const primary = card("Primary Trading Account");
    expect(within(primary).getAllByText("No throttling")).toHaveLength(4);
    expect(within(primary).getByText("120 / 4,000 · 3%")).toBeInTheDocument();
    expect(within(primary).getAllByText("Per second")).toHaveLength(4);
  });

  it("warns about windows above 80% of the own limit", async () => {
    renderApp("/rate-limits");
    const warning = await screen.findByRole("status");
    expect(warning).toHaveTextContent(/above 80% of the NOVA limit/);
    expect(warning).toHaveTextContent("Secondary Algorithmic Account · Orders · per day: 85%");
    expect(screen.getAllByText("Above 80%").length).toBeGreaterThan(0);
  });

  it("edits own limits, rejects values above the broker limit and saves (demo)", async () => {
    renderApp("/rate-limits");
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit Orders limits for Secondary Algorithmic Account",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    const minute = within(dialog).getByLabelText(/per minute/);
    expect(minute).toHaveValue("320");
    fireEvent.change(minute, { target: { value: "401" } });
    expect(within(dialog).getByText("At most the broker limit (400)")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save limits" })).toBeDisabled();
    fireEvent.change(minute, { target: { value: "350" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save limits" }));
    expect(await screen.findByText("Limits saved (demo)")).toBeInTheDocument();
    expect(patches).toEqual(["/api/v1/broker/rate-limits/brk_002/orders"]);
  });

  it("shows the empty state", async () => {
    server.use(...emptyHandlers);
    renderApp("/rate-limits");
    expect(await screen.findByText("No rate-limit data")).toBeInTheDocument();
  });
});
