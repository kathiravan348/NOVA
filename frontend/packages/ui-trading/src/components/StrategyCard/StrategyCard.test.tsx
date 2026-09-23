import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StrategyStats } from "@nova/contracts";
import { StrategyCard } from "./StrategyCard";

const stats: StrategyStats = {
  strategyId: "s1",
  runsTotal: 3,
  runsCompleted: 2,
  runsFailed: 0,
  runsInProgress: 1,
  lastRunAt: "2026-09-21T06:20:00Z",
  bestReturnPercent: 0.5,
  worstReturnPercent: -1.25,
  winRateMinPercent: 60,
  winRateMaxPercent: 75,
  worstDrawdownPercent: -0.11,
  bestNetPnl: { runId: "run_001", netPnlPaise: 499474 },
};

const props = {
  title: "VWAP Momentum",
  status: <span>Active</span>,
  details: ["Visual", "Equity intraday", "5 min", "v2"],
  updatedLabel: "Updated 15 Aug 2026",
};

describe("StrategyCard", () => {
  it("shows facts, run counts and results", () => {
    render(<StrategyCard {...props} stats={stats} lastRunLabel="21 Sep 2026" />);
    expect(screen.getByText("VWAP Momentum")).toBeInTheDocument();
    expect(screen.getByText("Visual · Equity intraday · 5 min · v2")).toBeInTheDocument();
    expect(screen.getByText("Runs").nextSibling).toHaveTextContent("3");
    expect(screen.getByText("+0.50%")).toHaveClass("text-profit");
    expect(screen.getByText("−1.25%")).toHaveClass("text-loss");
    expect(screen.getByText("60%–75%")).toBeInTheDocument();
    expect(screen.getByText("+₹4,994.74")).toBeInTheDocument();
    expect(screen.getByText("21 Sep 2026")).toBeInTheDocument();
  });

  it("wraps the best net P&L with renderBestRun", () => {
    render(
      <StrategyCard
        {...props}
        stats={stats}
        renderBestRun={(content, runId) => <a href={`/backtests/${runId}`}>{content}</a>}
      />,
    );
    expect(screen.getByRole("link", { name: "+₹4,994.74" })).toHaveAttribute(
      "href",
      "/backtests/run_001",
    );
  });

  it("says when nothing completed, and shows loading and unavailable states", () => {
    const none: StrategyStats = {
      ...stats,
      runsCompleted: 0,
      runsFailed: 2,
      bestReturnPercent: null,
      worstReturnPercent: null,
      winRateMinPercent: null,
      winRateMaxPercent: null,
      worstDrawdownPercent: null,
      bestNetPnl: null,
    };
    const { rerender } = render(<StrategyCard {...props} stats={none} />);
    expect(screen.getByText("No completed runs yet.")).toBeInTheDocument();
    rerender(<StrategyCard {...props} statsLoading />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
    rerender(<StrategyCard {...props} />);
    expect(screen.getByText("Backtest stats unavailable.")).toBeInTheDocument();
  });
});
