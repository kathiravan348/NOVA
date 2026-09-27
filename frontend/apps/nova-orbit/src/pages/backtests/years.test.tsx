import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { BacktestResult, YearRow } from "@nova/contracts";
import { handlers, mockBacktestResults } from "@nova/mocks";
import { formatInr } from "@nova/ui-trading";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

const base = mockBacktestResults.find((r) => r.runId === "run_001")!;
const PROFITS = [15_000_000, -6_000_000, 20_000_000, 9_000_000, 12_000_000];
const years: YearRow[] = PROFITS.map((profitPaise, k) => ({
  year: k + 1,
  from: `${2021 + k}-10-01`,
  to: `${2022 + k}-09-30`,
  returnPercent: k === 1 ? -6 : 12.5,
  profitPaise,
  maxDrawdownPercent: -4.2,
  benchmarkPercent: k === 4 ? null : 9.1,
}));
const net = PROFITS.reduce((sum, p) => sum + p, 0);

function serve(result: BacktestResult) {
  server.use(http.get("*/api/v1/backtests/run_001/result", () => HttpResponse.json(result)));
}

describe("Year by year and the D62 metrics (NOVA-120)", () => {
  it("shows five year rows that add up to the net P&L, the new cards and the benchmark line", async () => {
    serve({
      ...base,
      metrics: {
        ...base.metrics,
        grossPnlPaise: net + 1_000_000,
        chargesPaise: 1_000_000,
        netPnlPaise: net,
        afterTaxCagrPercent: 7.4,
        estimatedTaxPaise: 4_200_000,
        benchmarkReturnPercent: 58.2,
        exposurePercent: 81,
        avgHoldDays: 43.2,
        profitFactor: 1.9,
        calmar: 0.8,
      },
      years,
    });
    renderApp("/backtests/run_001");

    const table = await screen.findByRole("table", { name: "Year by year" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(5);
    expect(within(rows[0]!).getByText("Year 1 · 1 Oct 2021 – 30 Sep 2022")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Below −5%")).toBeInTheDocument();
    expect(within(rows[4]!).getByText("—")).toBeInTheDocument();
    // The Net P&L card shows the same total the five rows add up to.
    const netCard = screen.getAllByText("Net P&L")[0]!.closest("div.rounded-lg") as HTMLElement;
    expect(netCard.textContent).toContain(formatInr(net, { signed: true }));

    expect(screen.getByText("+7.40%")).toBeInTheDocument();
    expect(screen.getByText("Estimated tax ₹42,000")).toBeInTheDocument();
    expect(screen.getByText("NIFTY 50, same period")).toBeInTheDocument();
    expect(screen.getByText("1.90")).toBeInTheDocument();
    expect(screen.getAllByText("NIFTY 50").length).toBeGreaterThan(0); // the curve's legend
  });

  it("shows — for an older run's missing numbers and no year card", async () => {
    serve({
      ...base,
      metrics: {
        ...base.metrics,
        afterTaxCagrPercent: null,
        estimatedTaxPaise: null,
        afterTaxNetPnlPaise: null,
        benchmarkReturnPercent: null,
        benchmarkCagrPercent: null,
        exposurePercent: null,
        avgHoldDays: null,
        profitFactor: null,
        calmar: null,
      },
      years: [],
    });
    renderApp("/backtests/run_001");

    expect(await screen.findByText("After-tax CAGR")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText("No tax estimate for intraday")).toBeInTheDocument();
    expect(screen.queryByText("Year by year")).not.toBeInTheDocument();
  });
});
