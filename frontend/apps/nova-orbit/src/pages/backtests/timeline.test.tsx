import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { handlers, mockBacktestRuns, mockStrategies } from "@nova/mocks";
import type { BacktestRun, LedgerEvent } from "@nova/contracts";
import { renderApp } from "../../test/renderApp";
import { TimelineDialog } from "./TimelineDialog";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

async function openTimeline(runId = "run_001") {
  renderApp(`/backtests/${runId}`);
  fireEvent.click(await screen.findByRole("button", { name: "Timeline" }));
  const dialog = screen.getByRole("dialog");
  await within(dialog).findByRole("list", { name: "Trades" });
  return dialog;
}

function renderDialog(run: BacktestRun) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TimelineDialog run={run} onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );
  return screen.getByRole("dialog");
}

const items = (dialog: HTMLElement) =>
  within(within(dialog).getByRole("list", { name: "Trades" })).getAllByRole("listitem");

describe("Backtest Timeline", () => {
  it("lists every trade oldest first with seconds, held time, cash after and the end line", async () => {
    const dialog = await openTimeline();
    const rows = items(dialog);
    expect(rows).toHaveLength(8);
    expect(rows.map((row) => row.dataset["tone"]).slice(0, 2)).toEqual(["buy", "profit"]);
    expect(within(rows[0]!).getByText("Buy")).toBeInTheDocument();
    expect(within(rows[0]!).getAllByText("09:30:00").length).toBeGreaterThan(0);
    expect(within(rows[0]!).getByText("₹8,55,000.00")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Sell")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("1 h 30 min")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("₹10,02,417.25")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("—")).toBeInTheDocument();
    expect(within(dialog).getByText("End of timeline · 8 trades")).toBeInTheDocument();
    expect(within(dialog).queryByRole("switch")).not.toBeInTheDocument();
  });

  it("shows minutes for a 5m history run", async () => {
    const dialog = await openTimeline("run_002");
    await waitFor(() =>
      expect(within(items(dialog)[0]!).getAllByText("09:30").length).toBeGreaterThan(0),
    );
  });

  it("filters by stock and dates", async () => {
    const dialog = await openTimeline();
    fireEvent.change(within(dialog).getByLabelText("Stock"), { target: { value: "reliance" } });
    await waitFor(() => expect(items(dialog)).toHaveLength(4));
    fireEvent.change(within(dialog).getByLabelText("From"), { target: { value: "2026-06-03" } });
    await waitFor(() => expect(items(dialog)).toHaveLength(2));
    fireEvent.change(within(dialog).getByLabelText("To"), { target: { value: "2026-06-11" } });
    await within(dialog).findByText("No trades for these filters");
  });

  it("hides Timeline on a summary-only version", async () => {
    renderApp("/backtests/run_006");
    await screen.findByText(/Older version: only the summary is kept/);
    expect(screen.queryByRole("button", { name: "Timeline" })).not.toBeInTheDocument();
  });

  it("retries a timeline error", async () => {
    server.use(
      http.get("*/api/v1/backtests/:id/timeline", () =>
        HttpResponse.json(
          { error: { code: "internal", message: "Timeline unavailable" } },
          { status: 500 },
        ),
      ),
    );
    renderApp("/backtests/run_001");
    fireEvent.click(await screen.findByRole("button", { name: "Timeline" }));
    const dialog = screen.getByRole("dialog");
    await within(dialog).findAllByText("Timeline unavailable", {}, { timeout: 5000 });
    server.resetHandlers();
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Try again" })[0]!);
    await within(dialog).findByRole("list", { name: "Trades" });
  });

  it("loads the next 50 trades and then shows the end", async () => {
    const events: LedgerEvent[] = Array.from({ length: 60 }, (_, i) => ({
      at: new Date(Date.UTC(2026, 5, 2, 4, i)).toISOString().replace(".000Z", "Z"),
      entryAt: null,
      symbol: "INFY",
      side: "buy",
      qty: 1,
      pricePaise: 100,
      amountPaise: 100,
      chargesPaise: 0,
      netPnlPaise: null,
      reason: null,
      cashAfterPaise: 1000,
    }));
    const offsets: number[] = [];
    server.use(
      http.get("*/api/v1/backtests/:id/timeline", ({ request }) => {
        const query = new URL(request.url).searchParams;
        const offset = Number(query.get("offset")),
          limit = Number(query.get("limit"));
        offsets.push(offset);
        return HttpResponse.json({
          items: events.slice(offset, offset + limit),
          total: 60,
          nextCursor: null,
        });
      }),
    );
    const dialog = renderDialog(mockBacktestRuns[0]!);
    await waitFor(() => expect(items(dialog)).toHaveLength(50));
    expect(within(dialog).queryByText(/End of timeline/)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Load more trades" }));
    await waitFor(() => expect(items(dialog)).toHaveLength(60));
    expect(offsets).toEqual([0, 50]);
    expect(within(dialog).getByText("End of timeline · 60 trades")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Load more trades" }),
    ).not.toBeInTheDocument();
  });

  it("explains combined averaging buys", async () => {
    const strategy = mockStrategies.find((s) => s.id === "stg_001")!;
    server.use(
      http.get("*/api/v1/strategies/:id", () =>
        HttpResponse.json({
          ...strategy,
          versions: strategy.versions.map((version) => ({
            ...version,
            spec: { ...version.spec, averaging: { dropPercent: 2, maxAdds: 2 } },
          })),
        }),
      ),
    );
    const dialog = renderDialog(mockBacktestRuns[0]!);
    await within(dialog).findByText(/Added buys are shown as one buy at the average price\./);
  });
});
