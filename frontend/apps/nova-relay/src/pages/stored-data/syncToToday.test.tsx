import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { CoverageRow, DataJobPlanRequest } from "@nova/contracts";
import { handlers, mockUnavailableDays } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";
import { excludeDays, needsSync, prepareSync, syncBatch } from "./syncToToday";

const server = setupServer(...handlers);
const row: CoverageRow = {
  symbol: "INFY",
  name: "Infosys",
  kind: "stock",
  sector: "IT",
  indices: ["NIFTY 50"],
  firstDay: "2026-09-01",
  lastDay: "2026-09-30",
  days: 22,
  missingDays: 0,
  status: "complete",
};
const sent: DataJobPlanRequest[] = [];
const starts: string[] = [];
const capture = async ({ request }: { request: Request }) => {
  if (request.method === "POST" && request.url.endsWith("/data-jobs/plan"))
    sent.push((await request.clone().json()) as DataJobPlanRequest);
  if (request.url.endsWith("/start")) starts.push(request.url);
};

function coverage(rows: CoverageRow[]) {
  server.use(
    http.get("*/api/v1/market-data/coverage", ({ request }) => {
      const params = new URL(request.url).searchParams;
      return HttpResponse.json({
        timeframe: params.get("timeframe"),
        from: params.get("from"),
        to: params.get("to"),
        calendar: "index",
        rows,
        total: rows.length,
      });
    }),
  );
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  server.events.on("request:start", capture);
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
  vi.useRealTimers();
  sent.length = 0;
  starts.length = 0;
});
afterAll(() => server.close());

