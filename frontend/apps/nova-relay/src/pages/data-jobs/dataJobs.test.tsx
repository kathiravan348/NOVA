import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { handlers } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
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
