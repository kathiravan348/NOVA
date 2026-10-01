import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { handlers, mockInstruments, resetMockRecorder } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
  resetMockRecorder();
});
afterAll(() => server.close());

describe("Live config", () => {
  it("switches recording on and shows its state", async () => {
    renderApp("/live/config");
    const toggle = await screen.findByRole("switch", { name: "Record live prices" });
    expect(screen.getByText("Off")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(await screen.findByText("Recording switched on (demo)")).toBeInTheDocument();
    expect(await screen.findByText("Waiting for market hours")).toBeInTheDocument();
    expect(screen.getByText("All stocks synced with Kite")).toBeInTheDocument();
  });

  it.each([
    ["recording", "Recording"],
    ["no_login", "Log in to Kite first"],
  ])("labels the %s state", async (state, label) => {
    server.use(
      http.get("*/api/v1/broker/recorder", () =>
        HttpResponse.json({
          enabled: true,
          symbols: ["INFY"],
          state,
          jobId: state === "recording" ? "job_002" : null,
          updatedAt: "2026-09-22T04:30:00Z",
        }),
      ),
    );
    renderApp("/live/config");
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.getByText("1 chosen stock")).toBeInTheDocument();
    const link = screen.queryByRole("link", { name: "Open today's recording" });
    expect(Boolean(link)).toBe(state === "recording");
  });

  it("saves the chosen stocks", async () => {
    renderApp("/live/config");
    fireEvent.click(await screen.findByRole("button", { name: "Choose stocks" }));
    const dialog = await screen.findByRole("dialog", { name: "Stocks to record" });
    const table = await within(dialog).findByRole("table", { name: "Stocks to record" });
    fireEvent.change(within(dialog).getByRole("searchbox", { name: "Search stocks" }), {
      target: { value: "INFY" },
    });
    const row = (await within(table).findByText("INFY")).closest("tr")!;
    fireEvent.click(within(row).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save stocks" }));
    expect(await screen.findByText("Stocks saved (demo)")).toBeInTheDocument();
    expect(await screen.findByText("1 chosen stock")).toBeInTheDocument();
  });

  it("picks the top 3000 of 3,899 synced stocks by traded value and saves them", async () => {
    const symbols = Array.from({ length: 3899 }, (_, i) => `S${String(i + 1).padStart(4, "0")}`);
    const base = mockInstruments[0]!;
    // S3899 trades the most; S3898 next; every other stock has no history and ranks by symbol.
    const instruments = [
      { ...base, symbol: "S3899", avgDailyVolume: 1_000_000 },
      { ...base, symbol: "S3898", avgDailyVolume: 500_000 },
    ];
    let saved: string[] = [];
    server.use(
      http.get("*/api/v1/market-data/universe", () =>
        HttpResponse.json(
          symbols.map((symbol) => ({
            symbol,
            name: `Stock ${symbol}`,
            sector: "Banking",
            indices: [],
            synced: true,
            newListing: false,
          })),
        ),
      ),
      http.get("*/api/v1/market-data/instruments", () => HttpResponse.json(instruments)),
      http.put("*/api/v1/broker/recorder", async ({ request }) => {
        saved = ((await request.json()) as { symbols: string[] }).symbols;
        return HttpResponse.json({
          enabled: false,
          symbols: saved,
          state: "off",
          jobId: null,
          updatedAt: "2026-09-22T04:30:00Z",
        });
      }),
    );
    renderApp("/live/config");
    fireEvent.click(await screen.findByRole("button", { name: "Choose stocks" }));
    const dialog = await screen.findByRole("dialog", { name: "Stocks to record" });
    const pick = within(dialog).getByRole("button", { name: "Pick top 3000 by traded value" });
    await waitFor(() => expect(pick).toBeEnabled());
    fireEvent.click(pick);
    fireEvent.click(within(dialog).getByRole("button", { name: "Save stocks" }));
    expect(await screen.findByText("Stocks saved (demo)")).toBeInTheDocument();
    expect(saved).toHaveLength(3000);
    expect(saved.slice(0, 3)).toEqual(["S3899", "S3898", "S0001"]);
    expect(saved.at(-1)).toBe("S2998");
  });

  it("removes a stock from the recorded list, but not the last one", async () => {
    server.use(
      http.get("*/api/v1/broker/recorder", () =>
        HttpResponse.json({
          enabled: false,
          symbols: ["INFY"],
          state: "off",
          jobId: null,
          updatedAt: "2026-09-22T04:30:00Z",
        }),
      ),
    );
    renderApp("/live/config");
    const table = await screen.findByRole("table", { name: "Recorded stocks" });
    const row = (await within(table).findByText("INFY")).closest("tr")!;
    expect(within(row).getByRole("button", { name: "Remove INFY" })).toBeDisabled();
  });

  it("says every stock is recorded when none are chosen", async () => {
    renderApp("/live/config");
    expect(await screen.findByText("Every synced stock is recorded")).toBeInTheDocument();
  });
});
