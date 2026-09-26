import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { DataJob } from "@nova/contracts";
import { handlers, mockDataJobs, mockUniverse, resetMockDownloadSettings } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);
let calls: string[] = [];
server.events.on("request:start", ({ request }) => {
  const url = new URL(request.url);
  calls.push(`${request.method} ${url.pathname}`);
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
  resetMockDownloadSettings();
  calls = [];
});
afterAll(() => server.close());

async function pickInfy() {
  renderApp("/data-jobs/new");
  const table = await screen.findByRole("table", { name: "Stocks to download" });
  fireEvent.change(screen.getByRole("searchbox", { name: "Search stocks" }), {
    target: { value: "INFY" },
  });
  const row = (await within(table).findByText("INFY")).closest("tr")!;
  fireEvent.click(within(row).getByRole("checkbox"));
}

describe("New download", () => {
  it("opens from the jobs list", async () => {
    renderApp("/data-jobs");
    fireEvent.click(await screen.findByRole("link", { name: "New download" }));
    expect(await screen.findByRole("table", { name: "Stocks to download" })).toBeInTheDocument();
  });

  it("offers only 1 minute and 1 day", async () => {
    renderApp("/data-jobs/new");
    const select = await screen.findByLabelText("Timeframe");
    const options = within(select)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual(["1 minute", "1 day"]);
    expect(select).toHaveValue("1d");
  });

  it("needs a stock and a period in order", async () => {
    renderApp("/data-jobs/new");
    await screen.findByRole("table", { name: "Stocks to download" });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-12-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Check plan" }));
    expect(await screen.findByText("Pick at least one stock")).toBeInTheDocument();
    expect(screen.getByText("From must be on or before To")).toBeInTheDocument();
    expect(calls.filter((c) => c.endsWith("/data-jobs/plan"))).toEqual([]);
  });

  it("adds a whole index or sector and clears", async () => {
    renderApp("/data-jobs/new");
    await screen.findByRole("table", { name: "Stocks to download" });
    const bank = mockUniverse.filter((e) => e.synced && e.indices.includes("NIFTY BANK"));
    const it = mockUniverse.filter((e) => e.synced && e.sector === "Information Technology");
    const indexPicker = await screen.findByLabelText("Add index");
    await waitFor(() => expect(within(indexPicker).getByText(/^NIFTY BANK/)).toBeInTheDocument());

    fireEvent.change(indexPicker, { target: { value: "NIFTY BANK" } });
    expect(await screen.findByText(`Stocks (${bank.length} chosen)`)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Add sector"), {
      target: { value: "Information Technology" },
    });
    fireEvent.change(indexPicker, { target: { value: "NIFTY BANK" } }); // duplicates are ignored
    expect(
      await screen.findByText(`Stocks (${bank.length + it.length} chosen)`),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(await screen.findByText("Stocks (0 chosen)")).toBeInTheDocument();
  });

  it("shows the plan, re-plans on Overwrite and starts", async () => {
    await pickInfy();
    fireEvent.click(screen.getByRole("button", { name: "Check plan" }));

    expect(await screen.findByText("Check the plan")).toBeInTheDocument();
    expect(screen.getAllByText("1 of 1").length).toBeGreaterThan(0);
    expect(screen.getByText("~5,000")).toBeInTheDocument();
    expect(screen.getByText("~400 KB")).toBeInTheDocument();
    expect(screen.getByText("less than a minute")).toBeInTheDocument();
    expect(screen.getByText("Now")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Data already stored"), {
      target: { value: "overwrite" },
    });
    await waitFor(() => expect(calls.filter((c) => c.endsWith("/data-jobs/plan"))).toHaveLength(2));
    expect(calls).toContain("DELETE /api/v1/data-jobs/job_plan");
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLSelectElement>("Data already stored").value).toBe(
        "overwrite",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(await screen.findByText("Download started (demo)")).toBeInTheDocument();
    expect(calls).toContain("POST /api/v1/data-jobs/job_plan/start");
    expect(await screen.findByRole("table", { name: "Data jobs" })).toBeInTheDocument();
  });

  it("says when there is nothing to download, and Back discards the plan", async () => {
    await pickInfy();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-09-18" } });
    fireEvent.click(screen.getByRole("button", { name: "Check plan" }));

    expect(await screen.findByText("Nothing to download")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("button", { name: "Check plan" })).toBeInTheDocument();
    expect(calls).toContain("DELETE /api/v1/data-jobs/job_plan");
  });

  it("shows a server error", async () => {
    server.use(
      http.post("*/api/v1/data-jobs/plan", () =>
        HttpResponse.json(
          { error: { code: "invalid_request", message: "Not in the stock list: INFY" } },
          { status: 400 },
        ),
      ),
    );
    await pickInfy();
    fireEvent.click(screen.getByRole("button", { name: "Check plan" }));
    expect(await screen.findByText("Not in the stock list: INFY")).toBeInTheDocument();
  });
});

