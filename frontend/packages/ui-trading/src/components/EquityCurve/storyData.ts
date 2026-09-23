import type { EquityPoint } from "@nova/contracts";

export const INITIAL_CAPITAL_PAISE = 5_00_000_00;

// Two fixed step cycles of co-prime length (in rupees) so the curve looks irregular.
const EQUITY_STEPS = [1800, -900, 2400, 600, -1500, 3100, -400, 900, -2200, 1700, -2600];
const EQUITY_DRIFT = [-1200, 700, -300, 1500, -2100, 400, 900];
const BENCHMARK_STEPS = [900, -600, 1100, 300, -900, 1400, -300, 500, -1200, 800, -1000];
const BENCHMARK_DRIFT = [-500, 400, -800, 600, -200, 300, -700];

function weekdays(startIso: string, count: number): string[] {
  const out: string[] = [];
  const day = new Date(`${startIso}T00:00:00Z`);
  while (out.length < count) {
    const dow = day.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return out;
}

function buildPoints(withBenchmark: boolean): EquityPoint[] {
  let equity = INITIAL_CAPITAL_PAISE;
  let benchmark = INITIAL_CAPITAL_PAISE;
  return weekdays("2026-03-02", 120).map((date, i) => {
    if (i > 0) {
      equity += (EQUITY_STEPS[i % 11]! + EQUITY_DRIFT[i % 7]!) * 100;
      benchmark += (BENCHMARK_STEPS[i % 11]! + BENCHMARK_DRIFT[i % 7]!) * 100;
    }
    return { date, equityPaise: equity, benchmarkPaise: withBenchmark ? benchmark : null };
  });
}

export const equityWithBenchmark = buildPoints(true);
export const equityOnly = buildPoints(false);
