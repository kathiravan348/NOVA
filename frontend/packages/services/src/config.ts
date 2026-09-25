export type DataMode = "mock" | "real";

export function getDataMode(): DataMode {
  const raw: unknown = import.meta.env["VITE_DATA_MODE"];
  if (raw === undefined || raw === "" || raw === "mock") return "mock";
  if (raw === "real") return "real";
  throw new Error(`Unknown VITE_DATA_MODE: ${String(raw)}`);
}

/**
 * Same origin in both modes: MSW answers in mock mode; in real mode the dev server (or the VPS reverse
 * proxy) forwards `/api` to NOVA Core, so the session cookie needs no CORS (D48).
 */
export function getApiBaseUrl(): string {
  return globalThis.location?.origin ?? "http://localhost";
}
