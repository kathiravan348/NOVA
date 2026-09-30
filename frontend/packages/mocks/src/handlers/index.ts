import { downloadHandlers } from "./downloads";
import { approvalHandlers } from "./approvals";
import { marketDataHandlers } from "./marketData";
import { orbitHandlers } from "./orbit";
import { relayHandlers } from "./relay";
import { liveHandlers } from "./live";

// Download handlers first: `/data-jobs/settings` must win over `/data-jobs/:id`.
export const handlers = [
  ...downloadHandlers,
  ...approvalHandlers,
  ...orbitHandlers,
  ...relayHandlers,
  ...marketDataHandlers,
  ...liveHandlers,
];

export * from "./api";
export * from "./approvals";
export * from "./downloads";
export * from "./marketData";
export * from "./orbit";
export * from "./relay";
export * from "./scenarios";
export * from "./live";
