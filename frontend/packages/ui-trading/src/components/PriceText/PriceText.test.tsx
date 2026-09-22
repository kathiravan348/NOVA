import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PriceText } from "./PriceText";

describe("PriceText", () => {
  it("renders formatted price without currency symbol by default", () => {
    render(<PriceText paise={161890} />);
    expect(screen.getByText("1,618.90")).toBeInTheDocument();
  });

  it("renders with currency symbol when currency prop is true", () => {
    render(<PriceText paise={161890} currency />);
    expect(screen.getByText("₹1,618.90")).toBeInTheDocument();
  });
});
