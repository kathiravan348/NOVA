import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { setupServer } from "msw/node";
import { handlers } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";
import { loadMyList } from "../../lib/myList";

const server = setupServer(...handlers);
const KEY = "relay.live.myList";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
  localStorage.clear();
});
afterAll(() => server.close());

const cardTitles = () => screen.queryAllByRole("heading", { level: 3 }).map((h) => h.textContent);

describe("Monitor search and My list (D78)", () => {
  it("search filters the cards by symbol or name", async () => {
    renderApp("/live/monitor");
    fireEvent.change(await screen.findByLabelText("Stocks"), { target: { value: "NIFTY 50" } });
    await screen.findByRole("heading", { name: "TCS" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search stocks" }), {
      target: { value: "rel" },
    });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "TCS" })).toBeNull());
    expect(screen.getByRole("heading", { name: "RELIANCE" })).toBeInTheDocument();
  });

  it("says so when nothing matches", async () => {
    renderApp("/live/monitor");
    fireEvent.change(await screen.findByLabelText("Stocks"), { target: { value: "NIFTY 50" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search stocks" }), {
      target: { value: "zzzz" },
    });
    expect(await screen.findByText("No stock matches “zzzz”")).toBeInTheDocument();
  });

  it("picks stocks into My list, shows only them, and keeps them after a reload", async () => {
    renderApp("/live/monitor");
    fireEvent.click(await screen.findByRole("button", { name: "Pick stocks" }));
    const dialog = await screen.findByRole("dialog", { name: "My list" });
    const table = await within(dialog).findByRole("table", { name: "Stocks in my list" });
    for (const symbol of ["TCS", "INFY"]) {
      fireEvent.change(within(dialog).getByRole("searchbox", { name: "Search stocks" }), {
        target: { value: symbol },
      });
      const row = (await within(table).findByText(symbol)).closest("tr")!;
      fireEvent.click(within(row).getByRole("checkbox"));
    }
    fireEvent.click(within(dialog).getByRole("button", { name: "Save list" }));
    expect(await screen.findByText("My list saved (2 stocks)")).toBeInTheDocument();
    expect(screen.getByLabelText("Stocks")).toHaveValue("mylist");
    expect(screen.getByRole("option", { name: "My list (2)" })).toBeInTheDocument();
    await waitFor(() => expect(cardTitles().sort()).toEqual(["INFY", "TCS"]));
    expect(loadMyList()).toEqual(["INFY", "TCS"]);

    cleanup();
    renderApp("/live/monitor");
    expect(await screen.findByRole("option", { name: "My list (2)" })).toBeInTheDocument();
  });

  it("says recording is off once prices have loaded and none exist", async () => {
    localStorage.setItem(KEY, JSON.stringify(["DMART"])); // no mock ticks; demo recorder is off
    renderApp("/live/monitor");
    fireEvent.change(await screen.findByLabelText("Stocks"), { target: { value: "mylist" } });
    expect(await screen.findByText("Recording is off")).toBeInTheDocument();
  });

  it("shows an empty My list, and survives a broken saved value", async () => {
    localStorage.setItem(KEY, "{not json");
    renderApp("/live/monitor");
    fireEvent.change(await screen.findByLabelText("Stocks"), { target: { value: "mylist" } });
    expect(await screen.findByText("Your list is empty")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "My list (0)" })).toBeInTheDocument();
  });
});
