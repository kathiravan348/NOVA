import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { setupServer } from "msw/node";
import { handlers, mockDataJobs } from "@nova/mocks";
import { http, HttpResponse } from "msw";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

const table = () => screen.getByRole("table", { name: "Stored data" });
const groupButton = (name: string) => within(table()).getByRole("button", { name });

describe("Stored data (D63)", () => {
  it("puts non-index stocks last with a summary and downloads their missing prices", async () => {
    const { router } = renderApp("/stored-data");
    await within(table()).findByRole("button", { name: "Non-index stocks" });
    const groups = within(table()).getAllByRole("button", { expanded: false });
    expect(groups.map((button) => button.textContent)).toEqual([
      "Indices",
      "NIFTY 50",
      "NIFTY BANK",
      "NIFTY NEXT 50",
      "Non-index stocks",
    ]);
    const header = groupButton("Non-index stocks").closest("tr")!;
    expect(within(header).getByText(/2 stocks .* 2 no data .* 0 missing days/)).toBeInTheDocument();
    fireEvent.click(groupButton("Non-index stocks"));
    expect(within(table()).getByRole("button", { name: "GREENGRID-SM" })).toBeInTheDocument();
    expect(within(table()).getByRole("button", { name: "NOVATECH" })).toBeInTheDocument();
    fireEvent.click(
      within(header).getByRole("button", { name: /Download missing for Non-index stocks/ }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/data-jobs/new"));
    expect(router.state.location.state).toMatchObject({
      symbols: ["GREENGRID-SM", "NOVATECH"],
      timeframe: "1d",
    });
  });

  it("puts Unclassified last by sector and shows each stock once without grouping", async () => {
    renderApp("/stored-data");
    await within(table()).findByRole("button", { name: "Non-index stocks" });
    fireEvent.change(screen.getByLabelText("Group by"), { target: { value: "sector" } });
    const labels = within(table())
      .getAllByRole("button", { expanded: false })
      .map((b) => b.textContent);
    expect(labels.at(-1)).toBe("Unclassified");
    expect(labels.slice(0, -1)).toEqual(labels.slice(0, -1).sort((a, b) => a!.localeCompare(b!)));
    fireEvent.click(groupButton("Unclassified"));
    expect(within(table()).getByRole("button", { name: "GREENGRID-SM" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Group by"), { target: { value: "none" } });
    const symbols = within(table())
      .getAllByRole("button")
      .filter((b) => !b.hasAttribute("aria-sort"));
    expect(within(table()).getAllByRole("button", { name: "HDFCBANK" })).toHaveLength(1);
    expect(within(table()).getAllByRole("button", { name: "NOVATECH" })).toHaveLength(1);
    expect(new Set(symbols.map((b) => b.textContent)).size).toBe(symbols.length);
  });

  it("shows broker evidence and opens an overwrite plan for a specific date", async () => {
    const { router } = renderApp("/stored-data");
    fireEvent.mouseDown(await screen.findByRole("tab", { name: "Unavailable data" }), {
      button: 0,
      ctrlKey: false,
    });
    const history = within(await screen.findByRole("table", { name: "Unavailable data" }));
    expect(await history.findByText("5 May 2022")).toBeInTheDocument();
    fireEvent.click(history.getByRole("button", { name: "Check AWL 2022-05-05 again" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/data-jobs/new"));
    expect(router.state.location.state).toMatchObject({
      symbols: ["AWL"],
      from: "2022-05-05",
      to: "2022-05-05",
      mode: "overwrite",
    });
  });
  it("opens from the menu and groups stocks by index", async () => {
    renderApp("/");
    fireEvent.click((await screen.findAllByRole("link", { name: "Stored data" }))[0]!);
    expect(await within(table()).findByRole("button", { name: "NIFTY BANK" })).toBeInTheDocument();
    fireEvent.click(groupButton("NIFTY 50"));
    fireEvent.click(groupButton("NIFTY BANK"));
    // HDFCBANK is in both indices, so it shows under both groups.
    expect(within(table()).getAllByRole("button", { name: "HDFCBANK" })).toHaveLength(2);
    expect(
      within(table()).getByText(
        "5 stocks · 4 complete · 1 with gaps · 0 partial · 0 no data · 1 missing days",
      ),
    ).toBeInTheDocument();
  });

  it("starts the period on 1 Jan 2020 (D69)", async () => {
    renderApp("/stored-data");
    expect(await screen.findByLabelText("From")).toHaveValue("2020-01-01");
  });

  it("shows every status without grouping, and Only with gaps hides complete rows", async () => {
    renderApp("/stored-data");
    const groupBy = await screen.findByLabelText("Group by");
    fireEvent.change(groupBy, { target: { value: "none" } });
    fireEvent.change(await screen.findByRole("searchbox", { name: "Search stocks" }), {
      target: { value: "" },
    });
    await within(table()).findAllByText("Gaps");
    for (const label of ["Complete", "Gaps", "Partial", "No data"]) {
      expect(within(table()).getAllByText(label).length).toBeGreaterThan(0);
    }
    fireEvent.click(screen.getByRole("checkbox", { name: "Only with gaps" }));
    await waitFor(() => expect(within(table()).queryByText("Complete")).not.toBeInTheDocument());
  });

  it("lists a stock's missing ranges and downloads them", async () => {
    const { router } = renderApp("/stored-data");
    fireEvent.change(await screen.findByLabelText("Group by"), { target: { value: "none" } });
    fireEvent.click(await within(table()).findByRole("button", { name: "RELIANCE" }));
    const dialog = await screen.findByRole("dialog", { name: "RELIANCE: missing days" });
    expect(await within(dialog).findByText("12 Aug – 14 Aug 2026")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Download missing" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/data-jobs/new"));
    expect(router.state.location.state).toMatchObject({ symbols: ["RELIANCE"], timeframe: "1d" });
    expect(await screen.findByText("Stocks (1 chosen)")).toBeInTheDocument();
  });

  it("downloads a group's missing stocks with the chosen period", async () => {
    const { router } = renderApp("/stored-data");
    fireEvent.change(await screen.findByLabelText("From"), { target: { value: "2026-01-01" } });
    fireEvent.click(
      await within(table()).findByRole("button", { name: /Download missing for NIFTY NEXT 50/ }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/data-jobs/new"));
    expect(router.state.location.state).toMatchObject({
      symbols: ["DABUR", "PIDILITIND"],
      from: "2026-01-01",
    });
    expect(await screen.findByText("Stocks (2 chosen)")).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toHaveValue("2026-01-01");
  });
});

describe("New download prefill (D63)", () => {
  it("skips empty batch plans and retries a failed start without advancing", async () => {
    let planned = 0;
    let started = 0;
    const job = mockDataJobs[0]!;
    server.use(
      http.post("*/api/v1/data-jobs/plan", async ({ request }) => {
        const body = (await request.json()) as {
          symbols: string[];
          timeframe: "1m" | "1d";
          from: string;
          to: string;
        };
        planned += 1;
        return HttpResponse.json({
          ...job,
          ...body,
          id: `draft_${planned}`,
          status: "draft",
          mode: "skip_existing",
          startedAt: null,
          finishedAt: null,
          expiresAt: "2026-10-01T06:00:00Z",
          plan: {
            steps: 1,
            skippedSteps: planned === 1 ? 1 : 0,
            requests: planned === 1 ? 0 : 1,
            estimatedRows: 1,
            estimatedBytes: 80,
            estimatedSeconds: 1,
            estimatedStartAt: "2026-09-30T06:00:00Z",
            jobsAhead: 0,
            warnings: [],
            perSymbol: [
              {
                symbol: "INFY",
                existingFrom: null,
                existingTo: null,
                steps: 1,
                skippedSteps: planned === 1 ? 1 : 0,
              },
            ],
          },
        });
      }),
      http.post("*/api/v1/data-jobs/:id/start", () => {
        started += 1;
        return started === 1
          ? HttpResponse.json(
              { error: { code: "invalid_request", message: "Try Start again" } },
              { status: 400 },
            )
          : HttpResponse.json({ ...job, status: "queued", startedAt: null, finishedAt: null });
      }),
    );
    const { router } = renderApp({
      pathname: "/data-jobs/new",
      state: {
        syncPlans: ["1d", "1m"].map((timeframe) => ({
          symbols: ["INFY"],
          timeframe,
          from: "2026-09-25",
          to: "2026-09-28",
        })),
      },
    });
    await screen.findByText("Plan 1 of 2 · INFY");
    expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next plan" }));
    await screen.findByText("Plan 2 of 2 · INFY");
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(await screen.findByText("Try Start again")).toBeInTheDocument();
    expect(screen.getByText("Plan 2 of 2 · INFY")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/data-jobs"));
    expect(planned).toBe(2);
    expect(started).toBe(2);
  });
  it("ignores state that is not a valid download", async () => {
    renderApp({ pathname: "/data-jobs/new", state: { symbols: [], timeframe: "5m" } });
    expect(await screen.findByText("Stocks (0 chosen)")).toBeInTheDocument();
  });

  it("puts index names under Indices", async () => {
    renderApp({
      pathname: "/data-jobs/new",
      state: {
        symbols: ["INFY", "NIFTY 50"],
        timeframe: "1d",
        from: "2021-01-01",
        to: "2026-09-18",
      },
    });
    expect(await screen.findByText("Stocks (1 chosen)")).toBeInTheDocument();
    expect(await screen.findByText("Indices (1 chosen)")).toBeInTheDocument();
  });
});
