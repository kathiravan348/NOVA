import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UnavailableDay } from "@nova/contracts";
import { UnavailableDataTable } from "./UnavailableDataTable";

const row: UnavailableDay = {
  id: "gap_1",
  exchange: "NSE",
  symbol: "AWL",
  timeframe: "1d",
  day: "2022-05-05",
  broker: "Zerodha",
  reason: "no_usable_candle",
  firstCheckedAt: "2026-09-28T10:00:00Z",
  lastCheckedAt: "2026-09-28T10:30:00Z",
  attempts: 2,
  lastJobId: "job_1",
  resolvedAt: null,
  status: "unavailable",
};
describe("UnavailableDataTable", () => {
  it("shows exact dates and evidence, links the job and rechecks the chosen date", () => {
    const recheck = vi.fn();
    render(<UnavailableDataTable rows={[row]} onRecheck={recheck} />);
    const table = within(screen.getByRole("table", { name: "Unavailable data" }));
    expect(table.getByText("5 May 2022")).toBeInTheDocument();
    expect(table.getByText("No usable candle returned")).toBeInTheDocument();
    expect(table.getByRole("link", { name: "View job" })).toHaveAttribute(
      "href",
      "/data-jobs/job_1",
    );
    fireEvent.click(table.getByRole("button", { name: "Check AWL 2022-05-05 again" }));
    expect(recheck).toHaveBeenCalledWith(row);
  });
  it("preserves resolved history and disables unavailable actions", () => {
    render(
      <UnavailableDataTable
        rows={[{ ...row, status: "resolved", resolvedAt: row.lastCheckedAt }]}
      />,
    );
    const table = within(screen.getByRole("table", { name: "Unavailable data" }));
    expect(table.getByText("Resolved")).toBeInTheDocument();
    expect(table.getByRole("button", { name: /Check AWL/ })).toBeDisabled();
  });
});