describe("Pause and resume", () => {
  const running: DataJob = {
    ...mockDataJobs[0]!,
    id: "job_run",
    status: "running",
    progressPercent: 25,
    finishedAt: null,
    stepsDone: 1,
    stepsTotal: 4,
  };

  it("pauses a running download and resumes it", async () => {
    let current = running;
    server.use(
      http.get("*/api/v1/data-jobs/job_run", () => HttpResponse.json(current)),
      http.post("*/api/v1/data-jobs/job_run/pause", () => {
        current = { ...running, status: "paused" };
        return HttpResponse.json(current);
      }),
      http.post("*/api/v1/data-jobs/job_run/resume", () => {
        current = { ...running, status: "queued", startedAt: null };
        return HttpResponse.json(current);
      }),
    );
    renderApp("/data-jobs/job_run");
    expect(await screen.findByText("1 of 4 steps done")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(await screen.findByText("Download paused (demo)")).toBeInTheDocument();
    expect(await screen.findByText("Paused")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(await screen.findByText("Download resumed (demo)")).toBeInTheDocument();
    expect(await screen.findByText("Queued")).toBeInTheDocument();
  });

  it("offers no Pause for jobs that are not downloads", async () => {
    renderApp("/data-jobs/job_002"); // a running tick recording
    await screen.findByText("Running");
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
  });
});

describe("Download pace", () => {
  it("saves the market-hours pace", async () => {
    renderApp("/data-jobs");
    const pace = await screen.findByLabelText("In market hours (09:15–15:30)");
    await waitFor(() => expect((pace as HTMLSelectElement).value).toBe("slow"));

    fireEvent.change(pace, { target: { value: "full" } });

    expect(await screen.findByText("Download pace saved (demo)")).toBeInTheDocument();
    expect(calls).toContain("PATCH /api/v1/data-jobs/settings");
    await waitFor(() => expect((pace as HTMLSelectElement).value).toBe("full"));
  });
});

describe("Delete job", () => {
  it("is offered only for planned or finished jobs", async () => {
    renderApp("/data-jobs/job_002"); // running
    await screen.findByText("Running");
    expect(screen.queryByRole("button", { name: "Delete job" })).not.toBeInTheDocument();
  });

  it("deletes a download with its candles and returns to the list", async () => {
    renderApp("/data-jobs/job_001"); // a completed download
    fireEvent.click(await screen.findByRole("button", { name: "Delete job" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete this job?" });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Also delete the candles/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete job" }));

    expect(await screen.findByText("Job deleted (demo)")).toBeInTheDocument();
    expect(calls).toContain("DELETE /api/v1/data-jobs/job_001");
    expect(await screen.findByRole("table", { name: "Data jobs" })).toBeInTheDocument();
  });

  it("sends candles=true only when ticked, and offers no candles for other jobs", async () => {
    const urls: string[] = [];
    server.events.on("request:start", ({ request }) => {
      if (request.method === "DELETE") urls.push(request.url);
    });
    renderApp("/data-jobs/job_001");
    fireEvent.click(await screen.findByRole("button", { name: "Delete job" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete this job?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete job" }));
    await screen.findByText("Job deleted (demo)");
    expect(urls.at(-1)).not.toContain("candles=true");

    cleanup();
    renderApp("/data-jobs/job_006"); // a completed stock-list sync
    fireEvent.click(await screen.findByRole("button", { name: "Delete job" }));
    const syncDialog = await screen.findByRole("dialog", { name: "Delete this job?" });
    expect(within(syncDialog).queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
