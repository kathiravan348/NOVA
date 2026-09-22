import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatCard } from "./StatCard";

describe("StatCard", () => {
  it("renders label, value and caption with tone", () => {
    render(
      <StatCard
        label="Active users"
        value="1,284"
        caption="+12.4% vs last week"
        captionTone="positive"
      />,
    );
    expect(screen.getByText("Active users")).toBeInTheDocument();
    expect(screen.getByText("1,284")).toBeInTheDocument();
    const caption = screen.getByText("+12.4% vs last week");
    expect(caption).toBeInTheDocument();
    expect(caption).toHaveClass("text-profit");
  });

  it("shows Skeleton when loading", () => {
    render(<StatCard label="Error rate" value="4.2%" caption="Above threshold" loading />);
    expect(screen.queryByText("Error rate")).not.toBeInTheDocument();
    expect(screen.queryByText("4.2%")).not.toBeInTheDocument();
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
