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

describe("Kite check card", () => {
  it("shows the latest check's percents, Passed, and lists the days", async () => {
    renderApp("/live/recorded");
    expect(await screen.findByRole("heading", { name: "Kite check" })).toBeInTheDocument();
    expect(await screen.findByText("Fri 2 Oct")).toBeInTheDocument();
    expect(screen.getByText("98.9 %")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getByText("0.4 s")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show days" }));
    const days = screen.getByRole("list", { name: "Kite check days" });
    expect(within(days).getAllByRole("listitem")).toHaveLength(3);
    expect(within(days).getAllByText("Check")).toHaveLength(2);
  });

  it("shows Check and the warning text for a day with warnings", async () => {
    server.use(
      http.get("*/api/v1/live/checks", () =>
        HttpResponse.json([
          {
            day: "2026-10-01",
            stocksChecked: 1,
            stocksSkipped: 0,
            minutes: 359,
            closeMatchPercent: 98.6,
            rangeOkPercent: 100,
            volumeMatchPercent: 97.8,
            clockOffsetSeconds: 16.2,
            warnings: ["Receive times are 16 s off exchange times: sync the PC clock"],
            checkedAt: "2026-10-01T10:31:00Z",
            stocks: [],
          },
        ]),
      ),
    );
    renderApp("/live/recorded");
    expect(
      await screen.findByText("Receive times are 16 s off exchange times: sync the PC clock"),
    ).toBeInTheDocument();
    expect(screen.getByText("Check")).toBeInTheDocument();
  });

  it("says when no check exists yet", async () => {
    server.use(http.get("*/api/v1/live/checks", () => HttpResponse.json([])));
    renderApp("/live/recorded");
    expect(
      await screen.findByText("No check yet — the first runs after 16:00 IST on a recorded day."),
    ).toBeInTheDocument();
  });
});

describe("Recorded data", () => {
  it("shows a card per stock (no table) with days stored, gap days, ticks and size", async () => {
    renderApp("/live/recorded");
    const card = await screen.findByRole("link", { name: "Open TCS" });
    expect(await within(card).findByText("10 days · 14 Sep – 29 Sep 2026")).toBeInTheDocument();
    expect(within(card).getByText("Gap days: Yes (2)")).toBeInTheDocument();
    expect(within(card).getByText("26.5L")).toBeInTheDocument();
    expect(within(card).getByText("~351.0 MB")).toBeInTheDocument();
    const reliance = screen.getByRole("link", { name: "Open RELIANCE" });
    expect(await within(reliance).findByText("Gap days: No")).toBeInTheDocument();
    expect(screen.getByText("Updated after each market close.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("says None yet for a stock never stored", async () => {
    renderApp("/live/recorded");
    fireEvent.change(await screen.findByRole("searchbox", { name: "Search stocks" }), {
      target: { value: "DMART" },
    });
    const card = await screen.findByRole("link", { name: "Open DMART" });
    expect(await within(card).findByText("None yet")).toBeInTheDocument();
    expect(within(card).queryByText(/Gap days/)).toBeNull();
  });

  it("shows only the recorder's stocks, and search narrows them", async () => {
    server.use(
      http.get("*/api/v1/broker/recorder", () =>
        HttpResponse.json({
          enabled: true,
          symbols: ["TCS", "INFY", "RELIANCE"],
          indices: [],
          state: "waiting",
          jobId: null,
          updatedAt: "2026-09-22T04:30:00Z",
        }),
      ),
    );
    renderApp("/live/recorded");
    await screen.findByRole("link", { name: "Open TCS" });
    const names = () => screen.getAllByRole("link", { name: /^Open / }).map((l) => l.ariaLabel);
    expect(names()).toEqual(["Open INFY", "Open RELIANCE", "Open TCS"]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search stocks" }), {
      target: { value: "tc" },
    });
    await waitFor(() => expect(names()).toEqual(["Open TCS"]));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search stocks" }), {
      target: { value: "zzzz" },
    });
    expect(await screen.findByText("No stock matches “zzzz”")).toBeInTheDocument();
  });

  it("shows an error with retry when the history fails", async () => {
    server.use(
      http.get("*/api/v1/live/stocks", () =>
        HttpResponse.json({ error: { code: "invalid_request", message: "Down" } }, { status: 400 }),
      ),
    );
    renderApp("/live/recorded");
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("opens day cards with both kinds of missing seconds from a card", async () => {
    renderApp("/live/recorded");
    fireEvent.click(await screen.findByRole("link", { name: "Open TCS" }));
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
