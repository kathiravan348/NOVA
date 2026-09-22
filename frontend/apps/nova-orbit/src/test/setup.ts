import "@testing-library/jest-dom/vitest";
import { transferableAbortController } from "node:util";
import { vi } from "vitest";

// jsdom has no canvas, so Lightweight Charts gets a no-op chart. Pages still render the
// chart's accessible summary, which is what the tests check.
vi.mock("lightweight-charts", () => {
  const series = { setData: () => undefined, applyOptions: () => undefined };
  const withScale = { ...series, priceScale: () => ({ applyOptions: () => undefined }) };
  return {
    CandlestickSeries: "Candlestick",
    HistogramSeries: "Histogram",
    ColorType: { Solid: "solid" },
    TickMarkType: { Year: 0, Month: 1, DayOfMonth: 2, Time: 3, TimeWithSeconds: 4 },
    createChart: () => ({
      addSeries: () => withScale,
      applyOptions: () => undefined,
      timeScale: () => ({ fitContent: () => undefined }),
      remove: () => undefined,
    }),
  };
});

// jsdom replaces AbortController/AbortSignal, but Node's fetch and Request (used by MSW,
// React Router and TanStack Query) only accept native signals. Put the native ones back.
const NativeAbortController = transferableAbortController().constructor as typeof AbortController;
globalThis.AbortController = NativeAbortController;
globalThis.AbortSignal = new NativeAbortController().signal.constructor as typeof AbortSignal;

// jsdom has no ResizeObserver (used by Recharts and Lightweight Charts). Charts render empty.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};
