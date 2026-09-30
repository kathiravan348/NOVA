import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Pager, type PagerProps } from "./Pager";

const defaults: PagerProps = {
  page: 1,
  pageSize: 50,
  total: 1240,
  onPageChange: () => undefined,
  onPageSizeChange: () => undefined,
};

describe("Pager", () => {
  it.each([
    [25, 50],
    [50, 25],
    [100, 13],
    [200, 7],
  ])("shows the range and page count at size %i", (pageSize, pages) => {
    render(<Pager {...defaults} pageSize={pageSize} />);
    expect(screen.getByRole("status")).toHaveTextContent(`Showing 1–${pageSize} of 1,240 entries`);
    expect(screen.getByText(`Page 1 of ${pages}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
  });

  it("navigates from a middle page and caps the last range at total", () => {
    const onPageChange = vi.fn();
    const { rerender } = render(<Pager {...defaults} page={3} onPageChange={onPageChange} />);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 101–150 of 1,240 entries");
    for (const [name, page] of [
      ["First page", 1],
      ["Previous page", 2],
      ["Next page", 4],
      ["Last page", 25],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name }));
      expect(onPageChange).toHaveBeenLastCalledWith(page);
    }
    rerender(<Pager {...defaults} page={25} />);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1,201–1,240 of 1,240 entries");
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Last page" })).toBeDisabled();
  });

  it("jumps only on Enter and clamps high, low and fractional input", () => {
    const onPageChange = vi.fn();
    render(<Pager {...defaults} page={3} onPageChange={onPageChange} />);
    const input = screen.getByRole("spinbutton", { name: "Jump to page" });
    for (const [value, page] of [
      ["7", 7],
      ["999", 25],
      ["0", 1],
      ["-2", 1],
      ["4.5", 4],
    ] as const) {
      fireEvent.change(input, { target: { value } });
      const calls = onPageChange.mock.calls.length;
      fireEvent.keyDown(input, { key: "ArrowRight" });
      expect(onPageChange).toHaveBeenCalledTimes(calls);
      fireEvent.keyDown(input, { key: "Enter" });
      expect(onPageChange).toHaveBeenLastCalledWith(page);
      expect(input).toHaveValue(page);
    }
    onPageChange.mockClear();
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPageChange).not.toHaveBeenCalled();
    expect(input).toHaveValue(3);
  });

  it("changes the size and resets the controlled page to 1", () => {
    function Harness() {
      const [page, setPage] = React.useState(3);
      const [pageSize, setPageSize] = React.useState(50);
      return (
        <Pager
          {...defaults}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      );
    }
    render(<Harness />);
    const select = screen.getByRole("combobox", { name: "Rows per page" });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "25",
      "50",
      "100",
      "200",
    ]);
    fireEvent.change(select, { target: { value: "100" } });
    expect(select).toHaveValue("100");
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1–100 of 1,240 entries");
    expect(screen.getByRole("spinbutton")).toHaveValue(1);
  });

  it("keeps a custom current size available and follows controlled changes", () => {
    const { rerender } = render(<Pager {...defaults} pageSize={10} pageSizes={[10, 25]} />);
    expect(screen.getByRole("combobox")).toHaveValue("10");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    rerender(<Pager {...defaults} page={2} pageSize={25} />);
    expect(screen.getByRole("spinbutton")).toHaveValue(2);
    rerender(<Pager {...defaults} page={2} total={12} />);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1–12 of 12 entries");
    expect(screen.getByRole("spinbutton")).toHaveValue(1);
  });

  it.each([0, 12])("handles %i entries", (total) => {
    render(<Pager {...defaults} total={total} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      total === 0 ? "No entries" : "Showing 1–12 of 12 entries",
    );
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    if (total === 0) {
      expect(screen.getByRole("spinbutton")).toBeDisabled();
      expect(screen.getByRole("combobox")).toBeDisabled();
      expect(screen.getByText("Page 0 of 0")).toBeInTheDocument();
    } else {
      expect(screen.getByRole("spinbutton")).not.toBeDisabled();
      expect(screen.getByRole("combobox")).not.toBeDisabled();
    }
  });

  it("disables every control while loading", () => {
    render(<Pager {...defaults} page={3} loading />);
    expect(screen.getByRole("navigation")).toHaveAttribute("aria-busy", "true");
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByRole("spinbutton")).toBeDisabled();
  });
});
