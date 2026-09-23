import { getDataMode } from "./config";

/**
 * "Now" of the static mock data (equals `MOCK_NOW` in `@nova/mocks`, checked by a test). Screens
 * that show time left (session expiry, resets) use `getNow()` so mock data reads consistently.
 */
export const DEMO_NOW = "2026-09-21T06:30:00Z";

export function getNow(): Date {
  return getDataMode() === "mock" ? new Date(DEMO_NOW) : new Date();
}
