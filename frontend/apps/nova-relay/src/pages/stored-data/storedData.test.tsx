import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
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

const table = () => screen.getByRole("table", { name: "Stored data" });
const groupButton = (name: string) => within(table()).getByRole("button", { name });

describe("Stored data (D63)", () => {
  it("opens from the menu and groups stocks by index", async () => {
    renderApp("/");
    fireEvent.click((await screen.findAllByRole("link", { name: "Stored data" }))[0]!);
    expect(await within(table()).findByRole("button", { name: "NIFTY BANK" })).toBeInTheDocument();
    fireEvent.click(groupButton("NIFTY 50"));
    fireEvent.click(groupButton("NIFTY BANK"));
    // HDFCBANK is in both indices, so it shows under both groups.
    expect(within(table()).getAllByRole("button", { name: "HDFCBANK" })).toHaveLength(2);
    expect(
      within(table()).getByText(
        "5 stocks · 4 complete · 1 with gaps · 0 partial · 0 no data · 1 missing days",
      ),
    ).toBeInTheDocument();
  });

  it("starts the period on 1 Jan 2020 (D69)", async () => {
    renderApp("/stored-data");
    expect(await screen.findByLabelText("From")).toHaveValue("2020-01-01");
  });

  it("shows every status without grouping, and Only with gaps hides complete rows", async () => {
    renderApp("/stored-data");
    const groupBy = await screen.findByLabelText("Group by");
    fireEvent.change(groupBy, { target: { value: "none" } });
    fireEvent.change(await screen.findByRole("searchbox", { name: "Search stocks" }), {
      target: { value: "" },
    });
    await within(table()).findAllByText("Gaps");
    for (const label of ["Complete", "Gaps", "Partial", "No data"]) {
      expect(within(table()).getAllByText(label).length).toBeGreaterThan(0);
    }
    fireEvent.click(screen.getByRole("checkbox", { name: "Only with gaps" }));
    await waitFor(() => expect(within(table()).queryByText("Complete")).not.toBeInTheDocument());
  });

  it("lists a stock's missing ranges and downloads them", async () => {
    const { router } = renderApp("/stored-data");
    fireEvent.change(await screen.findByLabelText("Group by"), { target: { value: "none" } });
    fireEvent.click(await within(table()).findByRole("button", { name: "RELIANCE" }));
    const dialog = await screen.findByRole("dialog", { name: "RELIANCE: missing days" });
    expect(await within(dialog).findByText("12 Aug – 14 Aug 2026")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Download missing" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/data-jobs/new"));
    expect(router.state.location.state).toMatchObject({ symbols: ["RELIANCE"], timeframe: "1d" });
    expect(await screen.findByText("Stocks (1 chosen)")).toBeInTheDocument();
  });

  it("downloads a group's missing stocks with the chosen period", async () => {
    const { router } = renderApp("/stored-data");
    fireEvent.change(await screen.findByLabelText("From"), { target: { value: "2026-01-01" } });
    fireEvent.click(
      await within(table()).findByRole("button", { name: /Download missing for NIFTY NEXT 50/ }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/data-jobs/new"));
    expect(router.state.location.state).toMatchObject({
      symbols: ["DABUR", "PIDILITIND"],
      from: "2026-01-01",
    });
    expect(await screen.findByText("Stocks (2 chosen)")).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toHaveValue("2026-01-01");
  });
});

describe("New download prefill (D63)", () => {
  it("ignores state that is not a valid download", async () => {
    renderApp({ pathname: "/data-jobs/new", state: { symbols: [], timeframe: "5m" } });
    expect(await screen.findByText("Stocks (0 chosen)")).toBeInTheDocument();
  });

  it("puts index names under Indices", async () => {
    renderApp({
      pathname: "/data-jobs/new",
      state: {
        symbols: ["INFY", "NIFTY 50"],
        timeframe: "1d",
        from: "2021-01-01",
        to: "2026-09-18",
      },
    });
    expect(await screen.findByText("Stocks (1 chosen)")).toBeInTheDocument();
    expect(await screen.findByText("Indices (1 chosen)")).toBeInTheDocument();
  });
});
