import { downloadHandlers } from "./downloads";
import { marketDataHandlers } from "./marketData";
import { orbitHandlers } from "./orbit";
import { relayHandlers } from "./relay";

// Download handlers first: `/data-jobs/settings` must win over `/data-jobs/:id`.
export const handlers = [
  ...downloadHandlers,
  ...orbitHandlers,
  ...relayHandlers,
  ...marketDataHandlers,
];

export * from "./api";
export * from "./downloads";
export * from "./marketData";
export * from "./orbit";
export * from "./relay";
export * from "./scenarios";
