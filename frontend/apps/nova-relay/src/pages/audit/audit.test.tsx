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
  it("loads older entries with Load more when the server pages the list", async () => {
    server.use(
      http.get("*/api/v1/audit", ({ request }) => {
        const url = new URL(request.url);
        url.searchParams.set("limit", "4");
        return paginate(mockAuditEntries, url.toString());
      }),
    );
    renderApp("/audit");
    const more = await screen.findByRole("button", { name: "Load older entries" });
    await waitFor(() => expect(bodyRows()).toHaveLength(4));
    fireEvent.click(more);
    await waitFor(() => expect(bodyRows()).toHaveLength(8));
  });

  it("shows no Load more button when every entry fits in one page", async () => {
    renderApp("/audit");
    await screen.findAllByText("Queued backtest VWAP September Dry Run");
    expect(screen.queryByRole("button", { name: "Load older entries" })).not.toBeInTheDocument();
  });

  it("shows the first page of entries, newest first", async () => {
    renderApp("/audit");
    await screen.findAllByText("Queued backtest VWAP September Dry Run");
    expect(mockAuditEntries.length).toBeGreaterThan(10);
    expect(bodyRows()).toHaveLength(10);
    expect(within(bodyRows()[0]!).getByText("Queued backtest VWAP September Dry Run"));
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
