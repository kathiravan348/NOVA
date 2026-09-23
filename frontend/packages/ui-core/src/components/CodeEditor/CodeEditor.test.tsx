import * as React from "react";
import { render, screen } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { describe, expect, it, vi } from "vitest";
import { CodeEditor } from "./CodeEditor";

const viewOf = () => EditorView.findFromDOM(screen.getByTestId("code-editor"))!;

describe("CodeEditor", () => {
  it("shows the code with an accessible label", () => {
    render(<CodeEditor value={"x = 1\nprint(x)"} ariaLabel="Strategy code" />);
    const content = screen.getByLabelText("Strategy code");
    expect(content).toHaveAttribute("contenteditable", "true");
    expect(content.textContent).toContain("print(x)");
  });

  it("reports edits through onChange", () => {
    const onChange = vi.fn();
    render(<CodeEditor value="a = 1" onChange={onChange} ariaLabel="Code" />);
    const view = viewOf();
    view.dispatch({ changes: { from: view.state.doc.length, insert: "\nb = 2" } });
    expect(onChange).toHaveBeenLastCalledWith("a = 1\nb = 2");
  });

  it("syncs a new value from props", () => {
    const { rerender } = render(<CodeEditor value="old" ariaLabel="Code" />);
    rerender(<CodeEditor value="new" ariaLabel="Code" />);
    expect(viewOf().state.doc.toString()).toBe("new");
  });

  it("is not editable when read-only", () => {
    render(<CodeEditor value="x = 1" readOnly ariaLabel="Code" />);
    expect(screen.getByLabelText("Code")).toHaveAttribute("contenteditable", "false");
  });
});