describe("Sync to today", () => {
  it("splits around unavailable dates including the range edges and duplicates", () => {
    expect(
      excludeDays("2026-09-25", "2026-09-30", [
        "2026-09-25",
        "2026-09-28",
        "2026-09-28",
        "2026-09-30",
      ]),
    ).toEqual([
      { from: "2026-09-26", to: "2026-09-27" },
      { from: "2026-09-29", to: "2026-09-29" },
    ]);
    expect(excludeDays("2026-09-30", "2026-09-30", ["2026-09-30"])).toEqual([]);
    expect(
      needsSync(
        { ...row, missingDays: 2, unavailableDays: 2, status: "unavailable" },
        "2026-09-30",
      ),
    ).toBe(false);
    expect(needsSync({ ...row, lastDay: "2026-09-29" }, "2026-09-30")).toBe(true);
    expect(
      syncBatch({
        syncPlans: [{ symbols: ["INFY"], timeframe: "1m", from: "2026-09-30", to: "2026-09-29" }],
      }),
    ).toEqual([]);
  });

  it("uses per-stock tails and starts stocks without history at 2020", async () => {
    const plans = await prepareSync(
      [
        {
          timeframe: "1d",
          rows: [
            { ...row, lastDay: "2026-09-29" },
            { ...row, symbol: "NOVATECH", firstDay: null, lastDay: null, days: 0, status: "none" },
          ],
        },
      ],
      "2026-09-30",
    );
    expect(plans.map((p) => [p.symbols[0], p.from, p.to])).toEqual([
      ["INFY", "2026-09-29", "2026-09-30"],
      ["NOVATECH", "2020-01-01", "2026-09-30"],
    ]);
  });

  it("puts stocks with the same date window in one plan", async () => {
    const plans = await prepareSync(
      [
        {
          timeframe: "1d",
          rows: [
            { ...row, lastDay: "2026-09-29" },
            { ...row, symbol: "TCS", lastDay: "2026-09-29" },
          ],
        },
      ],
      "2026-09-30",
    );
    expect(plans).toHaveLength(1);
    expect(plans[0]!.symbols).toEqual(["INFY", "TCS"]);
  });

  it("reads every unavailable page before excluding dates from catch-up windows", async () => {
    const offsets: (string | null)[] = [];
    server.use(
      http.get("*/api/v1/market-data/unavailable", ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        offsets.push(cursor);
        return HttpResponse.json({
          items: [
            {
              ...mockUnavailableDays[0]!,
              symbol: "INFY",
              timeframe: "1d",
              day: cursor ? "2026-09-30" : "2026-09-28",
              status: "unavailable",
              resolvedAt: null,
            },
          ],
          total: 2,
          nextCursor: cursor ? null : "second",
        });
      }),
    );
    const plans = await prepareSync(
      [{ timeframe: "1d", rows: [{ ...row, lastDay: "2026-09-27" }] }],
      "2026-09-30",
    );
    expect(offsets).toEqual([null, "second"]);
    expect(plans.map((p) => [p.from, p.to])).toEqual([
      ["2026-09-27", "2026-09-27"],
      ["2026-09-29", "2026-09-29"],
    ]);
  });

  it("shows last day, excludes explained gaps, and disables when both timeframes are current", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T06:00:00Z"));
    coverage([{ ...row, missingDays: 2, unavailableDays: 2, status: "unavailable" }]);
    renderApp("/stored-data");
    expect(await screen.findByRole("button", { name: "Up to date" })).toBeDisabled();
    expect(
      screen.getByText(/Last stored day: 30 Sep 2026. 0 stocks with missing days/),
    ).toBeInTheDocument();
  });

  it("reviews both timeframes with missing ranges and requires Start for each draft", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T06:00:00Z"));
    coverage([
      {
        ...row,
        symbol: "RELIANCE",
        name: "Reliance",
        missingDays: 3,
        unavailableDays: 1,
        status: "gaps",
      },
    ]);
    server.use(
      http.get("*/api/v1/market-data/coverage/:symbol", ({ request }) =>
        HttpResponse.json({
          symbol: "RELIANCE",
          timeframe: new URL(request.url).searchParams.get("timeframe"),
          from: "2020-01-01",
          to: "2026-09-30",
          firstDay: row.firstDay,
          lastDay: row.lastDay,
          days: 19,
          missingDays: 3,
          missing: [{ from: "2026-09-25", to: "2026-09-29", days: 3 }],
          unavailableDays: 1,
        }),
      ),
      http.get("*/api/v1/market-data/unavailable", ({ request }) =>
        HttpResponse.json({
          items: [
            {
              ...mockUnavailableDays[0]!,
              symbol: "RELIANCE",
              timeframe: new URL(request.url).searchParams.get("timeframe"),
              day: "2026-09-28",
              status: "unavailable",
              resolvedAt: null,
            },
          ],
          total: 1,
          nextCursor: null,
        }),
      ),
    );
    const { router } = renderApp("/stored-data");
    fireEvent.click(await screen.findByRole("button", { name: "Sync to today" }));
    const dialog = await screen.findByRole("dialog", { name: "Sync to today" });
    expect(within(dialog).getByText(/1 stocks · 1 minute/)).toBeInTheDocument();
    const review = within(dialog).getByRole("button", { name: "Review plan" });
    await waitFor(() => expect(review).toBeEnabled());
    expect(sent).toHaveLength(0);
    expect(starts).toHaveLength(0);
    fireEvent.click(review);
    await screen.findByText("Plan 1 of 4 · RELIANCE");
    expect(router.state.location.state.syncPlans).toEqual([
      expect.objectContaining({
        symbols: ["RELIANCE"],
        timeframe: "1d",
        from: "2026-09-25",
        to: "2026-09-27",
      }),
      expect.objectContaining({ timeframe: "1d", from: "2026-09-29", to: "2026-09-29" }),
      expect.objectContaining({ timeframe: "1m", from: "2026-09-25", to: "2026-09-27" }),
      expect.objectContaining({ timeframe: "1m", from: "2026-09-29", to: "2026-09-29" }),
    ]);
    expect(sent).toHaveLength(1);
    expect(starts).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await screen.findByText("Plan 2 of 4 · RELIANCE");
    expect(starts).toHaveLength(1);
    expect(sent).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/stored-data"));
    expect(starts).toHaveLength(1);
  });

  it("offers the filtered group or all stocks and recovers a failed date check", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T06:00:00Z"));
    coverage([
      { ...row, lastDay: "2026-09-29" },
      { ...row, symbol: "TCS", name: "TCS", indices: ["NIFTY IT"], lastDay: "2026-09-28" },
    ]);
    renderApp("/stored-data");
    fireEvent.change(await screen.findByLabelText("Show group"), { target: { value: "NIFTY IT" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search stocks" }), {
      target: { value: "TCS" },
    });
    server.use(
      http.get("*/api/v1/market-data/unavailable", () =>
        HttpResponse.json(
          { error: { code: "invalid_request", message: "Date check failed" } },
          { status: 400 },
        ),
      ),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Sync to today" }));
    const dialog = await screen.findByRole("dialog", { name: "Sync to today" });
    expect(await within(dialog).findByText("Date check failed")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Review plan" })).toBeDisabled();
    server.resetHandlers();
    coverage([
      { ...row, lastDay: "2026-09-29" },
      { ...row, symbol: "TCS", name: "TCS", indices: ["NIFTY IT"], lastDay: "2026-09-28" },
    ]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Review plan" })).toBeEnabled(),
    );
    expect(within(dialog).getByText(/1 stocks ·/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Stocks to sync"), { target: { value: "all" } });
    expect(await within(dialog).findByText(/2 stocks ·/)).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Review plan" })).toBeEnabled(),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Review plan" }));
    await screen.findByText("Plan 1 of 4 · INFY");
    expect(sent[0]).toMatchObject({ symbols: ["INFY"], from: "2026-09-29", to: "2026-09-30" });
  });
});
