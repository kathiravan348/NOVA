import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Meter } from "./Meter";

describe("Meter", () => {
  it("renders with correct meter role and aria attributes", () => {
    render(<Meter label="Orders" value={6} max={10} valueText="6 / 10 per sec" />);

    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "10");
    expect(meter).toHaveAttribute("aria-valuenow", "6");
    expect(meter).toHaveAttribute("aria-valuetext", "6 / 10 per sec");

    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("6 / 10 per sec")).toBeInTheDocument();
  });

  it("applies correct threshold color classes based on warnAt and dangerAt", () => {
    // Normal: 5/10 = 0.5 < 0.8 -> bg-action
    const { rerender } = render(<Meter label="M" value={5} max={10} />);
    let fill = screen.getByRole("meter").firstElementChild;
    expect(fill).toHaveClass("bg-action");

    // Warning: 8.5/10 = 0.85 >= 0.8 -> bg-warning
    rerender(<Meter label="M" value={8.5} max={10} />);
    fill = screen.getByRole("meter").firstElementChild;
    expect(fill).toHaveClass("bg-warning");

    // Danger: 9.6/10 = 0.96 >= 0.95 -> bg-loss
    rerender(<Meter label="M" value={9.6} max={10} />);
    fill = screen.getByRole("meter").firstElementChild;
    expect(fill).toHaveClass("bg-loss");
  });

  it("is named by its label and keeps aria-valuenow within range", () => {
    render(<Meter label="Orders" value={12} max={10} />);
    const meter = screen.getByRole("meter", { name: "Orders" });
    expect(meter).toHaveAttribute("aria-valuenow", "10");
  });
});
