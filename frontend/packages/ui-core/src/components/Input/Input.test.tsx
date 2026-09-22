import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Input } from "./Input";

describe("Input", () => {
  it("renders with label linked to input", () => {
    render(<Input label="Username" placeholder="Enter username" />);
    const input = screen.getByLabelText("Username");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Enter username");
  });

  it("sets aria-invalid and shows error text when error is passed", () => {
    render(<Input label="Email" id="email-input" error="Invalid email address" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "email-input-error");

    const errorMsg = screen.getByRole("alert");
    expect(errorMsg).toHaveTextContent("Invalid email address");
  });

  it("sets aria-describedby for description and error", () => {
    render(<Input label="Token" id="token-field" description="Helper note" error="Error note" />);
    const input = screen.getByLabelText("Token");
    expect(input).toHaveAttribute("aria-describedby", "token-field-description token-field-error");
  });

  it("handles disabled state", () => {
    render(<Input label="Disabled field" disabled />);
    const input = screen.getByLabelText("Disabled field");
    expect(input).toBeDisabled();
  });

  it("handles onChange event", () => {
    const handleChange = vi.fn();
    render(<Input label="Search" onChange={handleChange} />);
    const input = screen.getByLabelText("Search");
    fireEvent.change(input, { target: { value: "test" } });
    expect(handleChange).toHaveBeenCalled();
    expect(input).toHaveValue("test");
  });

  it("renders leading and trailing adornments", () => {
    render(
      <Input
        label="Amount"
        leading={<span data-testid="leading-icon">₹</span>}
        trailing={<span data-testid="trailing-icon">.00</span>}
      />,
    );
    expect(screen.getByTestId("leading-icon")).toBeInTheDocument();
    expect(screen.getByTestId("trailing-icon")).toBeInTheDocument();
  });

  it("applies numeric styles and default decimal inputMode", () => {
    render(<Input label="Quantity" numeric />);
    const input = screen.getByLabelText("Quantity");
    expect(input).toHaveAttribute("inputMode", "decimal");
    expect(input.className).toContain("font-mono");
    expect(input.className).toContain("text-right");
  });
});
