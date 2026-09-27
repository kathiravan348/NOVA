import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { setupServer } from "msw/node";
import { handlers, mockStrategies } from "@nova/mocks";
import { StrategyCreateSchema } from "@nova/contracts";
import { renderApp } from "../../test/renderApp";

const server = setupServer(...handlers);
const posted: { path: string; body: unknown }[] = [];
server.events.on("request:start", ({ request }) => {
  if (request.method === "GET") return;
  const path = `${request.method} ${new URL(request.url).pathname}`;
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
  vi.unstubAllEnvs();
  posted.length = 0;
});
afterAll(() => server.close());

const rows = (title: string) =>
  within(screen.getByText(title).closest("div.rounded-lg") as HTMLElement).getAllByRole("listitem");

describe("Strategy editor", () => {
  it("starts with one entry and one exit condition, and adds/removes rows", async () => {
    renderApp("/strategies/new");
    await screen.findByRole("heading", { name: "New strategy" });
    expect(rows("Entry rules")).toHaveLength(1);
    expect(rows("Exit rules")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Remove entry condition 1" })).toBeDisabled();

    fireEvent.click(screen.getAllByRole("button", { name: "Add condition" })[0]!);
    await waitFor(() => expect(rows("Entry rules")).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "Remove entry condition 2" }));
    await waitFor(() => expect(rows("Entry rules")).toHaveLength(1));
  });

  it("shows each indicator's own settings with catalog defaults (D51)", async () => {
    renderApp("/strategies/new");
    await screen.findByRole("heading", { name: "New strategy" });
    const indicator = screen.getAllByLabelText(/^Indicator/)[0]!;
    /** "Label=value" for each text field next to the indicator, without the screen-reader context. */
    const settings = () =>
      within(indicator.closest("div.grid") as HTMLElement)
        .getAllByRole<HTMLInputElement>("textbox")
        .map((box) => `${box.labels?.[0]?.textContent?.split(",")[0]}=${box.value}`);
    expect(within(indicator).getByRole("group", { name: "Momentum" })).toBeInTheDocument();

    fireEvent.change(indicator, { target: { value: "macd_signal" } });
    await waitFor(() =>
      expect(settings()).toEqual(["Fast=12", "Slow=26", "Signal=9", "Bars ago=0", "× multiplier="]),
    );

    fireEvent.change(indicator, { target: { value: "rsi" } });
    await waitFor(() => expect(settings()).toEqual(["Period=14", "Bars ago=0", "× multiplier="]));
  });

  it("shows errors and no toast for an invalid form", async () => {
    renderApp("/strategies/new");
    fireEvent.click(await screen.findByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.queryByText("Draft saved")).not.toBeInTheDocument();
  });

  it("saves a valid form with a demo toast", async () => {
    renderApp("/strategies/new");
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: "My test" } });
    fireEvent.change(screen.getByLabelText(/^Quantity/), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Draft saved")).toBeInTheDocument();
    expect(screen.getByLabelText("Strategy spec JSON").textContent).not.toContain("universe");
    await waitFor(() => expect(posted.map((p) => p.path)).toEqual(["POST /api/v1/strategies"]));
    expect(posted[0]!.body).toMatchObject({ name: "My test", spec: { mode: "visual" } });
  });

  it("saves a new version of an existing strategy and opens it in real mode (D43, D48)", async () => {
    vi.stubEnv("VITE_DATA_MODE", "real");
    const { router } = renderApp("/strategies/stg_001/edit");
    fireEvent.change(await screen.findByDisplayValue("VWAP Momentum Intraday"), {
      target: { value: "VWAP v3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByText("Strategy saved")).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe("/strategies/stg_001"));
    expect(posted.map((p) => p.path)).toEqual([
      "POST /api/v1/strategies/stg_001/versions",
      "PATCH /api/v1/strategies/stg_001",
    ]);
  });

  it("prefills an existing visual strategy", async () => {
    renderApp("/strategies/stg_001/edit");
    expect(await screen.findByDisplayValue("VWAP Momentum Intraday")).toBeInTheDocument();
    await waitFor(() => expect(rows("Entry rules")).toHaveLength(2));
    expect(screen.getByLabelText("Strategy spec JSON").textContent).toContain('"vwap"');
  });

  it("opens the 12-1 momentum rotation mock and saves it unchanged (NOVA-119)", async () => {
    renderApp("/strategies/stg_005/edit");
    expect(await screen.findByDisplayValue("12-1 momentum rotation")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Rotation" })).toBeChecked();
    expect(screen.getByLabelText(/^Rebalance/)).toHaveValue("monthly");
    expect(screen.getByLabelText(/^Hold/)).toHaveValue("10");
    expect(screen.getByLabelText(/^Keep while in top/)).toHaveValue("20");
    expect(screen.getByLabelText(/^Timeframe/)).toBeDisabled();
    expect(screen.queryByText("Portfolio")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Sizing/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(posted).toHaveLength(1));
    const mock = mockStrategies.find((s) => s.id === "stg_005")!;
    const spec = mock.versions.find((v) => v.version === mock.latestVersion)!.spec;
    expect((posted[0]!.body as { spec: unknown }).spec).toEqual(spec);
  });

  it("creates a new rotation strategy with a valid body", async () => {
    renderApp("/strategies/new");
    fireEvent.click(await screen.findByRole("radio", { name: "Rotation" }));
    expect(await screen.findByText("Stocks with the highest score are held.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Momentum" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(StrategyCreateSchema.safeParse(posted[0]!.body).success).toBe(true);
    expect(posted[0]!.body).toMatchObject({
      spec: { mode: "rotation", timeframe: "1d", rotation: { hold: 10, keepWithin: 20 } },
    });
  });

  it("asks before a mode switch that would lose settings, and keeps the name", async () => {
    renderApp("/strategies/stg_004/edit");
    await screen.findByDisplayValue("Turtle 55/20 (ranked)");
    fireEvent.click(screen.getByRole("radio", { name: "Rotation" }));

    const dialog = await screen.findByRole("dialog", { name: "Switch to Rotation?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(screen.getByRole("radio", { name: "Visual rules" })).toBeChecked());

    fireEvent.click(screen.getByRole("radio", { name: "Rotation" }));
    fireEvent.click(await screen.findByRole("button", { name: "Switch" }));
    expect(await screen.findByLabelText(/^Keep while in top/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Turtle 55/20 (ranked)")).toBeInTheDocument();
  });

  it("opens a python strategy in python mode with its code", async () => {
    renderApp("/strategies/stg_002/edit");
    const code = await screen.findByLabelText("Strategy code");
    expect(code.textContent).toContain("def on_candle(candle):");
    expect(screen.getByRole("radio", { name: "Python" })).toBeChecked();
    expect(screen.queryByText("Entry rules")).not.toBeInTheDocument();
  });

  it("switches a new strategy to python with a template", async () => {
    renderApp("/strategies/new");
    fireEvent.click(await screen.findByRole("radio", { name: "Python" }));
    const code = await screen.findByLabelText("Strategy code");
    expect(code.textContent).toContain("def on_bar(self, ctx):");
    expect(screen.queryByText("Entry rules")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Visual rules" }));
    expect(await screen.findByText("Entry rules")).toBeInTheDocument();
  });

  it("requires code in python mode", async () => {
    renderApp("/strategies/stg_002/edit");
    await screen.findByLabelText("Strategy code");
    const view = EditorView.findFromDOM(screen.getByTestId("code-editor"))!;
    act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "" } }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Code is required")).toBeInTheDocument();
    expect(screen.queryByText("Draft saved")).not.toBeInTheDocument();
  });

  it("shows python code read-only on the detail page", async () => {
    renderApp("/strategies/stg_002");
    const code = await screen.findByLabelText("Strategy code");
    expect(code).toHaveAttribute("contenteditable", "false");
    expect(code.textContent).toContain("Order.buy()");
  });

  it("shows the cost averaging fields when switched on (D53)", async () => {
    renderApp("/strategies/new");
    const toggle = await screen.findByRole("switch", { name: /Cost averaging/ });
    expect(screen.queryByLabelText(/^Add every/)).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(await screen.findByLabelText(/^Add every/)).toHaveValue("5");
    expect(screen.getByLabelText(/^Max extra buys/)).toHaveValue("3");
  });

  it("saves the ranked Turtle mock unchanged, with every D62 card filled (NOVA-118)", async () => {
    renderApp("/strategies/stg_004/edit");
    expect(await screen.findByDisplayValue("Turtle 55/20 (ranked)")).toBeInTheDocument();
    for (const title of ["Exits", "Portfolio", "Market filter"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    expect(screen.getByLabelText(/^Trailing stop/)).toHaveValue("15");
    expect(screen.getByRole("switch", { name: /ATR stop/ })).toBeChecked();
    expect(screen.getByLabelText(/^Max positions/)).toHaveValue("10");
    expect(screen.getByRole("switch", { name: /Use a market filter/ })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(posted).toHaveLength(1));
    const turtle = mockStrategies.find((s) => s.id === "stg_004")!;
    const spec = turtle.versions.find((v) => v.version === turtle.latestVersion)!.spec;
    expect((posted[0]!.body as { spec: unknown }).spec).toEqual(spec);
  });

  it("checks the new fields and keeps Save off until they are fixed", async () => {
    renderApp("/strategies/new");
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: "Checks" } });
    fireEvent.change(screen.getByLabelText(/^Quantity/), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/^Trailing stop/), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText(/^Exit after N bars/), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText(/^Max positions/), { target: { value: "101" } });
    const save = screen.getByRole("button", { name: "Save draft" });
    fireEvent.click(save);

    expect(await screen.findByText("Leave empty, or above 0 and at most 50")).toBeInTheDocument();
    expect(screen.getByText("Leave empty or a whole number from 1 to 5000")).toBeInTheDocument();
    expect(screen.getByText("Leave empty or a whole number from 1 to 100")).toBeInTheDocument();
    await waitFor(() => expect(save).toBeDisabled());

    fireEvent.change(screen.getByLabelText(/^Trailing stop/), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/^Exit after N bars/), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/^Max positions/), { target: { value: "" } });
    await waitFor(() => expect(save).toBeEnabled());
  });

  it("switches the market filter on with NIFTY 50 above SMA(200), no new buys", async () => {
    renderApp("/strategies/new");
    fireEvent.click(await screen.findByRole("switch", { name: /Use a market filter/ }));

    expect(await screen.findByLabelText(/^When the filter fails/)).toHaveValue("no_new_entries");
    expect(screen.getAllByLabelText(/^Period, market filter/)[0]).toHaveValue("200");
  });
});
