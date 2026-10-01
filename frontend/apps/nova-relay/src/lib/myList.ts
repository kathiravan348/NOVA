/** The Monitor's own list of stocks (D78), kept in this browser only. */
const STORAGE_KEY = "relay.live.myList";

export function loadMyList(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    // bad JSON, or localStorage unavailable or restricted
    return [];
  }
}

export function saveMyList(symbols: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  } catch {
    // localStorage may be unavailable or restricted
  }
}
