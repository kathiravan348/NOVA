import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { handlers } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";
import { isMarketOpen, isStale } from "../../lib/live";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

describe("market hours", () => {
  it("is open on weekdays from 09:15 to 15:30 IST only", () => {
    expect(isMarketOpen(new Date("2026-09-30T04:00:00Z"))).toBe(true); // 09:30 IST Wednesday
    expect(isMarketOpen(new Date("2026-09-30T03:30:00Z"))).toBe(false); // 09:00 IST
    expect(isMarketOpen(new Date("2026-09-30T10:00:00Z"))).toBe(false); // 15:30 IST
    expect(isMarketOpen(new Date("2026-09-27T04:00:00Z"))).toBe(false); // Sunday
  });

  it("marks a card stale after 10 seconds without a tick, only in market hours", () => {
    const open = new Date("2026-09-30T04:00:30Z");
    expect(isStale("2026-09-30T04:00:25Z", open)).toBe(false);
    expect(isStale("2026-09-30T04:00:10Z", open)).toBe(true);
    expect(isStale(null, open)).toBe(true);
    expect(isStale(null, new Date("2026-09-30T12:00:00Z"))).toBe(false);
  });
});

describe("Live monitor", () => {
  it("shows a card per stock with price, change and seconds with a tick", async () => {
    renderApp("/live/monitor");
    fireEvent.change(await screen.findByLabelText("Stocks"), { target: { value: "NIFTY 50" } });
    const card = (await screen.findByRole("heading", { name: "RELIANCE" })).closest(
      "div",
    )!.parentElement!;
    expect(await within(card).findByText("14,900 / 15,301")).toBeInTheDocument();
    expect(within(card).getByText("+1.20%")).toBeInTheDocument();
  });

  it("is in the sidebar under Live, and hidden from the agent account", async () => {
    renderApp("/live/monitor");
    expect(await screen.findByRole("link", { name: "Monitor" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Recorded data" })).toBeInTheDocument();
  });

  it("shows an error with retry when the snapshot fails", async () => {
    server.use(
      http.get("*/api/v1/live/snapshot", () =>
        HttpResponse.json({ error: { code: "invalid_request", message: "Down" } }, { status: 400 }),
      ),
    );
    renderApp("/live/monitor");
    fireEvent.change(await screen.findByLabelText("Stocks"), { target: { value: "NIFTY 50" } });
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("Recorded data", () => {
  it("lists stocks and opens day cards with both kinds of missing seconds", async () => {
    renderApp("/live/recorded");
    fireEvent.click((await screen.findAllByRole("link", { name: "TCS" }))[0]!);
    await waitFor(() =>
      expect(screen.getAllByText("Missing seconds (recorder)").length).toBeGreaterThan(1),
    );
    expect(screen.getAllByText("No trade seconds").length).toBeGreaterThan(1);
    expect(screen.getByText("100 missed by the recorder")).toBeInTheDocument();
  });

  it("says so when nothing is recorded for a stock", async () => {
    renderApp("/live/recorded/DMART");
    expect(await screen.findByText("Nothing recorded for this stock yet")).toBeInTheDocument();
  });
});
