import { http, HttpResponse } from "msw";
import { IsoDateSchema, LedgerDaySchema, LedgerEventSchema, pageSchema } from "@nova/contracts";
import ledgers from "../../data/ledgers.json";
import { mockBacktestRuns } from "../data";
import { apiPath, badRequest, notFound, paginate } from "./api";

const fixtures = Object.fromEntries(
  Object.entries(ledgers).map(([id, ledger]) => [
    id,
    {
      days: LedgerDaySchema.array().parse(ledger.days),
      events: LedgerEventSchema.array().parse(ledger.events),
      symbols: Object.fromEntries(
        Object.entries(ledger.symbols).map(([symbol, days]) => [
          symbol,
          LedgerDaySchema.array().parse(days),
        ]),
      ),
    },
  ]),
);

function checkRun(id: string): Response | undefined {
  const run = mockBacktestRuns.find((run) => run.id === id);
  if (!run) return notFound(`Backtest run ${id} not found`);
  if (!run.reportKept) return badRequest("Only the newest version keeps the full report");
  if (run.status !== "completed") return badRequest("The backtest has not completed");
  return undefined;
}

function badRange(from: string | null, to: string | null): boolean {
  return (
    (from !== null && !IsoDateSchema.safeParse(from).success) ||
    (to !== null && !IsoDateSchema.safeParse(to).success) ||
    (from !== null && to !== null && from > to)
  );
}

export const ledgerHandlers = [
  http.get(apiPath("/backtests/:id/ledger"), async ({ params, request }) => {
    const id = String(params["id"]);
    const error = checkRun(id);
    if (error) return error;
    const query = new URL(request.url).searchParams;
    const from = query.get("from"),
      to = query.get("to"),
      symbol = query.get("symbol");
    if (badRange(from, to)) return badRequest("Invalid date range");
    if (symbol === "") return badRequest("symbol must not be empty");
    const allDays = query.get("allDays");
    if (allDays !== null && allDays !== "true" && allDays !== "false")
      return badRequest("Invalid allDays");
    const fixture = fixtures[id];
    const days =
      (symbol
        ? (fixture?.symbols[symbol] ??
          fixture?.days.map((day) => ({
            ...day,
            buys: 0,
            sells: 0,
            boughtPaise: 0,
            soldPaise: 0,
            chargesPaise: 0,
            netPnlPaise: 0,
          })))
        : fixture?.days) ?? [];
    const rows = days.filter(
      (day) =>
        (!from || day.date >= from) &&
        (!to || day.date <= to) &&
        (allDays === "true" || day.buys > 0 || day.sells > 0),
    );
    const response = paginate(rows, request.url);
    if (!response.ok) return response;
    const page = pageSchema(LedgerDaySchema).parse(await response.json());
    return HttpResponse.json({ ...page, nextCursor: null });
  }),
  http.get(apiPath("/backtests/:id/timeline"), async ({ params, request }) => {
    const id = String(params["id"]);
    const error = checkRun(id);
    if (error) return error;
    const query = new URL(request.url).searchParams;
    const from = query.get("from"),
      to = query.get("to"),
      symbol = query.get("symbol");
    if (badRange(from, to)) return badRequest("Invalid date range");
    if (symbol === "") return badRequest("symbol must not be empty");
    const rows = (fixtures[id]?.events ?? []).filter((event) => {
      const date = event.at.slice(0, 10);
      return (!from || date >= from) && (!to || date <= to) && (!symbol || event.symbol === symbol);
    });
    const response = paginate(rows, request.url);
    if (!response.ok) return response;
    const page = pageSchema(LedgerEventSchema).parse(await response.json());
    return HttpResponse.json({ ...page, nextCursor: null });
  }),
  http.get(apiPath("/backtests/:id/ledger/:date"), ({ params, request }) => {
    const id = String(params["id"]),
      date = String(params["date"]);
    const error = checkRun(id);
    if (error) return error;
    if (!IsoDateSchema.safeParse(date).success) return badRequest("Invalid date");
    const symbol = new URL(request.url).searchParams.get("symbol");
    if (symbol === "") return badRequest("symbol must not be empty");
    return HttpResponse.json(
      (fixtures[id]?.events ?? []).filter(
        (event) => event.at.slice(0, 10) === date && (!symbol || event.symbol === symbol),
      ),
    );
  }),
];
