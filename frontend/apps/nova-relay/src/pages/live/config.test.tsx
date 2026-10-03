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
    fireEvent.click(screen.getByRole("button", { name: "Choose indices" }));
    const dialog = await screen.findByRole("dialog", { name: "Indices to record" });
    const choices = await within(dialog).findAllByRole("checkbox");
    fireEvent.click(choices[0]!);
    expect(within(dialog).getByText(/every stock synced with Kite/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save indices" }));
    expect(await screen.findByText("Indices saved (demo)")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(await screen.findByText("Recording switched on (demo)")).toBeInTheDocument();
    expect(await screen.findByText("Waiting for market hours")).toBeInTheDocument();
    expect(screen.getByText("All stocks synced with Kite + 1 index")).toBeInTheDocument();
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
          indices: [],
          state,
          jobId: state === "recording" ? "job_002" : null,
          updatedAt: "2026-09-22T04:30:00Z",
        }),
      ),
    );
    renderApp("/live/config");
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.getByText("1 chosen stock + no indices")).toBeInTheDocument();
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
    expect(await screen.findByText("1 chosen stock + no indices")).toBeInTheDocument();
  });

  it("saves 19 indices, then picks and saves the top 2981 stocks in the remaining slots", async () => {
    const symbols = Array.from({ length: 3899 }, (_, i) => `S${String(i + 1).padStart(4, "0")}`);
    const base = mockInstruments[0]!;
    // S3899 trades the most; S3898 next; every other stock has no history and ranks by symbol.
    const instruments = [
      { ...base, symbol: "S3899", avgDailyVolume: 1_000_000 },
      { ...base, symbol: "S3898", avgDailyVolume: 500_000 },
    ];
    let saved: string[] = [];
    let indices: string[] = [];
    const indexList = Array.from({ length: 19 }, (_, i) => ({
      name: `INDEX ${i}`,
      kiteSymbol: `INDEX ${i}`,
      members: 100,
      updatedAt: null,
    }));
    server.use(
      http.get("*/api/v1/market-data/indices", () => HttpResponse.json(indexList)),
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
        const body = (await request.json()) as { symbols: string[]; indices?: string[] };
        saved = body.symbols;
        indices = body.indices ?? indices;
        return HttpResponse.json({
          enabled: false,
          symbols: saved,
          indices,
          state: "off",
          jobId: null,
          updatedAt: "2026-09-22T04:30:00Z",
        });
      }),
    );
    renderApp("/live/config");
    fireEvent.click(await screen.findByRole("button", { name: "Choose indices" }));
    const indexDialog = await screen.findByRole("dialog", { name: "Indices to record" });
    await within(indexDialog).findAllByRole("checkbox");
    fireEvent.click(within(indexDialog).getByRole("button", { name: "Select all" }));
    fireEvent.click(within(indexDialog).getByRole("button", { name: "Save indices" }));
    expect(await screen.findByText("Indices saved (demo)")).toBeInTheDocument();
    expect(indices).toEqual(indexList.map((index) => index.name));
    fireEvent.click(await screen.findByRole("button", { name: "Choose stocks" }));
    const dialog = await screen.findByRole("dialog", { name: "Stocks to record" });
    const pick = within(dialog).getByRole("button", { name: "Pick top 2981 by traded value" });
    await waitFor(() => expect(pick).toBeEnabled());
    fireEvent.click(pick);
    fireEvent.click(within(dialog).getByRole("button", { name: "Save stocks" }));
    expect(await screen.findByText("Stocks saved (demo)")).toBeInTheDocument();
    expect(saved).toHaveLength(2981);
    expect(saved.slice(0, 3)).toEqual(["S3899", "S3898", "S0001"]);
    expect(saved.at(-1)).toBe("S2979");
    expect(screen.getByText("2,981 chosen stocks + 19 indices")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Choose indices" }));
    expect(
      await screen.findByText("Stocks + indices: 2,981 + 19 = 3,000 of 3,000"),
    ).toBeInTheDocument();
  });

  it("warns about stocks without daily bars and opens a prefilled 1d download", async () => {
    const { router } = renderApp("/live/config");
    fireEvent.click(await screen.findByRole("button", { name: "Choose stocks" }));
    const dialog = await screen.findByRole("dialog", { name: "Stocks to record" });
    const ranked = new Set(mockInstruments.map((i) => i.symbol));
    expect(await within(dialog).findByText(/stocks have no daily bars/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Download daily bars" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/data-jobs/new"));
    const { syncPlans } = router.state.location.state as {
      syncPlans: { symbols: string[]; timeframe: string; from: string; mode: string }[];
    };
    expect(syncPlans.length).toBeGreaterThan(0);
    for (const plan of syncPlans) {
      expect(plan).toEqual(
        expect.objectContaining({ timeframe: "1d", from: "2020-01-01", mode: "skip_existing" }),
      );
      expect(plan.symbols.some((s) => ranked.has(s))).toBe(false);
    }
    expect(screen.queryByRole("dialog", { name: "Stocks to record" })).not.toBeInTheDocument();
  });

  it("splits a large unranked list into plans of at most 200 stocks", async () => {
    const symbols = Array.from({ length: 450 }, (_, i) => `U${String(i).padStart(3, "0")}`);
    server.use(
      http.get("*/api/v1/market-data/universe", () =>
        HttpResponse.json(
          symbols.map((symbol) => ({
            symbol,
            name: symbol,
            sector: "Banking",
            indices: [],
            synced: true,
            newListing: false,
          })),
        ),
      ),
      http.get("*/api/v1/market-data/instruments", () => HttpResponse.json([])),
    );
    const { router } = renderApp("/live/config");
    fireEvent.click(await screen.findByRole("button", { name: "Choose stocks" }));
    const dialog = await screen.findByRole("dialog", { name: "Stocks to record" });
    expect(await within(dialog).findByText(/450 stocks have no daily bars/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Download daily bars" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/data-jobs/new"));
    const { syncPlans } = router.state.location.state as { syncPlans: { symbols: string[] }[] };
    expect(syncPlans.map((p) => p.symbols.length)).toEqual([200, 200, 50]);
  });

  it("shows no unranked warning when every synced stock has daily bars", async () => {
    const base = mockInstruments[0]!;
    server.use(
      http.get("*/api/v1/market-data/universe", () =>
        HttpResponse.json([
          {
            symbol: "INFY",
            name: "Infosys",
            sector: "IT",
            indices: [],
            synced: true,
            newListing: false,
          },
        ]),
      ),
      http.get("*/api/v1/market-data/instruments", () =>
        HttpResponse.json([{ ...base, symbol: "INFY" }]),
      ),
    );
    renderApp("/live/config");
    fireEvent.click(await screen.findByRole("button", { name: "Choose stocks" }));
    const dialog = await screen.findByRole("dialog", { name: "Stocks to record" });
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Pick top 3000 by traded value" }),
      ).toBeEnabled(),
    );
    expect(within(dialog).queryByText(/no daily bars/)).not.toBeInTheDocument();
  });

  it("disables Pick top and shows the error when instruments fail", async () => {
    server.use(
      http.get("*/api/v1/market-data/instruments", () =>
        HttpResponse.json(
          { error: { code: "invalid_request", message: "Atlas is down" } },
          { status: 400 },
        ),
      ),
    );
    renderApp("/live/config");
    fireEvent.click(await screen.findByRole("button", { name: "Choose stocks" }));
    const dialog = await screen.findByRole("dialog", { name: "Stocks to record" });
    expect(await within(dialog).findByText("Atlas is down")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Pick top 3000 by traded value" }),
    ).toBeDisabled();
  });

  it("removes a stock from the recorded list, but not the last one", async () => {
    server.use(
      http.get("*/api/v1/broker/recorder", () =>
        HttpResponse.json({
          enabled: false,
          symbols: ["INFY"],
          indices: [],
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

  it("disables saving when adding an index to 3000 chosen stocks", async () => {
    server.use(
      http.get("*/api/v1/broker/recorder", () =>
        HttpResponse.json({
          enabled: false,
          symbols: Array.from({ length: 3000 }, (_, i) => `S${i}`),
          indices: [],
          state: "off",
          jobId: null,
          updatedAt: "2026-09-22T04:30:00Z",
        }),
      ),
    );
    renderApp("/live/config");
    fireEvent.click(await screen.findByRole("button", { name: "Choose indices" }));
    const dialog = await screen.findByRole("dialog", { name: "Indices to record" });
    fireEvent.click((await within(dialog).findAllByRole("checkbox"))[0]!);
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Kite streams at most 3000 instruments: remove stocks or indices",
    );
    expect(within(dialog).getByRole("button", { name: "Save indices" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Clear" }));
    expect(within(dialog).getByRole("button", { name: "Save indices" })).toBeEnabled();
  });
});
