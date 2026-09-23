import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EquityPointSchema } from "@nova/contracts";
import { EquityCurve } from "./EquityCurve";
import { EquityCurveTooltip } from "./EquityCurveTooltip";
import { equityOnly, equityWithBenchmark } from "./storyData";

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => (
      <div style={{ width: 600, height: 280 }}>
        {React.cloneElement(children as React.ReactElement<{ width: number; height: number }>, {
          width: 600,
          height: 280,
        })}
      </div>
    ),
  };
});

describe("EquityCurve", () => {
  it("story data is valid, weekday-only and 120 points long", () => {
    expect(equityWithBenchmark).toHaveLength(120);
    for (const p of equityWithBenchmark) {
      expect(() => EquityPointSchema.parse(p)).not.toThrow();
      const dow = new Date(`${p.date}T00:00:00Z`).getUTCDay();
      expect(dow).not.toBe(0);
      expect(dow).not.toBe(6);
    }
  });

  it("renders an img with a text summary", () => {
    render(<EquityCurve points={equityWithBenchmark} ariaLabel="Equity curve" />);
    expect(screen.getByRole("img", { name: "Equity curve" })).toBeInTheDocument();
    const first = equityWithBenchmark[0]!;
    expect(first.equityPaise).toBe(5_00_000_00);
    expect(screen.getByText(/From 2 Mar 2026 to .*, equity ₹5,00,000 →/)).toBeInTheDocument();
  });

  it("shows the NIFTY 50 legend only when a benchmark exists", () => {
    const { rerender } = render(<EquityCurve points={equityWithBenchmark} ariaLabel="c" />);
    expect(screen.getByText("NIFTY 50")).toBeInTheDocument();
    rerender(<EquityCurve points={equityOnly} ariaLabel="c" />);
    expect(screen.queryByText("NIFTY 50")).not.toBeInTheDocument();
    expect(screen.getByText("Strategy")).toBeInTheDocument();
  });

  it("shows the empty text when there are no points", () => {
    render(<EquityCurve points={[]} ariaLabel="c" />);
    expect(screen.getByText("No equity data")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows a skeleton while loading", () => {
    render(<EquityCurve points={equityWithBenchmark} loading ariaLabel="c" />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("EquityCurveTooltip", () => {
  it("renders date, equity and benchmark", () => {
    render(
      <EquityCurveTooltip
        point={{ date: "2026-09-21", equityPaise: 5_12_345_00, benchmarkPaise: 5_05_000_00 }}
      />,
    );
    expect(screen.getByText("21 Sep 2026")).toBeInTheDocument();
    expect(screen.getByText("₹5,12,345")).toBeInTheDocument();
    expect(screen.getByText("₹5,05,000")).toBeInTheDocument();
  });

  it("omits the benchmark row when null", () => {
    render(
      <EquityCurveTooltip
        point={{ date: "2026-09-21", equityPaise: 5_12_345_00, benchmarkPaise: null }}
      />,
    );
    expect(screen.queryByText("NIFTY 50")).not.toBeInTheDocument();
  });
});
