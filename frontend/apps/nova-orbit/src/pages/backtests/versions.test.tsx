import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { setupServer } from "msw/node";
import { handlers } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);
const requests: { method: string; path: string; body: unknown }[] = [];
server.events.on("request:start", ({ request }) => {
  const url = new URL(request.url);
  const entry = { method: request.method, path: url.pathname + url.search, body: null as unknown };
  requests.push(entry);
  if (request.method === "POST") {
    void request
      .clone()
      .json()
      .then((body) => (entry.body = body));
  }
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
  requests.length = 0;
});
afterAll(() => server.close());

const sent = (method: string, path: string) =>
  requests.find((r) => r.method === method && r.path === path);

describe("Deleting backtests (D60)", () => {
  it("deletes a backtest from its page after a confirm and returns to the list", async () => {
    renderApp("/backtests/run_001");
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("Delete VWAP Intraday v1 Backtest and all its versions?"),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(sent("DELETE", "/api/v1/backtests/run_001?scope=all")).toBeDefined(),
    );
    expect(await screen.findByRole("link", { name: "Run backtest" })).toBeInTheDocument();
  });

  it("offers no Delete for a running run", async () => {
    renderApp("/backtests/run_003");
    await screen.findByRole("meter", { name: "Progress" });
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("deletes the selected backtests from the list", async () => {
    renderApp("/backtests");
    const table = await screen.findByRole("table", { name: "Backtests" });
    for (const name of ["VWAP Intraday v1 Backtest", "SMA Breakout Legacy Run"]) {
      const row = (await within(table).findByRole("link", { name })).closest("tr")!;
      fireEvent.click(within(row).getByRole("checkbox"));
    }
    fireEvent.click(screen.getByRole("button", { name: "Delete selected (2)" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(sent("POST", "/api/v1/backtests/delete")?.body).toEqual({
        ids: ["run_001", "run_005"],
      }),
    );
    expect(await screen.findByRole("button", { name: "Delete selected (0)" })).toBeDisabled();
  });
});

describe("Backtest versions (D60)", () => {
  it("shows every version with its numbers, and deletes an older one", async () => {
    renderApp("/backtests/run_002");
    const table = await screen.findByRole("table", { name: "Versions" });
    expect(within(table).getByText("v2 (this page)")).toBeInTheDocument();
    const v1 = within(table).getByRole("link", { name: "v1" }).closest("tr")!;
    expect(v1).toHaveTextContent("+0.21%");
    fireEvent.click(within(v1).getByRole("button", { name: "Delete v1" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(sent("DELETE", "/api/v1/backtests/run_006?scope=version")).toBeDefined(),
    );
  });

  it("shows an older version as a summary without trades", async () => {
    renderApp("/backtests/run_006");
    expect(await screen.findByText(/Older version: only the summary is kept/)).toBeInTheDocument();
    expect((await screen.findAllByText("Net P&L")).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Open the newest version" })).toHaveAttribute(
      "href",
      "/backtests/run_002",
    );
    expect(screen.queryByRole("table", { name: "Trades" })).not.toBeInTheDocument();
    const compare = screen.queryAllByRole("link", { name: "Compare" });
    expect(compare.some((a) => a.getAttribute("href")?.startsWith("/compare?runs="))).toBe(false);
  });

  it("Edit pre-fills the form and queues the next version", async () => {
    renderApp("/backtests/run_002");
    fireEvent.click(await screen.findByRole("link", { name: "Edit" }));
    expect(await screen.findByDisplayValue("VWAP Momentum Intraday")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Run name")).toHaveValue("VWAP Intraday v2 Backtest");
    fireEvent.change(screen.getByLabelText("Run name"), { target: { value: "VWAP v3" } });
    fireEvent.click(screen.getByRole("button", { name: "Queue new version" }));
    await waitFor(() =>
      expect(sent("POST", "/api/v1/backtests/run_002/versions")?.body).toMatchObject({
        name: "VWAP v3",
        strategyVersion: 2,
        from: "2026-08-14",
        to: "2026-08-31",
        initialCapitalPaise: 100_000_000,
        benchmark: null,
      }),
    );
    expect(await screen.findByText("Version 3 queued (demo)")).toBeInTheDocument();
  });
});
