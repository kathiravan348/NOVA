import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveStockCard } from "./LiveStockCard";

const base = {
  symbol: "RELIANCE",
  name: "Reliance Industries",
  price: 298450,
  changePercent: 1.2,
  lastTick: "13:30:00",
  secondsWithTick: 14900,
  secondsExpected: 15301,
};

describe("LiveStockCard", () => {
  it("shows price, signed change, last tick and seconds with a tick", () => {
    render(<LiveStockCard {...base} />);
    expect(screen.getByText("RELIANCE")).toBeInTheDocument();
    expect(screen.getByText("+1.20%")).toHaveClass("text-profit");
    expect(screen.getByText("13:30:00")).toBeInTheDocument();
    expect(screen.getByText("14,900 / 15,301")).toBeInTheDocument();
  });

  it("uses a real minus sign for a fall", () => {
    render(<LiveStockCard {...base} changePercent={-0.4} />);
    expect(screen.getByText("−0.40%")).toHaveClass("text-loss");
  });

  it("shows dashes before the first tick and warns when stale", () => {
    render(<LiveStockCard {...base} price={null} changePercent={null} lastTick={null} stale />);
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.getByText("No recent tick")).toBeInTheDocument();
  });
});
