import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders label and aria-hidden leading dot", () => {
    render(<StatusBadge tone="success" label="Connected" />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
    const dot = screen.getByTestId("status-dot");
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot).toHaveClass("bg-profit");
  });

  it("applies correct classes for different tones", () => {
    const { rerender } = render(<StatusBadge tone="danger" label="Failed" />);
    let dot = screen.getByTestId("status-dot");
    expect(dot).toHaveClass("bg-loss");

    rerender(<StatusBadge tone="info" label="Running" />);
    dot = screen.getByTestId("status-dot");
    expect(dot).toHaveClass("bg-action");
  });
});
