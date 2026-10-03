import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TradeTimeline } from "./TradeTimeline";
import { reasonLabels, timelineEvents } from "./TradeTimeline.fixtures";

describe("TradeTimeline", () => {
  it("shows one node per trade, oldest first, coloured by trade", () => {
    render(<TradeTimeline events={timelineEvents} clock="seconds" reasonLabels={reasonLabels} />);
    const items = within(screen.getByRole("list", { name: "Trades" })).getAllByRole("listitem");
    expect(items.map((item) => item.dataset["tone"])).toEqual([
      "buy",
      "profit",
      "buy",
      "loss",
      "buy",
      "flat",
    ]);
    expect(within(items[0]!).getByText("Buy")).toBeInTheDocument();
    expect(within(items[0]!).getByText("09:30:05")).toBeInTheDocument();
    expect(within(items[0]!).queryByText("Held")).not.toBeInTheDocument();
    expect(within(items[1]!).getByText("31 min")).toBeInTheDocument();
    expect(within(items[1]!).getByText("Target")).toBeInTheDocument();
    expect(within(items[1]!).getByText("+₹608.00")).toBeInTheDocument();
    expect(within(items[3]!).getByText("2 days")).toBeInTheDocument();
    expect(within(items[3]!).getByText("Stop-loss")).toBeInTheDocument();
    expect(within(items[5]!).getByText("42 s")).toBeInTheDocument();
    expect(within(items[5]!).getByText("—")).toBeInTheDocument();
    expect(within(items[5]!).getByText("₹10,00,299.00")).toBeInTheDocument();
  });

  it("follows the clock setting", () => {
    const { rerender } = render(
      <TradeTimeline events={timelineEvents} clock="minutes" reasonLabels={reasonLabels} />,
    );
    expect(screen.getAllByText("09:30").length).toBeGreaterThan(0);
    rerender(<TradeTimeline events={timelineEvents} clock="none" reasonLabels={reasonLabels} />);
    expect(screen.queryByText(/09:30/)).not.toBeInTheDocument();
    expect(screen.getAllByText("2 Jun 2026").length).toBeGreaterThan(0);
  });

  it("renders loading and empty states", () => {
    const { rerender } = render(
      <TradeTimeline events={[]} clock="minutes" reasonLabels={reasonLabels} loading />,
    );
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
    rerender(
      <TradeTimeline
        events={[]}
        clock="minutes"
        reasonLabels={reasonLabels}
        emptyState="Nothing"
      />,
    );
    expect(screen.getByText("Nothing")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
