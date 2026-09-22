import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("has an accessible name from aria-label", () => {
    render(<IconButton aria-label="Close dialog" icon={<span data-testid="test-icon">X</span>} />);
    const button = screen.getByRole("button", { name: "Close dialog" });
    expect(button).toBeInTheDocument();
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("fires onClick handler when clicked", () => {
    const handleClick = vi.fn();
    render(<IconButton aria-label="Settings" icon={<span>S</span>} onClick={handleClick} />);
    const button = screen.getByRole("button", { name: "Settings" });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("shows spinner and hides icon when loading", () => {
    render(
      <IconButton
        aria-label="Loading action"
        icon={<span data-testid="test-icon">Icon</span>}
        loading
      />,
    );
    const button = screen.getByRole("button", { name: "Loading action" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("button-spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("test-icon")).not.toBeInTheDocument();
  });
});
