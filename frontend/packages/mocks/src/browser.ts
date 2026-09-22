import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/** Starts the MSW service worker for the apps in mock mode (D23). Browser only. */
export async function startMockWorker(): Promise<void> {
  await setupWorker(...handlers).start({ onUnhandledRequest: "bypass", quiet: true });
}
