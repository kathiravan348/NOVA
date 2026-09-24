import { http, HttpResponse } from "msw";
import { apiPath, emptyPage, internalError } from "./api";

export const emptyHandlers = [
  http.get(apiPath("/strategies"), () => {
    return HttpResponse.json([]);
  }),
  http.get(apiPath("/strategies/stats"), () => {
    return HttpResponse.json([]);
  }),
  http.get(apiPath("/backtests"), () => {
    return emptyPage();
  }),
  http.get(apiPath("/backtests/:id/trades"), () => {
    return emptyPage();
  }),
  http.get(apiPath("/broker/accounts"), () => {
    return HttpResponse.json([]);
  }),
  http.get(apiPath("/broker/rate-limits"), () => {
    return HttpResponse.json([]);
  }),
  http.get(apiPath("/broker/profiles"), () => {
    return HttpResponse.json([]);
  }),
  http.get(apiPath("/data-jobs"), () => {
    return emptyPage();
  }),
  http.get(apiPath("/audit"), () => {
    return emptyPage();
  }),
  http.get(apiPath("/market-data/instruments"), () => {
    return HttpResponse.json([]);
  }),
  http.get(apiPath("/market-data/candles"), () => {
    return HttpResponse.json([]);
  }),
];

export const errorHandlers = [
  http.get(apiPath("/market-data/instruments"), () => {
    return internalError();
  }),
  http.get(apiPath("/market-data/candles"), () => {
    return internalError();
  }),
  http.get(apiPath("/me"), () => {
    return internalError();
  }),
  http.get(apiPath("/strategies"), () => {
    return internalError();
  }),
  http.get(apiPath("/strategies/stats"), () => {
    return internalError();
  }),
  http.get(apiPath("/strategies/:id"), () => {
    return internalError();
  }),
  http.get(apiPath("/backtests"), () => {
    return internalError();
  }),
  http.get(apiPath("/backtests/:id"), () => {
    return internalError();
  }),
  http.get(apiPath("/backtests/:id/result"), () => {
    return internalError();
  }),
  http.get(apiPath("/backtests/:id/trades"), () => {
    return internalError();
  }),
  http.get(apiPath("/broker/accounts"), () => {
    return internalError();
  }),
  http.get(apiPath("/broker/accounts/:id"), () => {
    return internalError();
  }),
  http.get(apiPath("/broker/rate-limits"), () => {
    return internalError();
  }),
  http.get(apiPath("/broker/profiles"), () => {
    return internalError();
  }),
  http.get(apiPath("/broker/profiles/:broker"), () => {
    return internalError();
  }),
  http.get(apiPath("/data-jobs"), () => {
    return internalError();
  }),
  http.get(apiPath("/data-jobs/:id"), () => {
    return internalError();
  }),
  http.get(apiPath("/audit"), () => {
    return internalError();
  }),
];
