import { http, HttpResponse } from "msw";
import { apiPath, internalError } from "./api";

export const emptyHandlers = [
  http.get(apiPath("/strategies"), () => {
    return HttpResponse.json([]);
  }),
  http.get(apiPath("/backtests"), () => {
    return HttpResponse.json([]);
  }),
  http.get(apiPath("/backtests/:id/trades"), () => {
    return HttpResponse.json([]);
  }),
  http.get(apiPath("/broker/accounts"), () => {
    return HttpResponse.json([]);
  }),
  http.get(apiPath("/broker/rate-limits"), () => {
    return HttpResponse.json([]);
  }),
  http.get(apiPath("/data-jobs"), () => {
    return HttpResponse.json([]);
  }),
  http.get(apiPath("/audit"), () => {
    return HttpResponse.json([]);
  }),
];

export const errorHandlers = [
  http.get(apiPath("/me"), () => {
    return internalError();
  }),
  http.get(apiPath("/strategies"), () => {
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
