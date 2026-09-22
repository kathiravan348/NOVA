import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PnLCard } from "./PnLCard";

describe("PnLCard", () => {
  it("renders label and formatted PnL value with sign and percentage", () => {
    render(
      <PnLCard label="Realised P&L" paise={9824400} percent={1.23} caption="Closed positions" />,
    );

    expect(screen.getByText("Realised P&L")).toBeInTheDocument();
    expect(screen.getByText("+₹98,244.00 (+1.23%)")).toBeInTheDocument();
    expect(screen.getByText("Closed positions")).toBeInTheDocument();
  });

  it("renders loading skeleton when loading prop is true", () => {
    render(<PnLCard label="Unrealised P&L" paise={-1423600} loading={true} />);

    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByText("−₹14,236.00")).not.toBeInTheDocument();
  });
});
