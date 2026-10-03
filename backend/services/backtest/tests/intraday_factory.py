"""Synthetic recorded ticks for intraday simulator tests (D84). No network, no real ticks.

`T("09:30:00.250", 10_000, bid=9_995, ask=10_005)` is one tick at an IST time of `DAY`; depth has
five levels stepping one tick size away from the best price, each with `bid_qty` / `ask_qty`
shares (or explicit `bids` / `asks` lists of (price, qty)).
"""

from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

import numpy as np
from nova_backtest.bars import IST
from nova_backtest.intraday.fills import DepthAt, Execution
from nova_backtest.intraday.position import OrderCharges
from nova_backtest.intraday.replay import DayReplay, Timing
from nova_backtest.intraday.setups import Candidate, StockDay, StockSetup
from nova_backtest.intraday.tick_data import LEVELS, MINUTE_MS, DayTicks, Depth, build_bars
from nova_contracts import Charges
from sqlalchemy import text
from sqlalchemy.orm import Session

DAY = date(2026, 10, 1)
STEP = 5  # paise between depth levels
ZERO_CHARGES = Charges.model_validate(
    {
        "brokerage_paise": 0,
        "stt_paise": 0,
        "exchange_txn_paise": 0,
        "sebi_fee_paise": 0,
        "stamp_duty_paise": 0,
        "gst_paise": 0,
        "dp_paise": 0,
        "total_paise": 0,
    }
)
BASE = Execution(
    delay_ms=250,
    slippage_ticks=0,
    max_quote_age_ms=1500,
    max_spread_bps=8,
    max_spread_to_stop_percent=10,
    max_depth_percent=10,
    min_fill_percent=25,
)


def ms(clock: str, day: date = DAY) -> int:
    """`HH:MM:SS(.mmm)` IST on `day` → UTC epoch milliseconds."""
    whole, _, frac = clock.partition(".")
    h, m, s = (int(x) for x in whole.split(":"))
    moment = datetime.combine(day, time(h, m, s), IST).astimezone(UTC)
    return int(moment.timestamp()) * 1000 + (int(frac.ljust(3, "0")) if frac else 0)


@dataclass(frozen=True)
class T:
    at: str
    ltp: int
    bid: int = 0
    ask: int = 0
    bid_qty: int = 10_000
    ask_qty: int = 10_000
    volume: int = 0
    vwap: int = 0
    bids: Sequence[tuple[int, int]] | None = None
    asks: Sequence[tuple[int, int]] | None = None

    def levels(self, side: str) -> list[tuple[int, int]]:
        given = self.bids if side == "bid" else self.asks
        if given is not None:
            rows = list(given)
        else:
            best = self.bid if side == "bid" else self.ask
            qty = self.bid_qty if side == "bid" else self.ask_qty
            step = -STEP if side == "bid" else STEP
            rows = [(best + k * step, qty) for k in range(LEVELS)] if best > 0 else []
        return (rows + [(0, 0)] * LEVELS)[:LEVELS]


def day_ticks(symbol: str, tape: Sequence[T], day: date = DAY) -> DayTicks:
    rows = sorted(tape, key=lambda t: ms(t.at, day))
    volume = 0
    columns: dict[str, list[int]] = {n: [] for n in ("ts", "ltp", "volume", "vwap", "bid", "ask")}
    depth: dict[str, list[list[int]]] = {n: [] for n in ("bid_px", "bid_qty", "ask_px", "ask_qty")}
    for t in rows:
        volume = max(volume, t.volume)
        bids, asks = t.levels("bid"), t.levels("ask")
        for name, value in (
            ("ts", ms(t.at, day)),
            ("ltp", t.ltp),
            ("volume", volume),
            ("vwap", t.vwap),
            ("bid", bids[0][0]),
            ("ask", asks[0][0]),
        ):
            columns[name].append(value)
        depth["bid_px"].append([p for p, _ in bids])
        depth["bid_qty"].append([q for _, q in bids])
        depth["ask_px"].append([p for p, _ in asks])
        depth["ask_qty"].append([q for _, q in asks])

    def matrix(name: str) -> Any:  # Any: an int64 matrix
        return np.array(depth[name], dtype=np.int64).reshape(len(rows), LEVELS)

    arrays = {k: np.array(v, dtype=np.int64) for k, v in columns.items()}
    full = Depth(matrix("bid_px"), matrix("bid_qty"), matrix("ask_px"), matrix("ask_qty"))
    return DayTicks.from_arrays(symbol, day, arrays, full)


