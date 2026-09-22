/**
 * One OHLC bar. `time` is `YYYY-MM-DD` for `1d`, a UTC ISO string (`…Z`) for intraday (D17).
 * Props type only; the market-data contract comes with NOVA-018.
 */
export interface Candle {
  time: string;
  openPaise: number;
  highPaise: number;
  lowPaise: number;
  closePaise: number;
  volume?: number;
}
