import type { Candle } from "./types";

// Fixed per-bar moves (in paise) of co-prime cycle length, so bars look irregular.
const MOVES = [1250, -830, 460, -1510, 2140, -390, 780, -1120, 960, -270, 1480];
const WICKS = [320, 540, 180, 710, 260, 430, 610];
const VOLUMES = [182_400, 96_300, 143_800, 221_500, 118_900, 167_200, 88_700, 204_100];

function buildCandles(times: string[], startPaise: number, scale: number): Candle[] {
  let open = startPaise;
  return times.map((time, i) => {
    const close = open + MOVES[i % MOVES.length]! * scale;
    const wick = WICKS[i % WICKS.length]! * scale;
    const candle: Candle = {
      time,
      openPaise: open,
      highPaise: Math.max(open, close) + wick,
      lowPaise: Math.min(open, close) - Math.round(wick * 0.8),
      closePaise: close,
      volume: VOLUMES[i % VOLUMES.length]! * scale,
    };
    open = close;
    return candle;
  });
}

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

/** 5-minute bars of one NSE session: 09:15–15:25 IST = 03:45–09:55 UTC. */
function sessionBars(dateIso: string, count: number): string[] {
  const start = Date.parse(`${dateIso}T03:45:00Z`);
  return Array.from({ length: count }, (_, i) =>
    new Date(start + i * 5 * 60_000).toISOString().replace(".000Z", "Z"),
  );
}

export const dailyCandles = buildCandles(weekdays("2026-06-15", 60), 2_456_000, 4);
export const intradayCandles = buildCandles(sessionBars("2026-09-21", 75), 2_512_000, 1);
export const dailyCandlesNoVolume: Candle[] = dailyCandles.map((c) => ({
  time: c.time,
  openPaise: c.openPaise,
  highPaise: c.highPaise,
  lowPaise: c.lowPaise,
  closePaise: c.closePaise,
}));
