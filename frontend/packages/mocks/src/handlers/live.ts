import { http, HttpResponse } from "msw";
import { LiveSymbolSchema, LiveSymbolsSchema } from "@nova/contracts";
import { mockLiveDays, mockLiveSnapshot } from "../data";
import { mockUniverse } from "./marketData";
import { apiPath, badRequest, notFound } from "./api";

export const liveHandlers = [
  http.get(apiPath("/live/snapshot"), ({ request }) => {
    const raw = new URL(request.url).searchParams.get("symbols");
    const parsed = LiveSymbolsSchema.safeParse(raw?.split(","));
    if (!parsed.success || !parsed.data.length)
      return badRequest("Choose 1–500 unique NSE stock symbols");
    if (parsed.data.some((symbol) => !mockUniverse.some((row) => row.symbol === symbol)))
      return notFound("Unknown NSE stocks");
    // A stock with no mock ticks is known but has not been recorded yet.
    return HttpResponse.json(
      parsed.data.map(
        (symbol) =>
          mockLiveSnapshot.find((row) => row.symbol === symbol) ?? {
            symbol,
            price: null,
            changePercent: null,
            at: null,
            secondsWithTick: 0,
            secondsExpected: 0,
          },
      ),
    );
  }),
  http.get(apiPath("/live/days"), ({ request }) => {
    const parsed = LiveSymbolSchema.safeParse(new URL(request.url).searchParams.get("symbol"));
    if (!parsed.success) return badRequest("Choose an NSE stock symbol");
    if (!mockUniverse.some((row) => row.symbol === parsed.data))
      return notFound("Unknown NSE stock");
    return HttpResponse.json(mockLiveDays.filter((row) => row.symbol === parsed.data));
  }),
];
