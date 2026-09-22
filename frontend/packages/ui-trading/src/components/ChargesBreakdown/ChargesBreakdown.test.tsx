import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChargesSchema } from "@nova/contracts";
import { ChargesBreakdown } from "./ChargesBreakdown";
import { deliveryCharges, intradayCharges } from "./storyData";

describe("ChargesBreakdown", () => {
  it("story fixtures validate successfully against ChargesSchema", () => {
    expect(() => ChargesSchema.parse(deliveryCharges)).not.toThrow();
    expect(() => ChargesSchema.parse(intradayCharges)).not.toThrow();
  });

  it("renders all charge rows when hideZero is false", () => {
    render(<ChargesBreakdown charges={intradayCharges} hideZero={false} />);

    expect(screen.getByText("Charges")).toBeInTheDocument();
    expect(screen.getByText("Brokerage")).toBeInTheDocument();
    expect(screen.getByText("STT/CTT")).toBeInTheDocument();
    expect(screen.getByText("Exchange txn")).toBeInTheDocument();
    expect(screen.getByText("SEBI fee")).toBeInTheDocument();
    expect(screen.getByText("Stamp duty")).toBeInTheDocument();
    expect(screen.getByText("GST")).toBeInTheDocument();
    expect(screen.getByText("DP charges")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("₹83.70")).toBeInTheDocument();
  });

  it("hides zero rows when hideZero is true while retaining Total", () => {
    render(<ChargesBreakdown charges={intradayCharges} hideZero={true} />);

    // DP charges has amount 0 in intradayCharges
    expect(screen.queryByText("DP charges")).not.toBeInTheDocument();
    expect(screen.getByText("Brokerage")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("₹83.70")).toBeInTheDocument();
  });

  it("renders skeleton loading state", () => {
    render(<ChargesBreakdown charges={deliveryCharges} loading={true} />);

    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByText("₹158.70")).not.toBeInTheDocument();
  });
});
