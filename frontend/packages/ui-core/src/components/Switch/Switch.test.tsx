import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "./Switch";

describe("Switch", () => {
  it("renders with label linked to switch", () => {
    render(<Switch label="Auto-square off" />);
    const sw = screen.getByLabelText("Auto-square off");
    expect(sw).toBeInTheDocument();
    expect(sw).toHaveAttribute("role", "switch");
  });

  it("toggles when clicked via label or switch", () => {
    const handleCheckedChange = vi.fn();
    render(<Switch label="Auto-square off" onCheckedChange={handleCheckedChange} />);
    const label = screen.getByText("Auto-square off");
    fireEvent.click(label);
    expect(handleCheckedChange).toHaveBeenCalledWith(true);
  });

  it("sets aria-invalid and shows error when error is provided", () => {
    render(<Switch label="Authorize routing" id="switch-auth" error="Permission required" />);
    const sw = screen.getByLabelText("Authorize routing");
    expect(sw).toHaveAttribute("aria-invalid", "true");
    expect(sw).toHaveAttribute("aria-describedby", "switch-auth-error");

    const err = screen.getByRole("alert");
    expect(err).toHaveTextContent("Permission required");
  });

  it("handles disabled state", () => {
    const handleCheckedChange = vi.fn();
    render(<Switch label="Disabled switch" disabled onCheckedChange={handleCheckedChange} />);
    const sw = screen.getByLabelText("Disabled switch");
    expect(sw).toBeDisabled();
    fireEvent.click(sw);
    expect(handleCheckedChange).not.toHaveBeenCalled();
  });
});
