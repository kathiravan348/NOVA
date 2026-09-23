import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable } from "./DataTable";
import { fileColumns, fileSearchText, sampleFiles, type FileItem } from "./storyData";

describe("DataTable", () => {
  it("renders caption, headers and first page rows", () => {
    render(
      <DataTable<FileItem>
        caption="Project files table"
        columns={fileColumns}
        data={sampleFiles}
        pageSize={10}
      />,
    );

    // Caption exists
    expect(screen.getByText("Project files table")).toBeInTheDocument();

    // Headers exist
    expect(screen.getByRole("columnheader", { name: /name/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /owner/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /type/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /size/i })).toBeInTheDocument();

    // First page row is rendered, 11th row is not rendered in table
    expect(screen.getAllByText(sampleFiles[0]!.name)[0]).toBeInTheDocument();
    expect(screen.queryByText(sampleFiles[10]!.name)).not.toBeInTheDocument();
  });

  it("clicking a header sorts and updates aria-sort attribute", () => {
    render(
      <DataTable<FileItem>
        caption="Sortable files"
        columns={fileColumns}
        data={sampleFiles}
        pageSize={10}
      />,
    );

    const nameTh = screen.getByRole("columnheader", { name: /name/i });
    expect(nameTh).toHaveAttribute("aria-sort", "none");

    const sortButton = screen.getByRole("button", { name: /name/i });
    fireEvent.click(sortButton);
    expect(nameTh).toHaveAttribute("aria-sort", "ascending");

    fireEvent.click(sortButton);
    expect(nameTh).toHaveAttribute("aria-sort", "descending");
  });

  it("sort buttons have a visible focus ring and sorting resets to page 1", () => {
    render(
      <DataTable<FileItem>
        caption="Reset files"
        columns={fileColumns}
        data={sampleFiles}
        pageSize={10}
      />,
    );

    const sortButton = screen.getByRole("button", { name: /name/i });
    expect(sortButton.className).toContain("focus-visible:ring-action");

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText(/Showing 11–20/)).toBeInTheDocument();
    fireEvent.click(sortButton);
    expect(screen.getByText(/Showing 1–10/)).toBeInTheDocument();
  });

  it("next and previous page buttons change page and pagination indicator text", () => {
    render(
      <DataTable<FileItem>
        caption="Paginated files"
        columns={fileColumns}
        data={sampleFiles}
        pageSize={10}
      />,
    );

    expect(screen.getByText("Showing 1–10 of 25")).toBeInTheDocument();

    const nextButton = screen.getByRole("button", { name: "Next page" });
    const prevButton = screen.getByRole("button", { name: "Previous page" });

    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);

    expect(screen.getByText("Showing 11–20 of 25")).toBeInTheDocument();
    expect(prevButton).not.toBeDisabled();
    expect(screen.getAllByText(sampleFiles[10]!.name)[0]).toBeInTheDocument();

    fireEvent.click(prevButton);
    expect(screen.getByText("Showing 1–10 of 25")).toBeInTheDocument();
  });

  it("renders loading, error, and empty states while keeping headers visible", () => {
    const { rerender } = render(
      <DataTable<FileItem>
        caption="Loading files"
        columns={fileColumns}
        data={[]}
        loading={true}
      />,
    );

    // Headers still visible in loading state
    expect(screen.getByRole("columnheader", { name: /name/i })).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);

    // Error state
    rerender(
      <DataTable<FileItem>
        caption="Error files"
        columns={fileColumns}
        data={[]}
        error="Server error loading files"
      />,
    );
    expect(screen.getByRole("columnheader", { name: /name/i })).toBeInTheDocument();
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Server error loading files");

    // Empty state
    rerender(
      <DataTable<FileItem>
        caption="Empty files"
        columns={fileColumns}
        data={[]}
        emptyState="No documents available"
      />,
    );
    expect(screen.getByRole("columnheader", { name: /name/i })).toBeInTheDocument();
    expect(screen.getAllByText("No documents available")[0]).toBeInTheDocument();
  });

  it("right aligns numeric column cells and headers", () => {
    render(
      <DataTable<FileItem>
        caption="Numeric files"
        columns={fileColumns}
        data={sampleFiles.slice(0, 3)}
      />,
    );

    const sizeTh = screen.getByRole("columnheader", { name: /size/i });
    expect(sizeTh).toHaveClass("text-right");

    const tableRows = screen.getAllByRole("row");
    // Row 0 is the thead row, row 1 is the first data row
    const firstDataCells = tableRows[1]!.querySelectorAll("td");
    // Column 3 is sizeKb
    expect(firstDataCells[3]!).toHaveClass("text-right");
    expect(firstDataCells[3]!).toHaveClass("font-mono");
  });

  it("cards view displays mobileLabel for each column", () => {
    render(
      <DataTable<FileItem>
        caption="Mobile view files"
        columns={fileColumns}
        data={sampleFiles.slice(0, 2)}
      />,
    );

    expect(screen.getAllByText("File Type")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Size")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Last Updated")[0]).toBeInTheDocument();
  });

  describe("selection and search", () => {
    function Harness(props: {
      initial?: string[];
      isRowSelectable?: (row: FileItem) => boolean;
    }): React.ReactElement {
      const [selected, setSelected] = React.useState<string[]>(props.initial ?? []);
      return (
        <>
          <output data-testid="selected">{selected.join(",")}</output>
          <DataTable<FileItem>
            caption="Selectable files"
            columns={fileColumns}
            data={sampleFiles}
            pageSize={10}
            getRowId={(row) => row.id}
            selectedIds={selected}
            onSelectedIdsChange={setSelected}
            isRowSelectable={props.isRowSelectable}
            search={{ label: "Search files", getText: fileSearchText }}
          />
        </>
      );
    }
    const selectedText = (): string => screen.getByTestId("selected").textContent ?? "";
    // Desktop table and mobile cards both render in jsdom; [0] is the table.
    const rowBox = (id: string): HTMLElement =>
      screen.getAllByRole("checkbox", { name: `Select ${id}` })[0]!;
    const allBox = (): HTMLElement => screen.getByRole("checkbox", { name: "Select all shown" });

    it("selects a row and shows the count", () => {
      render(<Harness />);
      fireEvent.click(rowBox("file-1"));
      expect(selectedText()).toBe("file-1");
      expect(rowBox("file-1")).toHaveAttribute("data-state", "checked");
      expect(screen.getByText("selected")).toHaveTextContent("1 selected");
    });

    it("keeps the same checkbox node and focus after toggling", () => {
      render(<Harness />);
      const box = rowBox("file-1");
      box.focus();
      fireEvent.click(box);
      expect(rowBox("file-1")).toBe(box);
      expect(document.activeElement).toBe(box);
      fireEvent.click(rowBox("file-2"));
      expect(selectedText()).toBe("file-1,file-2");
    });

    it("header is indeterminate when some shown rows are selected", () => {
      render(<Harness initial={["file-3"]} />);
      expect(allBox()).toHaveAttribute("data-state", "indeterminate");
    });

    it("select all shown takes only filtered, selectable rows and keeps other ids", () => {
      render(<Harness initial={["file-2"]} isRowSelectable={(row) => row.type !== "PDF"} />);
      fireEvent.change(screen.getByLabelText("Search files"), { target: { value: "Rohan" } });
      fireEvent.click(allBox());
      const ids = selectedText().split(",");
      const rohanSelectable = sampleFiles
        .filter((f) => f.owner === "Rohan" && f.type !== "PDF")
        .map((f) => f.id);
      expect(ids).toEqual(expect.arrayContaining(["file-2", ...rohanSelectable]));
      expect(ids).toHaveLength(1 + rohanSelectable.length);
      expect(allBox()).toHaveAttribute("data-state", "checked");
      fireEvent.click(allBox());
      expect(selectedText()).toBe("file-2");
    });

    it("unselectable rows show a disabled checkbox", () => {
      render(<Harness isRowSelectable={(row) => row.type !== "PDF"} />);
      expect(rowBox("file-1")).toBeDisabled();
      expect(rowBox("file-2")).not.toBeDisabled();
    });

    it("search filters rows, resets to page 1 and shows no-match text", () => {
      render(<Harness />);
      fireEvent.click(screen.getByRole("button", { name: "Next page" }));
      expect(screen.getByText(/Showing 11–20/)).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Search files"), { target: { value: "_v1." } });
      expect(screen.getAllByText(sampleFiles[0]!.name)[0]).toBeInTheDocument();
      expect(screen.queryByText(sampleFiles[1]!.name)).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Search files"), { target: { value: "zzz" } });
      expect(screen.getAllByText('No rows match "zzz"')[0]).toBeInTheDocument();
    });

    it("cards view has a checkbox per row", () => {
      render(<Harness />);
      const cards = screen.getByRole("list", { name: "Selectable files" });
      const box = cards.querySelector<HTMLElement>('[role="checkbox"]');
      expect(box).not.toBeNull();
      fireEvent.click(box!);
      expect(selectedText()).toBe("file-1");
    });
  });
});
