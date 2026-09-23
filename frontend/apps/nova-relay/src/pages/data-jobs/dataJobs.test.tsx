import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
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

  it("offers a demo cancel for a running job", async () => {
    renderApp("/data-jobs/job_002");
    expect(await screen.findByRole("meter")).toHaveAttribute("aria-valuenow", "45");
    fireEvent.click(screen.getByRole("button", { name: "Cancel job" }));
    expect(await screen.findByText("Demo only")).toBeInTheDocument();
  });

  it("shows Not found for an unknown job", async () => {
    renderApp("/data-jobs/nope");
    expect(await screen.findByText("Not found")).toBeInTheDocument();
  });
});
