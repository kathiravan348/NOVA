import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { handlers, mockBacktestRuns } from "@nova/mocks";
import type { LedgerDay } from "@nova/contracts";
import { renderApp } from "../../test/renderApp";
import { TimelineDialog } from "./TimelineDialog";
import { TimelineDayEvents } from "./TimelineDayEvents";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

async function openTimeline() {
  renderApp("/backtests/run_001");
  fireEvent.click(await screen.findByRole("button", { name: "Timeline" }));
  const dialog = screen.getByRole("dialog");
  await within(dialog).findAllByRole("button", { name: "Expand 2 Jun 2026" });
  return dialog;
}

describe("Backtest Timeline", () => {
  it("expands a day into buys and sells with IST seconds, cash after, and unknown reasons", async () => {
    const dialog = await openTimeline();
    const expand = within(dialog).getAllByRole("button", { name: "Expand 2 Jun 2026" })[0]!;
    expect(expand).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(expand);
    const events = (
      await within(dialog).findAllByRole("table", { name: "Events for 2 Jun 2026" })
    )[0]!;
    await within(events).findByText("09:30:00");
    expect(within(events).getByText("Buy")).toBeInTheDocument();
    expect(within(events).getByText("Sell")).toBeInTheDocument();
    expect(within(events).getByText("₹8,55,000.00")).toBeInTheDocument();
    expect(within(events).getByText("₹10,02,417.25")).toBeInTheDocument();
    expect(within(events).getAllByText("—").length).toBeGreaterThanOrEqual(2);
    const collapse = within(dialog).getAllByRole("button", { name: "Collapse 2 Jun 2026" })[0]!;
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(collapse);
    expect(
      within(dialog).queryByRole("table", { name: "Events for 2 Jun 2026" }),
    ).not.toBeInTheDocument();
  });

  it("filters stocks and dates and includes quiet days only with the switch", async () => {
    const dialog = await openTimeline();
    fireEvent.change(within(dialog).getByLabelText("Stock"), { target: { value: "reliance" } });
    await waitFor(() =>
      expect(
        within(dialog).queryByRole("button", { name: "Expand 5 Jun 2026" }),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(within(dialog).getByRole("switch", { name: "Show days without trades" }));
    await within(dialog).findAllByRole("button", { name: "Expand 1 Jun 2026" });
    fireEvent.click(within(dialog).getByRole("switch", { name: "Show days without trades" }));
    fireEvent.change(within(dialog).getByLabelText("From"), { target: { value: "2026-06-03" } });
    await waitFor(() =>
      expect(
        within(dialog).queryByRole("button", { name: "Expand 2 Jun 2026" }),
      ).not.toBeInTheDocument(),
    );
    await within(dialog).findAllByRole("button", { name: "Expand 12 Jun 2026" });
    fireEvent.change(within(dialog).getByLabelText("To"), { target: { value: "2026-06-11" } });
    expect((await within(dialog).findAllByText("No trades in these days")).length).toBeGreaterThan(
      0,
    );
  });

  it("hides Timeline on a summary-only version", async () => {
    renderApp("/backtests/run_006");
    await screen.findByText(/Older version: only the summary is kept/);
    expect(screen.queryByRole("button", { name: "Timeline" })).not.toBeInTheDocument();
  });

  it("retries a ledger error", async () => {
    server.use(
      http.get("*/api/v1/backtests/:id/ledger", () =>
        HttpResponse.json(
          { error: { code: "internal", message: "Ledger unavailable" } },
          { status: 500 },
        ),
      ),
    );
    renderApp("/backtests/run_001");
    fireEvent.click(await screen.findByRole("button", { name: "Timeline" }));
    const dialog = screen.getByRole("dialog");
    await within(dialog).findAllByText("Ledger unavailable", {}, { timeout: 5000 });
    server.resetHandlers();
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Try again" })[0]!);
    await within(dialog).findAllByRole("button", { name: "Expand 2 Jun 2026" });
  });

  it("requests the next server page at offset 25", async () => {
    const rows: LedgerDay[] = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, "0")}`,
      buys: 1,
      sells: 1,
      boughtPaise: 1000,
      soldPaise: 1000,
      chargesPaise: 0,
      netPnlPaise: 0,
      cashPaise: 100000000,
      holdingsPaise: 0,
      equityPaise: 100000000,
      openPositions: 0,
    }));
    const offsets: number[] = [];
    server.use(
      http.get("*/api/v1/backtests/:id/ledger", ({ request }) => {
        const query = new URL(request.url).searchParams;
        const offset = Number(query.get("offset")),
          limit = Number(query.get("limit"));
        offsets.push(offset);
        return HttpResponse.json({
          items: rows.slice(offset, offset + limit),
          total: 30,
          nextCursor: null,
        });
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <TimelineDialog
          run={{ ...mockBacktestRuns[0]!, to: "2026-06-30" }}
          onOpenChange={vi.fn()}
        />
      </QueryClientProvider>,
    );
    const dialog = screen.getByRole("dialog");
    await within(dialog).findAllByRole("button", { name: "Expand 25 Jun 2026" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Next page" }));
    await within(dialog).findAllByRole("button", { name: "Expand 26 Jun 2026" });
    expect(offsets).toEqual([0, 25]);
    expect(within(dialog).getByLabelText("Jump to page")).toHaveValue(2);
  });

  it("explains combined averaging buys under the day events", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <TimelineDayEvents runId="run_001" date="2026-06-02" recorded averaging />
      </QueryClientProvider>,
    );
    await screen.findByText("Added buys are shown as one buy at the average price.");
  });
});
