import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PnLText } from "./PnLText";

describe("PnLText", () => {
  it("renders positive PnL with plus sign and text-profit class", () => {
    render(<PnLText paise={9824400} />);
    const text = screen.getByText("+₹98,244.00");
    expect(text).toBeInTheDocument();
    expect(text).toHaveClass("text-profit");
  });

  it("renders negative PnL with minus sign and text-loss class", () => {
    render(<PnLText paise={-1423600} />);
    const text = screen.getByText("−₹14,236.00");
    expect(text).toBeInTheDocument();
    expect(text).toHaveClass("text-loss");
  });

  it("renders zero PnL with text-text-primary class", () => {
    render(<PnLText paise={0} />);
    const text = screen.getByText("₹0.00");
    expect(text).toBeInTheDocument();
    expect(text).toHaveClass("text-text-primary");
  });

  it("appends formatted percentage in parentheses when provided", () => {
    render(<PnLText paise={9824400} percent={1.23} />);
    expect(screen.getByText("+₹98,244.00 (+1.23%)")).toBeInTheDocument();
  });
});
