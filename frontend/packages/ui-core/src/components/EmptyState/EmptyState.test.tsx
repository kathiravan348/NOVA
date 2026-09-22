import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState title="Empty portfolio" description="No holdings currently in this account." />,
    );

    expect(screen.getByRole("heading", { name: "Empty portfolio" })).toBeInTheDocument();
    expect(screen.getByText("No holdings currently in this account.")).toBeInTheDocument();
  });

  it("renders action element when provided", () => {
    render(
      <EmptyState title="No positions" action={<button type="button">Open Position</button>} />,
    );

    expect(screen.getByRole("button", { name: "Open Position" })).toBeInTheDocument();
  });

  it("sets role='alert' when tone is error", () => {
    const { rerender } = render(<EmptyState title="Normal empty" tone="neutral" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<EmptyState title="Error occurred" tone="error" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
