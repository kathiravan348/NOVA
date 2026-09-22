export type DataMode = "mock" | "real";

export function getDataMode(): DataMode {
  const raw: unknown = import.meta.env["VITE_DATA_MODE"];
  if (raw === undefined || raw === "" || raw === "mock") return "mock";
  if (raw === "real") return "real";
  throw new Error(`Unknown VITE_DATA_MODE: ${String(raw)}`);
}

export function getApiBaseUrl(): string {
  if (getDataMode() === "real") {
    throw new Error("DATA_MODE=real is not available in Stage A");
  }
  return globalThis.location?.origin ?? "http://localhost";
}
