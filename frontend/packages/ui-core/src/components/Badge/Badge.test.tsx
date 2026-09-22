import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders text content", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies tone classes correctly", () => {
    const { rerender } = render(<Badge tone="success">Connected</Badge>);
    let badge = screen.getByText("Connected");
    expect(badge).toHaveClass("bg-profit-subtle");

    rerender(<Badge tone="danger">Failed</Badge>);
    badge = screen.getByText("Failed");
    expect(badge).toHaveClass("bg-loss-subtle");
  });
});
