import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children in card body", () => {
    render(<Card>Card body content</Card>);
    expect(screen.getByText("Card body content")).toBeInTheDocument();
  });

  it("renders title as a heading and actions in header", () => {
    render(
      <Card title="Card Title" actions={<button type="button">Action</button>}>
        Body
      </Card>,
    );
    const heading = screen.getByRole("heading", { level: 3, name: "Card Title" });
    expect(heading).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
  });

  it("renders footer when provided", () => {
    render(<Card footer={<span>Footer Note</span>}>Body</Card>);
    expect(screen.getByText("Footer Note")).toBeInTheDocument();
  });
});
