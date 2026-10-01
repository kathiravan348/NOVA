import type { Instrument } from "@nova/contracts";

/**
 * The `limit` synced stocks that trade the most: average daily volume × last close, highest first,
 * ties by symbol. Synced stocks with no instrument row (no history) follow by symbol (D75).
 */
export function topByTradedValue(
  synced: string[],
  instruments: Instrument[],
  limit: number,
): string[] {
  const wanted = new Set(synced);
  const ranked = instruments
    .filter((i) => wanted.has(i.symbol))
    .map((i) => ({ symbol: i.symbol, value: i.avgDailyVolume * i.lastClosePaise }))
    .sort((a, b) => b.value - a.value || bySymbol(a.symbol, b.symbol))
    .map((r) => r.symbol);
  const known = new Set(ranked);
  const unranked = [...wanted].filter((s) => !known.has(s)).sort(bySymbol);
  return [...ranked, ...unranked].slice(0, limit);
}

function bySymbol(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
