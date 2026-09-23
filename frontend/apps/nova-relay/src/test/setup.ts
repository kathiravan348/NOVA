import "@testing-library/jest-dom/vitest";
import { transferableAbortController } from "node:util";

// jsdom replaces AbortController/AbortSignal, but Node's fetch and Request (used by MSW,
// React Router and TanStack Query) only accept native signals. Put the native ones back.
const NativeAbortController = transferableAbortController().constructor as typeof AbortController;
globalThis.AbortController = NativeAbortController;
globalThis.AbortSignal = new NativeAbortController().signal.constructor as typeof AbortSignal;

// jsdom has no ResizeObserver (used by Radix and chart components).
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};
