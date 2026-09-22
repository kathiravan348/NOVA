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
  it("shows daily candles for the first instrument by default", async () => {
    renderApp("/market-data");
    expect(await screen.findByRole("img", { name: "RELIANCE 1d candles" })).toBeInTheDocument();
    expect(screen.getByText(/60 candles, 29 Jun 2026 to 18 Sep 2026/)).toBeInTheDocument();
  });

  it("switches timeframe and instrument through the URL", async () => {
    const { router } = renderApp("/market-data");
    fireEvent.change(await screen.findByLabelText("Timeframe"), { target: { value: "5m" } });
    expect(await screen.findByText(/75 candles, 18 Sep 2026 09:15 IST/)).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toBe("?symbol=RELIANCE&tf=5m"));
    fireEvent.change(screen.getByLabelText("Instrument"), { target: { value: "TCS" } });
    expect(await screen.findByRole("img", { name: "TCS 5m candles" })).toBeInTheDocument();
  });

  it("falls back to the first instrument for an unknown symbol", async () => {
    renderApp("/market-data?symbol=NOPE&tf=1d");
    expect(await screen.findByRole("img", { name: "RELIANCE 1d candles" })).toBeInTheDocument();
  });

  it("shows an error state when the API fails", async () => {
    server.use(...errorHandlers);
    renderApp("/market-data");
    expect(
      await screen.findByRole("button", { name: "Try again" }, { timeout: 4000 }),
    ).toBeInTheDocument();
  });
});