def eager_depth(ticks: DayTicks, lo: int, hi: int) -> tuple[int, Depth]:
    assert ticks.depth is not None
    d = ticks.depth
    return lo, Depth(d.bid_px[lo:hi], d.bid_qty[lo:hi], d.ask_px[lo:hi], d.ask_qty[lo:hi])


def stock_day(symbol: str, tape: Sequence[T], day: date = DAY) -> StockDay:
    ticks = day_ticks(symbol, tape, day)
    return StockDay(
        symbol, day, ticks, build_bars(ticks, MINUTE_MS), build_bars(ticks, 5 * MINUTE_MS)
    )


@dataclass
class ScriptedSetup:
    """A test setup: emits the given candidates at the 1m closes (IST `HH:MM`) they name."""

    stock: StockDay
    plan: dict[str, dict[str, Any]]  # close time → Candidate fields (stop, target_r, …)
    seen: list[int] = field(default_factory=list)

    def on_bar(self, i: int) -> Candidate | None:
        self.seen.append(i)
        end = int(self.stock.bars1.end[i])
        for clock, fields in self.plan.items():
            if ms(f"{clock}:00", self.stock.day) == end:
                return Candidate(
                    at_ms=end,
                    symbol=self.stock.symbol,
                    setup="scripted",
                    family="trend",
                    bar=i,
                    price=int(self.stock.bars1.close[i]),
                    **fields,
                )
        return None


def flat_charges(per_order: int = 0) -> OrderCharges:
    def charges(side: str, value: int, at: int) -> Charges:
        return ZERO_CHARGES.model_copy(
            update={"brokerage_paise": per_order, "total_paise": per_order}
        )

    return charges


def timing(
    earliest: str = "09:30", last: str = "14:30", square_off: str = "15:20", hold: int = 60
) -> Timing:
    return Timing.of(DAY, earliest, last, square_off, hold)


def replay(
    tapes: dict[str, Sequence[T]],
    plans: dict[str, dict[str, dict[str, Any]]],
    execution: Execution = BASE,
    qty: int | Callable[[Candidate], int] = 100,
    tick_size: int = 5,
    when: Timing | None = None,
    charges: OrderCharges | None = None,
    cls: type[DayReplay] = DayReplay,
) -> DayReplay:
    stocks = {s: stock_day(s, tape) for s, tape in tapes.items()}
    setups: dict[str, StockSetup] = {
        s: ScriptedSetup(stock, plans.get(s, {})) for s, stock in stocks.items()
    }
    size = qty if callable(qty) else (lambda _c: qty)
    run = cls(
        stocks,
        setups,
        execution,
        when or timing(),
        dict.fromkeys(stocks, tick_size),
        DepthAt(eager_depth),
        charges or flat_charges(),
        size,
    )
    run.run()
    return run


