import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders with default props", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeInTheDocument();
  });

  it("fires onClick handler when clicked", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    const button = screen.getByRole("button", { name: /click me/i });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>,
    );
    const button = screen.getByRole("button", { name: /disabled/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("does not fire onClick and sets aria-busy when loading", () => {
    const handleClick = vi.fn();
    render(
      <Button loading onClick={handleClick}>
        Loading
      </Button>,
    );
    const button = screen.getByRole("button", { name: /loading/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("button-spinner")).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("renders asChild correctly", () => {
    render(
      <Button asChild>
        <a href="/target">Link Button</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: /link button/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/target");
  });

  it("renders primary variant with text-on-action class and no arbitrary white", () => {
    render(<Button variant="primary">Primary</Button>);
    const button = screen.getByRole("button", { name: /primary/i });
    expect(button).toHaveClass("text-on-action");
    const forbidden = `text-${"[white]"}`;
    expect(button.className).not.toContain(forbidden);
  });
});
