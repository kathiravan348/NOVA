import { LiveSymbolsSchema, type LiveTick } from "@nova/contracts";

const watchers = new Map<symbol, { symbols: string[]; onTick: (tick: LiveTick) => void }>();
let transport: ((symbols: string[]) => void) | undefined;

function selection(): string[] {
  return [...new Set([...watchers.values()].flatMap((watcher) => watcher.symbols))].sort();
}

/** One shared socket; selections from multiple consumers are combined (max 500 total). */
export function subscribeLiveTicks(
  symbols: string[],
  onTick: (tick: LiveTick) => void,
): () => void {
  const selected = LiveSymbolsSchema.parse(symbols);
  LiveSymbolsSchema.parse([...new Set([...selection(), ...selected])]);
  const id = Symbol();
  watchers.set(id, { symbols: selected, onTick });
  transport?.(selection());
  return () => {
    watchers.delete(id);
    transport?.(selection());
  };
}

/** Internal transport binding; reconnect sends the current selection again. */
export function bindLiveTransport(send: (symbols: string[]) => void): () => void {
  transport = send;
  const symbols = selection();
  if (symbols.length) send(symbols);
  return () => {
    if (transport === send) transport = undefined;
  };
}

export function dispatchLiveTick(tick: LiveTick): void {
  for (const watcher of watchers.values()) {
    if (watcher.symbols.includes(tick.symbol)) watcher.onTick(tick);
  }
}
