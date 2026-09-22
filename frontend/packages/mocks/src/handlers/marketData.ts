import { http, HttpResponse } from "msw";
import { mockCandles, mockInstruments } from "../data";
import { apiPath, notFound } from "./api";

export const marketDataHandlers = [
  http.get(apiPath("/market-data/instruments"), () => {
    return HttpResponse.json(mockInstruments);
  }),

  http.get(apiPath("/market-data/candles"), ({ request }) => {
    const params = new URL(request.url).searchParams;
    const symbol = params.get("symbol");
    const timeframe = params.get("timeframe");
    if (!symbol || !timeframe) {
      return notFound("symbol and timeframe are required");
    }
    if (!mockInstruments.some((i) => i.symbol === symbol)) {
      return notFound(`Instrument ${symbol} not found`);
    }
    return HttpResponse.json(mockCandles[`${symbol}:${timeframe}`] ?? []);
  }),
];
