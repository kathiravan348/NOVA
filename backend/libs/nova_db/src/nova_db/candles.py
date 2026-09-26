"""Price bars for any timeframe (D58): `1m` and `1d` are stored, `3m`–`1h` are rolled up from `1m`.

Buckets start at 09:15 IST like Kite's own candles, so a day's last bucket can be short
(e.g. 1h 15:15–15:30). Stored `3m`–`1h` rows from older downloads are never read.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from nova_db.models import Candle

STORED = ("1m", "1d")
ROLLED_UP = {"3m": "3 minutes", "5m": "5 minutes", "15m": "15 minutes", "30m": "30 minutes"}
ROLLED_UP["1h"] = "1 hour"
# 2000-01-03 09:15 IST: every bucket starts at the market open.
ORIGIN = "2000-01-03 03:45:00+00"

_ROLL_UP = text(
    f"""
    SELECT time_bucket(CAST(:width AS interval), ts, origin => TIMESTAMPTZ '{ORIGIN}') AS ts,
           first(open_paise, ts) AS open_paise, max(high_paise) AS high_paise,
           min(low_paise) AS low_paise, last(close_paise, ts) AS close_paise,
           sum(volume) AS volume
    FROM candles
    WHERE exchange = :exchange AND symbol = :symbol AND timeframe = '1m'
      AND ts >= :start AND ts < :end
    GROUP BY 1
    ORDER BY 1
    """
)


@dataclass(frozen=True)
class BarRow:
    ts: datetime
    open_paise: int
    high_paise: int
    low_paise: int
    close_paise: int
    volume: int


def source_timeframe(timeframe: str) -> str:
    """The stored timeframe a timeframe is read from: itself for `1m`/`1d`, else `1m`."""
    return timeframe if timeframe in STORED else "1m"


def read_bars(
    db: Session, exchange: str, symbol: str, timeframe: str, start: datetime, end: datetime
) -> list[BarRow]:
    """Bars with `start <= ts < end`, ordered by `ts`; a rolled-up bar's `ts` is its start."""
    if timeframe in STORED:
        rows = db.execute(
            select(
                Candle.ts,
                Candle.open_paise,
                Candle.high_paise,
                Candle.low_paise,
                Candle.close_paise,
                Candle.volume,
            )
            .where(
                Candle.exchange == exchange,
                Candle.symbol == symbol,
                Candle.timeframe == timeframe,
                Candle.ts >= start,
                Candle.ts < end,
            )
            .order_by(Candle.ts)
        )
    elif timeframe in ROLLED_UP:
        params = {"width": ROLLED_UP[timeframe], "exchange": exchange, "symbol": symbol}
        rows = db.execute(_ROLL_UP, params | {"start": start, "end": end})
    else:
        raise ValueError(f"Unknown timeframe {timeframe}")
    return [BarRow(r[0], r[1], r[2], r[3], r[4], int(r[5])) for r in rows]
