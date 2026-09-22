import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import type { Strategy } from "@nova/contracts";

const MIN_CAPITAL_RUPEES = 10_000;

/** Today's calendar date in IST, `YYYY-MM-DD`. */
export const todayIst = (now: Date = new Date()) =>
  formatInTimeZone(now, "Asia/Kolkata", "yyyy-MM-dd");

export const BacktestFormSchema = z
  .object({
    strategyId: z.string().min(1, "Choose a strategy"),
    version: z.string().min(1, "Choose a version"),
    name: z.string().trim().min(1, "Name is required"),
    from: z.string().min(1, "Start date is required"),
    to: z.string().min(1, "End date is required"),
    capitalRupees: z.string(),
    benchmark: z.boolean(),
  })
  .superRefine((f, ctx) => {
    if (f.from && f.to && f.from > f.to) {
      ctx.addIssue({ code: "custom", path: ["from"], message: "Start must be on or before end" });
    }
    if (f.to && f.to > todayIst()) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "End can't be in the future" });
    }
    const capital = Number(f.capitalRupees);
    if (!(
      f.capitalRupees.trim() !== "" &&
      Number.isFinite(capital) &&
      capital >= MIN_CAPITAL_RUPEES
    )) {
      ctx.addIssue({ code: "custom", path: ["capitalRupees"], message: "At least ₹10,000" });
    }
  });
export type BacktestForm = z.infer<typeof BacktestFormSchema>;

function monthsBefore(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

export function defaultsFor(strategy: Strategy | undefined, today = todayIst()): BacktestForm {
  return {
    strategyId: strategy?.id ?? "",
    version: strategy ? String(strategy.latestVersion) : "",
    name: strategy ? `${strategy.name} backtest` : "",
    from: monthsBefore(today, 3),
    to: today,
    capitalRupees: "1000000",
    benchmark: true,
  };
}
