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

const table = () => screen.findByRole("table", { name: "Stock list" });

describe("Instruments", () => {
  it("lists the stocks with their Kite status", async () => {
    renderApp("/instruments");
    const list = await table();
    expect(await within(list).findByText("INFY")).toBeInTheDocument();
    expect(within(list).getAllByText("Synced").length).toBeGreaterThan(0);
  });

  it("checks the symbol before adding a stock", async () => {
    renderApp("/instruments");
    await table();
    fireEvent.click(screen.getByRole("button", { name: "Add stock" }));
    const dialog = await screen.findByRole("dialog", { name: "Add stock" });
    fireEvent.change(within(dialog).getByLabelText(/Symbol/), { target: { value: "BAD SYMBOL" } });
    fireEvent.change(within(dialog).getByLabelText(/Name/), { target: { value: "Bad" } });
    fireEvent.change(within(dialog).getByLabelText(/Sector/), { target: { value: "Energy" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add stock" }));
    expect(
      await within(dialog).findByText("1–20 capital letters, digits, & or -"),
    ).toBeInTheDocument();
  });

  it("adds a stock, or shows the server's duplicate message", async () => {
    renderApp("/instruments");
    await table();
    fireEvent.click(screen.getByRole("button", { name: "Add stock" }));
    const dialog = await screen.findByRole("dialog", { name: "Add stock" });
    fireEvent.change(within(dialog).getByLabelText(/Symbol/), { target: { value: "infy" } });
    fireEvent.change(within(dialog).getByLabelText(/Name/), { target: { value: "Infosys" } });
    fireEvent.change(within(dialog).getByLabelText(/Sector/), { target: { value: "IT" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add stock" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "INFY is already in the stock list",
    );
    fireEvent.change(within(dialog).getByLabelText(/Symbol/), { target: { value: "M&M" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add stock" }));
    expect(await screen.findByText("Stock added (demo)")).toBeInTheDocument();
  });

  it("edits a stock with its symbol read-only", async () => {
    renderApp("/instruments");
    await within(await table()).findByText("INFY");
    fireEvent.click(screen.getAllByRole("button", { name: "Edit INFY" })[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Edit INFY" });
    expect(within(dialog).getByLabelText(/Symbol/)).toHaveAttribute("readonly");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Stock updated (demo)")).toBeInTheDocument();
  });

  it("asks before removing a stock", async () => {
    renderApp("/instruments");
    await within(await table()).findByText("INFY");
    fireEvent.click(screen.getAllByRole("button", { name: "Remove INFY" })[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Remove INFY from the list?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    expect(await screen.findByText("Stock removed (demo)")).toBeInTheDocument();
  });

  it("shows the last sync and queues a new one", async () => {
    renderApp("/instruments");
    expect(
      await screen.findByText("26 stocks synced; 2 new listing(s): GREENGRID-SM, NOVATECH"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Last synced/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sync with Kite" }));
    expect(await screen.findByText("Sync with Kite queued (demo)")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Syncing…" })).toBeDisabled();
  });

  it("shows why a sync failed", async () => {
    server.use(
      http.post("*/api/v1/market-data/instruments/sync", () =>
        HttpResponse.json(
          { error: { code: "invalid_request", message: "A sync is already waiting or running" } },
          { status: 400 },
        ),
      ),
    );
    renderApp("/instruments");
    fireEvent.click(await screen.findByRole("button", { name: "Sync with Kite" }));
    expect(await screen.findByText("A sync is already waiting or running")).toBeInTheDocument();
  });

  it("filters by index", async () => {
    renderApp("/instruments");
    const list = await table();
    await within(list).findByText("INFY");
    const select = await screen.findByLabelText("Index");
    await within(select).findByRole("option", { name: /^NIFTY BANK \(/ });
    fireEvent.change(select, { target: { value: "NIFTY BANK" } });
    expect(await within(await table()).findByText("HDFCBANK")).toBeInTheDocument();
    expect(within(await table()).queryByText("INFY")).not.toBeInTheDocument();
  });

  it("lists new listings and marks one as seen", async () => {
    renderApp("/instruments");
    const tab = await screen.findByRole("tab", { name: "New listings (2)" });
    fireEvent.mouseDown(tab);
    fireEvent.click(tab);
    const list = await screen.findByRole("table", { name: "New listings" });
    expect(within(list).getByText("NOVATECH")).toBeInTheDocument();
    expect(within(list).getAllByText("New")).toHaveLength(2);
    fireEvent.click(within(list).getByRole("button", { name: "Mark NOVATECH as seen" }));
    expect(await screen.findByText("NOVATECH marked as seen (demo)")).toBeInTheDocument();
  });

  it("offers every known index when editing", async () => {
    renderApp("/instruments");
    const list = await table();
    fireEvent.click(await within(list).findByRole("button", { name: "Edit INFY" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit INFY" });
    expect(
      await within(dialog).findByRole("checkbox", { name: "NIFTY MIDCAP 100" }),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByRole("checkbox")).toHaveLength(19);
  });
});
