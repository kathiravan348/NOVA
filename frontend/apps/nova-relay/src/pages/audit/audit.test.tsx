import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { handlers, mockAuditEntries, paginate } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

const bodyRows = () =>
  within(screen.getByRole("table", { name: "Audit log" }))
    .getAllByRole("row")
    .slice(1);

describe("Audit log", () => {
  it("pages server rows, shows total and resets when the size changes", async () => {
    const rows = Array.from({ length: 75 }, (_, i) => ({
      ...mockAuditEntries[0]!,
      id: "audit-" + i,
      summary: "Paged audit " + i,
    }));
    server.use(http.get("*/api/v1/audit", ({ request }) => paginate(rows, request.url)));
    renderApp("/audit");
    await screen.findByText("Showing 1–50 of 75");
    expect(bodyRows()).toHaveLength(50);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("Showing 51–75 of 75");
    await waitFor(() => expect(bodyRows()).toHaveLength(25));
    expect(within(bodyRows()[0]!).getByText("Paged audit 50")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "25" } });
    await screen.findByText("Showing 1–25 of 75");
    await waitFor(() =>
      expect(within(bodyRows()[0]!).getByText("Paged audit 0")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: "Load older entries" })).not.toBeInTheDocument();
  });

  it("shows the whole first server page, newest first", async () => {
    renderApp("/audit");
    await screen.findAllByText("Queued backtest VWAP September Dry Run");
    expect(bodyRows()).toHaveLength(mockAuditEntries.length);
    expect(within(bodyRows()[0]!).getByText("Queued backtest VWAP September Dry Run"));
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("filters by group and keeps it in the URL", async () => {
    const { router } = renderApp("/audit");
    fireEvent.change(await screen.findByLabelText("Show"), { target: { value: "broker" } });
    await waitFor(() => expect(router.state.location.search).toBe("?group=broker"));
    const brokerCount = mockAuditEntries.filter((e) => e.action.startsWith("broker.")).length;
    await waitFor(() => expect(bodyRows()).toHaveLength(brokerCount));
    for (const row of bodyRows()) {
      expect(row.textContent).toMatch(/Kite login|Kite session expired/);
    }
  });
});
