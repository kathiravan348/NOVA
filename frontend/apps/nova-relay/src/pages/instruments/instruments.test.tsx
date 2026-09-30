import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { handlers, mockDataJobs, mockCoverageLists } from "@nova/mocks";
import { createQueryClient } from "@nova/services";
import { ToastProvider } from "@nova/ui-core";
import { renderApp } from "../../test/renderApp";
import { SyncCard } from "./SyncCard";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

const table = () => screen.findByRole("table", { name: "Stock list" });

describe("Instruments", () => {
  it("keeps the warning but prevents downloading when history cannot be checked", async () => {
    server.use(
      http.get("*/api/v1/market-data/coverage", () =>
        HttpResponse.json(
          { error: { code: "invalid_request", message: "History unavailable" } },
          { status: 400 },
        ),
      ),
    );
    renderApp("/instruments");
    expect(
      await screen.findByText("Could not refresh stored history. Retry before downloading."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download required data" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Retry history check" })).toBeInTheDocument();
  });
  it("warns after sync and reviews exactly the two stocks without starting a download", async () => {
    let started = 0;
    server.use(
      http.post("*/api/v1/data-jobs/:id/start", () => {
        started += 1;
        return HttpResponse.error();
      }),
    );
    const { router } = renderApp("/instruments");
    expect(
      await screen.findByText("2 stocks have no price history: GREENGRID-SM, NOVATECH."),
    ).toBeInTheDocument();
    const download = await screen.findByRole("button", { name: "Download required data" });
    await waitFor(() => expect(download).toBeEnabled());
    fireEvent.click(download);
    await screen.findByText("Plan 1 of 2 · GREENGRID-SM, NOVATECH");
    expect(router.state.location.state.syncPlans).toEqual(
      ["1d", "1m"].map((timeframe) =>
        expect.objectContaining({
          symbols: ["GREENGRID-SM", "NOVATECH"],
          timeframe,
          from: "2020-01-01",
          mode: "skip_existing",
        }),
      ),
    );
    expect(started).toBe(0);
  });

  it("updates remaining stocks and hides the warning automatically when history arrives", async () => {
    let stored: string[] = [];
    server.use(
      http.get("*/api/v1/market-data/coverage", ({ request }) => {
        const timeframe = new URL(request.url).searchParams.get("timeframe");
        const list = mockCoverageLists.find((l) => l.timeframe === timeframe)!;
        return HttpResponse.json({
          ...list,
          rows: list.rows.map((r) =>
            stored.includes(r.symbol) && timeframe === "1m"
              ? { ...r, firstDay: "2026-09-30", lastDay: "2026-09-30", days: 1, status: "complete" }
              : r,
          ),
        });
      }),
    );
    const client = createQueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ToastProvider>
            <SyncCard />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const download = await screen.findByRole("button", { name: "Download required data" });
    await waitFor(() => expect(download).toBeEnabled());
    stored = ["GREENGRID-SM"];
    await client.invalidateQueries({ queryKey: ["market-data"] });
    expect(await screen.findByText("1 stock has no price history: NOVATECH.")).toBeInTheDocument();
    stored.push("NOVATECH");
    await client.invalidateQueries({ queryKey: ["market-data"] });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Download required data" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows no warning when a sync has no new stocks or memberships", async () => {
    const job = mockDataJobs.find((j) => j.type === "instrument_sync")!;
    server.use(
      http.get("*/api/v1/data-jobs", () =>
        HttpResponse.json({
          items: [{ ...job, syncResult: { newSymbols: [], newIndexMembers: [] } }],
          total: 1,
          nextCursor: null,
        }),
      ),
    );
    renderApp("/instruments");
    await screen.findByText(/Last synced/);
    expect(
      screen.queryByRole("button", { name: "Download required data" }),
    ).not.toBeInTheDocument();
  });

  it("deduplicates memberships and shows five names then the remaining count", async () => {
    const job = mockDataJobs.find((j) => j.type === "instrument_sync")!;
    const symbols = ["NEW1", "NEW2", "NEW3", "NEW4", "NEW5", "NEW6", "NEW7"];
    server.use(
      http.get("*/api/v1/data-jobs", () =>
        HttpResponse.json({
          items: [
            {
              ...job,
              syncResult: {
                newSymbols: symbols,
                newIndexMembers: [
                  { symbol: "NEW1", index: "NIFTY 50" },
                  { symbol: "NEW1", index: "NIFTY IT" },
                ],
              },
            },
          ],
          total: 1,
          nextCursor: null,
        }),
      ),
    );
    renderApp("/instruments");
    expect(
      await screen.findByText(
        "7 stocks have no price history: NEW1, NEW2, NEW3, NEW4, NEW5 and 2 more.",
      ),
    ).toBeInTheDocument();
  });
  it("lists the stocks with their Kite status", async () => {
    renderApp("/instruments");
    const list = await table();
    expect(await within(list).findByText("INFY")).toBeInTheDocument();
    expect(within(list).getAllByText("Synced").length).toBeGreaterThan(0);
  });

  it("checks the symbol before adding a stock", async () => {
    renderApp("/instruments");
    await table();
    fireEvent.click(screen.getByRole("button", { name: "Add stock" }));
    const dialog = await screen.findByRole("dialog", { name: "Add stock" });
    fireEvent.change(within(dialog).getByLabelText(/Symbol/), { target: { value: "BAD SYMBOL" } });
    fireEvent.change(within(dialog).getByLabelText(/Name/), { target: { value: "Bad" } });
    fireEvent.change(within(dialog).getByLabelText(/Sector/), { target: { value: "Energy" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add stock" }));
    expect(
      await within(dialog).findByText("1–20 capital letters, digits, & or -"),
    ).toBeInTheDocument();
  });

  it("adds a stock, or shows the server's duplicate message", async () => {
    renderApp("/instruments");
    await table();
    fireEvent.click(screen.getByRole("button", { name: "Add stock" }));
    const dialog = await screen.findByRole("dialog", { name: "Add stock" });
    fireEvent.change(within(dialog).getByLabelText(/Symbol/), { target: { value: "infy" } });
    fireEvent.change(within(dialog).getByLabelText(/Name/), { target: { value: "Infosys" } });
    fireEvent.change(within(dialog).getByLabelText(/Sector/), { target: { value: "IT" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add stock" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "INFY is already in the stock list",
    );
    fireEvent.change(within(dialog).getByLabelText(/Symbol/), { target: { value: "M&M" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add stock" }));
    expect(await screen.findByText("Stock added (demo)")).toBeInTheDocument();
  });

  it("edits a stock with its symbol read-only", async () => {
    renderApp("/instruments");
    await within(await table()).findByText("INFY");
    fireEvent.click(screen.getAllByRole("button", { name: "Edit INFY" })[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Edit INFY" });
    expect(within(dialog).getByLabelText(/Symbol/)).toHaveAttribute("readonly");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Stock updated (demo)")).toBeInTheDocument();
  });

  it("asks before removing a stock", async () => {
    renderApp("/instruments");
    await within(await table()).findByText("INFY");
    fireEvent.click(screen.getAllByRole("button", { name: "Remove INFY" })[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Remove INFY from the list?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    expect(await screen.findByText("Stock removed (demo)")).toBeInTheDocument();
  });

  it("shows the last sync and queues a new one", async () => {
    renderApp("/instruments");
    expect(
      await screen.findByText("26 stocks synced; 2 new listing(s): GREENGRID-SM, NOVATECH"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Last synced/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sync with Kite" }));
    expect(await screen.findByText("Sync with Kite queued (demo)")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Syncing…" })).toBeDisabled();
  });

  it("shows why a sync failed", async () => {
    server.use(
      http.post("*/api/v1/market-data/instruments/sync", () =>
        HttpResponse.json(
          { error: { code: "invalid_request", message: "A sync is already waiting or running" } },
          { status: 400 },
        ),
      ),
    );
    renderApp("/instruments");
    fireEvent.click(await screen.findByRole("button", { name: "Sync with Kite" }));
    expect(await screen.findByText("A sync is already waiting or running")).toBeInTheDocument();
  });

  it("filters by index", async () => {
    renderApp("/instruments");
    const list = await table();
    await within(list).findByText("INFY");
    const select = await screen.findByLabelText("Index");
    await within(select).findByRole("option", { name: /^NIFTY BANK \(/ });
    fireEvent.change(select, { target: { value: "NIFTY BANK" } });
    expect(await within(await table()).findByText("HDFCBANK")).toBeInTheDocument();
    expect(within(await table()).queryByText("INFY")).not.toBeInTheDocument();
  });

  it("lists new listings and marks one as seen", async () => {
    renderApp("/instruments");
    const tab = await screen.findByRole("tab", { name: "New listings (2)" });
    fireEvent.mouseDown(tab);
    fireEvent.click(tab);
    const list = await screen.findByRole("table", { name: "New listings" });
    expect(within(list).getByText("NOVATECH")).toBeInTheDocument();
    expect(within(list).getAllByText("New")).toHaveLength(2);
    fireEvent.click(within(list).getByRole("button", { name: "Mark NOVATECH as seen" }));
    expect(await screen.findByText("NOVATECH marked as seen (demo)")).toBeInTheDocument();
  });

  it("offers every known index when editing", async () => {
    renderApp("/instruments");
    const list = await table();
    fireEvent.click(await within(list).findByRole("button", { name: "Edit INFY" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit INFY" });
    expect(
      await within(dialog).findByRole("checkbox", { name: "NIFTY MIDCAP 100" }),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByRole("checkbox")).toHaveLength(19);
  });
});
