import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatCard } from "./StatCard";

describe("StatCard", () => {
  it("renders label, value and caption with tone", () => {
    render(
      <StatCard
        label="Net P&L"
        value="+₹98,244"
        caption="+12.4% vs benchmark"
        captionTone="positive"
      />,
    );
    expect(screen.getByText("Net P&L")).toBeInTheDocument();
    expect(screen.getByText("+₹98,244")).toBeInTheDocument();
    const caption = screen.getByText("+12.4% vs benchmark");
    expect(caption).toBeInTheDocument();
    expect(caption).toHaveClass("text-profit");
  });

  it("shows Skeleton when loading", () => {
    render(<StatCard label="Max Drawdown" value="-14.2%" caption="Within tolerance" loading />);
    expect(screen.queryByText("Max Drawdown")).not.toBeInTheDocument();
    expect(screen.queryByText("-14.2%")).not.toBeInTheDocument();
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