def minute_tape(
    start: str, end: str, price: int, spread: int = 10, every_s: int = 20, **extra: Any
) -> list[T]:
    """Calm ticks every `every_s` seconds from `start` to `end` (IST `HH:MM:SS`, end excluded)."""
    out: list[T] = []
    t = ms(start)
    while t < ms(end):
        clock = datetime.fromtimestamp(t / 1000, UTC).astimezone(IST).strftime("%H:%M:%S")
        out.append(T(clock, price, bid=price - spread // 2, ask=price + spread // 2, **extra))
        t += every_s * 1000
    return out


# ---- database helpers (engine and API tests) ----------------------------------------------------


def insert_ticks(db: Session, symbol: str, tape: Sequence[T], day: date = DAY) -> None:
    """Writes ticks (received 50 ms after the exchange time) plus the day's `tick_days` row."""
    for n, t in enumerate(sorted(tape, key=lambda t: ms(t.at, day))):
        exchange = datetime.fromtimestamp(ms(t.at, day) / 1000, UTC)
        bids, asks = t.levels("bid"), t.levels("ask")
        db.execute(
            text(
                "INSERT INTO ticks (exchange, symbol, received_at, exchange_ts, last_price_paise,"
                " last_qty, volume, avg_price_paise, bid_price_paise, bid_qty, ask_price_paise,"
                " ask_qty) VALUES ('NSE', :symbol, :received, :exchange, :ltp, 1, :volume,"
                " :vwap, :bp, :bq, :ap, :aq)"
            ),
            {
                "symbol": symbol,
                "received": exchange + timedelta(milliseconds=50 + n % 10),
                "exchange": exchange,
                "ltp": t.ltp,
                "volume": t.volume,
                "vwap": t.vwap or None,
                "bp": [p for p, _ in bids],
                "bq": [q for _, q in bids],
                "ap": [p for p, _ in asks],
                "aq": [q for _, q in asks],
            },
        )
    db.execute(
        text(
            "INSERT INTO tick_days (exchange, symbol, day, ticks, size_bytes, seconds_with_tick)"
            " VALUES ('NSE', :symbol, :day, :n, 0, 0)"
        ),
        {"symbol": symbol, "day": day, "n": len(tape)},
    )


def insert_session(db: Session, day: date = DAY, longest_gap: int | None = 5) -> None:
    db.execute(
        text(
            "INSERT INTO tick_sessions (day, stocks, ticks, feed_gap_seconds,"
            " longest_feed_gap_seconds, summarized_at) VALUES (:day, 1, 1, 0, :gap, now())"
        ),
        {"day": day, "gap": longest_gap},
    )


ORR_SPEC: dict[str, Any] = {
    "mode": "intraday",
    "segment": "equity_intraday",
    "exchange": "NSE",
    "timeframe": "1m",
    "setup": {
        "kind": "opening_range_retest",
        "rangeMinutes": 15,
        "retestBars": 3,
        "bufferAtr": 0.1,
        "targetR": 2,
    },
    "buying": {"kind": "single"},
}


def seed_intraday_run(
    db: Session,
    symbols: Sequence[str],
    spec: dict[str, Any] | None = None,
    scenario: str = "base",
    settings: dict[str, Any] | None = None,
    capital: int = 100_000_000,
    first: date = DAY,
    last: date = DAY,
    run_id: str = "run_i",
) -> str:
    """A frozen profile (defaults, or `settings`), strategy `stg_i` and a queued recorded run."""
    from nova_contracts import default_research_settings
    from nova_db.models import (
        BacktestRun,
        ResearchProfile,
        ResearchProfileVersion,
        Strategy,
        StrategyVersion,
    )

    values = settings or default_research_settings().model_dump(mode="json", by_alias=True)
    if db.get(ResearchProfile, "rp_1") is None:
        db.add(ResearchProfile(id="rp_1", name="Intraday v1"))
        db.add(Strategy(id="stg_i", name="ORR", status="draft", latest_version=1))
        db.flush()
        db.add(
            ResearchProfileVersion(
                profile_id="rp_1",
                version=1,
                settings=values,
                frozen=True,
                hash="a" * 64,
                frozen_at=datetime.now(UTC),
            )
        )
        db.add(StrategyVersion(strategy_id="stg_i", version=1, spec=spec or ORR_SPEC))
        db.flush()
    db.add(
        BacktestRun(
            id=run_id,
            strategy_id="stg_i",
            strategy_version=1,
            name="Intraday test",
            universe={"type": "symbols", "symbols": list(symbols)},
            status="queued",
            date_from=first,
            date_to=last,
            initial_capital_paise=capital,
            benchmark=None,
            data_source="recorded",
            profile_id="rp_1",
            profile_version=1,
            scenario=scenario,
        )
    )
    db.commit()
    return run_id
