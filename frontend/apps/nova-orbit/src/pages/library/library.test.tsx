import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { handlers, mockStrategies, mockStrategyLibrary } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);
const posted: { path: string; body: unknown }[] = [];
server.events.on("request:start", ({ request }) => {
  if (request.method !== "POST") return;
  const path = new URL(request.url).pathname;
  void request
    .clone()
    .json()
    .then((body) => posted.push({ path, body }));
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
  posted.length = 0;
});
afterAll(() => server.close());

/** The mock strategies plus one named like a library entry, so it counts as added. */
function alreadyHave(name: string, id = "stg_005") {
  const strategies = mockStrategies.map((s) => (s.id === id ? { ...s, name } : s));
  server.use(http.get("*/api/v1/strategies", () => HttpResponse.json(strategies)));
}

const installs = () => posted.filter((p) => p.path.endsWith("/strategies/library/install"));
/** The table's button (the DataTable also renders stacked cards for phones). */
const button = async (name: string) => (await screen.findAllByRole("button", { name }))[0]!;

describe("Library page (NOVA-122)", () => {
  it("lists the entries in one card per family with their ideas", async () => {
    renderApp("/library");
    const tables = await screen.findAllByRole("table");
    expect(tables).toHaveLength(7);
    for (const family of mockStrategyLibrary.families) {
      expect(screen.getByRole("table", { name: family.name })).toBeInTheDocument();
      expect(screen.getByText(family.idea)).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute("href", "/library");
  });

  it("adds one strategy with a toast and an Added badge", async () => {
    renderApp("/library");
    fireEvent.click(await button("Add 12-1 momentum"));

    expect(await screen.findByText("Added 1 strategy")).toBeInTheDocument();
    await waitFor(async () => expect(await button("Add 12-1 momentum")).toBeDisabled());
    const row = (await button("Add 12-1 momentum")).closest("tr")!;
    expect(within(row).getAllByText("Added").length).toBeGreaterThan(0);
    expect(installs().map((p) => p.body)).toEqual([{ ids: ["A01"] }]);
  });

  it("adds all after a confirm, skipping strategies already there by name", async () => {
    alreadyHave("Turtle 55/20");
    renderApp("/library");
    expect(await button("Add Turtle 55/20")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Add all" }));
    const dialog = await screen.findByRole("dialog", { name: "Add all 7 as draft strategies?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add 6 strategies" }));

    expect(await screen.findByText("Added 6 strategies")).toBeInTheDocument();
    const ids = (installs()[0]!.body as { ids: string[] }).ids;
    expect(ids).toHaveLength(6);
    expect(ids).not.toContain("B01");
  });

  it("opens the run form filled with the suggested backtest", async () => {
    alreadyHave("12-1 momentum");
    const { router } = renderApp("/library");
    fireEvent.click(await button("Backtest 12-1 momentum"));

    await waitFor(() => expect(router.state.location.pathname).toBe("/backtests/new"));
    expect(await screen.findByLabelText(/^Run name/)).toHaveValue("12-1 momentum — v1 in-sample");
    expect(screen.getByLabelText(/^Strategy/)).toHaveValue("stg_005");
    expect(screen.getByLabelText(/^Index/)).toHaveValue("NIFTY 100");
    expect(screen.getByLabelText(/^Initial capital/)).toHaveValue("1000000");
    expect(screen.getByLabelText("Benchmark")).toHaveValue("NIFTY 50");
    expect(installs()).toHaveLength(0); // already there: nothing is added
    const search = new URLSearchParams(router.state.location.search);
    expect([search.get("from"), search.get("to")]).toEqual(["2021-10-01", "2024-09-30"]);
  });

  it("filters by family and search", async () => {
    renderApp("/library");
    await screen.findAllByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "G — Intraday, 15-minute (MIS, testing)" }));
    expect(screen.getAllByRole("table")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.change(screen.getByLabelText(/^Search/), { target: { value: "nothing like it" } });
    expect(await screen.findByText("No strategy matches")).toBeInTheDocument();
  });
});
