import type { BacktestProgress } from "@nova/contracts";
import { formatQuantity } from "@nova/ui-trading";
import { formatCalendarDate } from "../../lib/format";

const plural = (n: number, word: string) => `${formatQuantity(n)} ${word}${n === 1 ? "" : "s"}`;

/** What a running backtest is doing, in plain words (D58). */
export function progressLine(p: BacktestProgress): string {
  switch (p.stage) {
    case "loading":
      return `Loading prices — ${formatQuantity(p.symbolsDone)} of ${plural(p.symbolsTotal, "stock")}`;
    case "signals":
      return "Running your Python code";
    case "simulating": {
      const reached = p.simulatedTo ? ` — reached ${formatCalendarDate(p.simulatedTo)}` : "";
      return `Simulating${reached} · ${plural(p.tradesSoFar, "trade")} so far`;
    }
    case "saving":
      return `Saving ${plural(p.tradesSoFar, "trade")}`;
    case "done":
      return "Finished";
  }
}

function seconds(from: string, now: Date): number {
  return Math.max(0, (now.getTime() - new Date(from).getTime()) / 1000);
}

/** `130` s → `2 min 10 s`; under a minute → `45 s`; an hour or more → `1 h 5 min`. */
export function formatDuration(total: number): string {
  const s = Math.floor(total);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${s % 60} s`;
  return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
}

/** "Running for 2 min 10 s". */
export function runningFor(startedAt: string, now: Date): string {
  return `Running for ${formatDuration(seconds(startedAt, now))}`;
}

/** "About 3 min left" (elapsed × (100 − p) / p); null until 5% and 10 s, when a guess means little. */
export function timeLeft(startedAt: string, percent: number, now: Date): string | null {
  const elapsed = seconds(startedAt, now);
  if (percent < 5 || elapsed < 10 || percent >= 100) return null;
  const left = (elapsed * (100 - percent)) / percent;
  if (left < 60) return "Less than a minute left";
  if (left < 3600) return `About ${Math.round(left / 60)} min left`;
  return `About ${formatDuration(left)} left`;
}
