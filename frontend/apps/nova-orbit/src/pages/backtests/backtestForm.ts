import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import {
  IndexNameSchema,
  type BacktestRun,
  type BacktestRunCreate,
  type BacktestVersionCreate,
  type Strategy,
  type Universe,
} from "@nova/contracts";

const MIN_CAPITAL_RUPEES = 10_000;

/** Today's calendar date in IST, `YYYY-MM-DD`. */
export const todayIst = (now: Date = new Date()) =>
  formatInTimeZone(now, "Asia/Kolkata", "yyyy-MM-dd");

export const BacktestFormSchema = z
  .object({
    strategyId: z.string().min(1, "Choose a strategy"),
    version: z.string().min(1, "Choose a version"),
    name: z.string().trim().min(1, "Name is required"),
    universeType: z.enum(["symbols", "index"]),
    symbols: z.array(z.string()),
    index: IndexNameSchema,
    from: z.string().min(1, "Start date is required"),
    to: z.string().min(1, "End date is required"),
    capitalRupees: z.string(),
    benchmark: z.boolean(),
  })
  .superRefine((f, ctx) => {
    if (f.universeType === "symbols" && f.symbols.length === 0) {
      ctx.addIssue({ code: "custom", path: ["symbols"], message: "Choose at least one symbol" });
    }
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

/**
 * Defaults: the two months up to the latest date with market data (never after today), so a fresh
 * form does not flag every symbol as missing data.
 */
export function defaultsFor(
  strategy: Strategy | undefined,
  today = todayIst(),
  latestData?: string,
): BacktestForm {
  const to = latestData && latestData < today ? latestData : today;
  return {
    strategyId: strategy?.id ?? "",
    version: strategy ? String(strategy.latestVersion) : "",
    name: strategy ? `${strategy.name} backtest` : "",
    universeType: "symbols",
    symbols: [],
    index: "NIFTY 50",
    from: monthsBefore(to, 2),
    to,
    capitalRupees: "1000000",
    benchmark: true,
  };
}

/** The run's universe (D25): chosen symbols or a whole index. */
export function toUniverse(form: BacktestForm): Universe {
  return form.universeType === "index"
    ? { type: "index", index: form.index }
    : { type: "symbols", symbols: form.symbols };
}

/** The `POST /backtests` body (D44); capital in whole rupees becomes paise. */
export function toRunCreate(form: BacktestForm): BacktestRunCreate {
  return {
    strategyId: form.strategyId,
    strategyVersion: Number(form.version),
    name: form.name.trim(),
    universe: toUniverse(form),
    from: form.from,
    to: form.to,
    initialCapitalPaise: Math.round(Number(form.capitalRupees) * 100),
    benchmark: form.benchmark ? "NIFTY 50" : null,
  };
}

/** The form for Edit (D60): every setting of `run`, ready to queue as the next version. */
export function defaultsFromRun(run: BacktestRun): BacktestForm {
  return {
    strategyId: run.strategyId,
    version: String(run.strategyVersion),
    name: run.name,
    universeType: run.universe.type,
    symbols: run.universe.type === "symbols" ? run.universe.symbols : [],
    index: run.universe.type === "index" ? run.universe.index : "NIFTY 50",
    from: run.from,
    to: run.to,
    capitalRupees: String(run.initialCapitalPaise / 100),
    benchmark: run.benchmark !== null,
  };
}

/** The `POST /backtests/{id}/versions` body: the run body without the (fixed) strategy. */
export function toVersionCreate(form: BacktestForm): BacktestVersionCreate {
  const run = toRunCreate(form);
  return {
    strategyVersion: run.strategyVersion,
    name: run.name,
    universe: run.universe,
    from: run.from,
    to: run.to,
    initialCapitalPaise: run.initialCapitalPaise,
    benchmark: run.benchmark,
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value: string) => {
  const day = new Date(`${value}T00:00:00Z`);
  return (
    ISO_DATE.test(value) && !Number.isNaN(day.getTime()) && day.toISOString().startsWith(value)
  );
};

/**
 * Form defaults from the link a Library entry's **Backtest** button builds (D62 (7)): `index`,
 * `from`, `to`, `capital` (rupees), `benchmark` and `name`. Each is checked like typed input and
 * left out when it is not valid, so a bad link just falls back to the usual default.
 */
export function defaultsFromParams(
  params: URLSearchParams,
  today = todayIst(),
): Partial<BacktestForm> {
  const found: Partial<BacktestForm> = {};
  const index = IndexNameSchema.safeParse(params.get("index") ?? undefined);
  if (index.success) Object.assign(found, { universeType: "index", index: index.data });
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (isDate(from) && isDate(to) && from <= to && to <= today) Object.assign(found, { from, to });
  const capital = Number(params.get("capital") ?? "");
  if (Number.isFinite(capital) && capital >= MIN_CAPITAL_RUPEES) {
    found.capitalRupees = String(capital);
  }
  const benchmark = params.get("benchmark");
  if (benchmark === "NIFTY 50" || benchmark === "none") found.benchmark = benchmark === "NIFTY 50";
  const name = params.get("name")?.trim() ?? "";
  if (name.length > 0 && name.length <= 200) found.name = name;
  return found;
}
