import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { errorHandlers, handlers } from "@nova/mocks";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  sessionStorage.clear();
});
afterAll(() => server.close());

describe("Market data page", () => {
  it("shows daily candles and info for the first instrument by default", async () => {
    renderApp("/market-data");
    expect(await screen.findByRole("img", { name: "RELIANCE 1d candles" })).toBeInTheDocument();
    expect(screen.getByText(/60 candles, 29 Jun 2026 to 18 Sep 2026/)).toBeInTheDocument();
    expect(screen.getAllByText("Energy").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3,100.40").length).toBeGreaterThan(0);
  });

  it("switches timeframe through the URL and picks an instrument from the list", async () => {
    const { router } = renderApp("/market-data");
    fireEvent.change(await screen.findByLabelText("Timeframe"), { target: { value: "5m" } });
    expect(await screen.findByText(/75 candles, 18 Sep 2026 09:15 IST/)).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe("?symbol=RELIANCE&tf=5m"));
    fireEvent.click(screen.getAllByRole("link", { name: "TCS" })[0]!);
    expect(await screen.findByRole("img", { name: "TCS 5m candles" })).toBeInTheDocument();
  });

  it("searches and filters the list; symbols without candles show an empty chart", async () => {
    const { router } = renderApp("/market-data");
    await screen.findByRole("img", { name: "RELIANCE 1d candles" });
    fireEvent.change(screen.getByLabelText("Index"), { target: { value: "NIFTY NEXT 50" } });
    expect(screen.queryAllByRole("link", { name: "TCS" })).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "dabur" } });
    fireEvent.click(screen.getAllByRole("link", { name: "DABUR" })[0]!);
    await waitFor(() => expect(router.state.location.search).toBe("?symbol=DABUR&tf=1d"));
    expect(await screen.findByText("No candles")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "DABUR · Dabur India" })).toBeInTheDocument();
    expect(screen.getAllByText("Not in F&O").length).toBeGreaterThan(0);
  });

  it("falls back to the first instrument for an unknown symbol", async () => {
    renderApp("/market-data?symbol=NOPE&tf=1d");
    expect(await screen.findByRole("img", { name: "RELIANCE 1d candles" })).toBeInTheDocument();
  });

  it("shows an error state when the API fails", async () => {
    server.use(...errorHandlers);
    renderApp("/market-data");
    expect(
      (await screen.findAllByRole("button", { name: "Try again" }, { timeout: 4000 })).length,
    ).toBeGreaterThan(0);
  });
});
