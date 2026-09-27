import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable } from "./DataTable";
import type { DataTableGroups } from "./DataTableGroups";
import { fruitColumns, fruitSearchText, sampleFruits, type Fruit } from "./storyData";

const summaries: Record<string, string[]> = {};
const byColour = (defaultOpen = false): DataTableGroups<Fruit> => ({
  of: (fruit) => fruit.colours,
  summary: (key, rows) => {
    summaries[key] = rows.map((f) => f.name);
    return `${rows.length} fruits`;
  },
  actions: (key) => <button type="button">Order {key}</button>,
  defaultOpen,
});

const renderGrouped = (groups: DataTableGroups<Fruit>, extra = {}) =>
  render(
    <DataTable<Fruit>
      caption="Fruit"
      columns={fruitColumns}
      data={sampleFruits}
      groups={groups}
      {...extra}
    />,
  );

const desktop = () => screen.getByRole("table");
const groupButton = (name: string) => within(desktop()).getByRole("button", { name });

describe("DataTable groups (D63)", () => {
  it("shows one closed header per group, in order, with summary and actions", () => {
    renderGrouped(byColour());
    const headers = within(desktop()).getAllByRole("button", { expanded: false });
    expect(headers.map((b) => b.textContent)).toEqual(["Green", "Purple", "Red", "Yellow"]);
    expect(within(desktop()).getAllByText("2 fruits")).toHaveLength(3); // Green, Red, Yellow
    expect(within(desktop()).getByRole("button", { name: "Order Red" })).toBeInTheDocument();
    expect(within(desktop()).queryByText("Cherry")).not.toBeInTheDocument();
  });

  it("puts a row in every group it belongs to, and toggles by click", () => {
    renderGrouped(byColour());
    fireEvent.click(groupButton("Red"));
    fireEvent.click(groupButton("Green"));
    expect(groupButton("Red")).toHaveAttribute("aria-expanded", "true");
    expect(within(desktop()).getAllByText("Apple")).toHaveLength(2);
    fireEvent.click(groupButton("Red"));
    expect(within(desktop()).getAllByText("Apple")).toHaveLength(1);
    expect(within(desktop()).queryByText("Cherry")).not.toBeInTheDocument();
  });

  it("does not paginate and sorts inside groups", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      id: `f${i}`,
      name: `Fruit ${String(i).padStart(2, "0")}`,
      colours: ["Red"],
      stock: i,
    }));
    render(
      <DataTable<Fruit>
        caption="Many"
        columns={fruitColumns}
        data={many}
        groups={byColour(true)}
        initialSort={[{ id: "stock", desc: true }]}
      />,
    );
    const rows = within(desktop()).getAllByRole("row").slice(2); // header row, group header
    expect(rows).toHaveLength(15);
    expect(rows[0]).toHaveTextContent("Fruit 14");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("filters rows, hides empty groups and gives summaries the filtered rows", () => {
    renderGrouped(byColour(true), { search: { label: "Search fruit", getText: fruitSearchText } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search fruit" }), {
      target: { value: "apple" },
    });
    const headers = within(desktop()).getAllByRole("button", { expanded: true });
    expect(headers.map((b) => b.textContent)).toEqual(["Green", "Red"]);
    expect(summaries["Green"]).toEqual(["Apple"]);
  });

  it("shows the empty state when no row is in any group", () => {
    render(
      <DataTable<Fruit>
        caption="Empty"
        columns={fruitColumns}
        data={[{ id: "x", name: "Mystery", colours: [], stock: 1 }]}
        groups={byColour()}
        emptyState="No fruit yet"
      />,
    );
    expect(screen.getAllByText("No fruit yet").length).toBeGreaterThan(0);
  });
});
