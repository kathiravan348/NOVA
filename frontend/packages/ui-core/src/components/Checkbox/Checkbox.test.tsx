import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("renders with label linked to checkbox", () => {
    render(<Checkbox label="Accept Terms" />);
    const checkbox = screen.getByLabelText("Accept Terms");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute("role", "checkbox");
  });

  it("toggles when clicked directly or via label", () => {
    const handleCheckedChange = vi.fn();
    render(<Checkbox label="Enable alerts" onCheckedChange={handleCheckedChange} />);
    const label = screen.getByText("Enable alerts");
    fireEvent.click(label);
    expect(handleCheckedChange).toHaveBeenCalledWith(true);
  });

  it("sets aria-invalid and shows error when error is provided", () => {
    render(<Checkbox label="Required agreement" id="terms-cb" error="Field is required" />);
    const checkbox = screen.getByLabelText("Required agreement");
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(checkbox).toHaveAttribute("aria-describedby", "terms-cb-error");

    const errorMsg = screen.getByRole("alert");
    expect(errorMsg).toHaveTextContent("Field is required");
  });

  it("handles disabled state", () => {
    const handleCheckedChange = vi.fn();
    render(<Checkbox label="Disabled checkbox" disabled onCheckedChange={handleCheckedChange} />);
    const checkbox = screen.getByLabelText("Disabled checkbox");
    expect(checkbox).toBeDisabled();
    fireEvent.click(checkbox);
    expect(handleCheckedChange).not.toHaveBeenCalled();
  });
});
