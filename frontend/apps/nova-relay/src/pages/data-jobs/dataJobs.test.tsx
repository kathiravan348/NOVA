import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { handlers, mockDataJobs, resetMockRecorder } from "@nova/mocks";
import { JOB_POLL_MS } from "@nova/services";
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

describe("Data jobs", () => {
  it("lists every job with its status", async () => {
    renderApp("/data-jobs");
    const table = await screen.findByRole("table", { name: "Data jobs" });
    expect(await within(table).findAllByRole("link", { name: "Historical download" })).toHaveLength(
      2,
    );
    for (const label of ["Completed", "Running", "Queued", "Failed", "Cancelled"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("shows a failed job's error", async () => {
    renderApp("/data-jobs/job_004");
    expect(
      await screen.findByText("Rate limit exceeded on historical data API"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel job" })).not.toBeInTheDocument();
  });

  it("asks before cancelling a running job, then confirms it", async () => {
    renderApp("/data-jobs/job_002");
    expect(await screen.findByRole("meter")).toHaveAttribute("aria-valuenow", "45");
    fireEvent.click(screen.getByRole("button", { name: "Cancel job" }));
    const dialog = await screen.findByRole("dialog", { name: "Cancel this job?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel job" }));
    expect(await screen.findByText("Job cancelled (demo)")).toBeInTheDocument();
  });

  it("shows the server's message when a cancel is refused", async () => {
    server.use(
      http.post("*/api/v1/data-jobs/:id/cancel", () =>
        HttpResponse.json(
          { error: { code: "invalid_request", message: "Job is already completed" } },
          { status: 400 },
        ),
      ),
    );
    renderApp("/data-jobs/job_003");
    fireEvent.click(await screen.findByRole("button", { name: "Cancel job" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel job" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Job is already completed");
  });

  it("refreshes a queued job until it finishes, then stops", async () => {
    const saved = { ...JOB_POLL_MS };
    JOB_POLL_MS.detail = 20;
    const statuses = ["queued", "running", "completed"] as const;
    let calls = 0;
    server.use(
      http.get("*/api/v1/data-jobs/job_002", () => {
        const status = statuses[Math.min(calls, statuses.length - 1)];
        calls += 1;
        const done = status === "completed";
        return HttpResponse.json({
          ...mockDataJobs.find((job) => job.id === "job_002"),
          status,
          progressPercent: done ? 100 : 0,
          startedAt: status === "queued" ? null : "2026-09-26T05:20:00Z",
          finishedAt: done ? "2026-09-26T05:21:00Z" : null,
          error: null,
        });
      }),
    );
    try {
      renderApp("/data-jobs/job_002");
      expect(await screen.findByText("Queued")).toBeInTheDocument();
      expect(await screen.findByText("Completed")).toBeInTheDocument();
      const settled = calls;
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(calls).toBe(settled);
    } finally {
      Object.assign(JOB_POLL_MS, saved);
    }
  });

  it("shows Not found for an unknown job", async () => {
    renderApp("/data-jobs/nope");
    expect(await screen.findByText("Not found")).toBeInTheDocument();
  });
});

describe("New download", () => {
  it("opens from the jobs list", async () => {
    renderApp("/data-jobs");
    fireEvent.click(await screen.findByRole("link", { name: "New download" }));
    expect(await screen.findByRole("table", { name: "Stocks to download" })).toBeInTheDocument();
  });

  it("needs a stock and a period in order", async () => {
    renderApp("/data-jobs/new");
    await screen.findByRole("table", { name: "Stocks to download" });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-12-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Queue download" }));
    expect(await screen.findByText("Pick at least one stock")).toBeInTheDocument();
    expect(screen.getByText("From must be on or before To")).toBeInTheDocument();
  });

  it("queues the chosen stocks and returns to the list", async () => {
    renderApp("/data-jobs/new");
    const table = await screen.findByRole("table", { name: "Stocks to download" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search stocks" }), {
      target: { value: "INFY" },
    });
    const row = (await within(table).findByText("INFY")).closest("tr")!;
    fireEvent.click(within(row).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Queue download" }));
    expect(await screen.findByText("Download queued (demo)")).toBeInTheDocument();
    expect(await screen.findByRole("table", { name: "Data jobs" })).toBeInTheDocument();
  });

  it("shows a server error", async () => {
    server.use(
      http.post("*/api/v1/data-jobs", () =>
        HttpResponse.json(
          { error: { code: "invalid_request", message: "Not in the stock list: INFY" } },
          { status: 400 },
        ),
      ),
    );
    renderApp("/data-jobs/new");
    const table = await screen.findByRole("table", { name: "Stocks to download" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search stocks" }), {
      target: { value: "INFY" },
    });
    const row = (await within(table).findByText("INFY")).closest("tr")!;
    fireEvent.click(within(row).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Queue download" }));
    expect(await screen.findByText("Not in the stock list: INFY")).toBeInTheDocument();
  });
});

describe("Live prices", () => {
  it("switches recording on and shows its state", async () => {
    renderApp("/data-jobs");
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
    renderApp("/data-jobs");
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.getByText("1 chosen stock")).toBeInTheDocument();
    const link = screen.queryByRole("link", { name: "Open today's recording" });
    expect(Boolean(link)).toBe(state === "recording");
  });

  it("saves the chosen stocks", async () => {
    renderApp("/data-jobs");
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

  it("queues an archive and blocks a future date", async () => {
    renderApp("/data-jobs");
    fireEvent.click(await screen.findByRole("button", { name: "Archive old ticks" }));
    const dialog = await screen.findByRole("dialog", { name: "Archive old ticks" });
    fireEvent.change(within(dialog).getByLabelText("Move ticks before"), {
      target: { value: "2999-01-01" },
    });
    expect(within(dialog).getByText("The date can't be in the future")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Queue archive" })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Move ticks before"), {
      target: { value: "2026-09-01" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Queue archive" }));
    expect(await screen.findByText("Archive queued (demo)")).toBeInTheDocument();
  });
});
