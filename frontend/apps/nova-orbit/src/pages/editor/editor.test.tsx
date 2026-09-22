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

  it("shows errors and no toast for an invalid form", async () => {
    renderApp("/strategies/new");
    fireEvent.click(await screen.findByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Enter at least one symbol")).toBeInTheDocument();
    expect(screen.queryByText("Draft saved")).not.toBeInTheDocument();
  });

  it("saves a valid form with a demo toast", async () => {
    renderApp("/strategies/new");
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: "My test" } });
    fireEvent.change(screen.getByLabelText(/^Symbols/), { target: { value: "sbin" } });
    fireEvent.change(screen.getByLabelText(/^Quantity/), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Draft saved")).toBeInTheDocument();
    expect(screen.getByLabelText("Strategy spec JSON").textContent).toContain('"SBIN"');
  });

  it("prefills an existing visual strategy", async () => {
    renderApp("/strategies/stg_001/edit");
    expect(await screen.findByDisplayValue("VWAP Momentum Intraday")).toBeInTheDocument();
    await waitFor(() => expect(rows("Entry rules")).toHaveLength(2));
    expect(screen.getByLabelText("Strategy spec JSON").textContent).toContain('"NIFTY 50"');
  });

  it("points python strategies to the code editor", async () => {
    renderApp("/strategies/stg_002/edit");
    expect(await screen.findByText("Python strategies use the code editor")).toBeInTheDocument();
  });
});
