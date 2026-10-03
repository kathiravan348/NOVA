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
from nova_backtest.intraday.guard import Guard, Verdict
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
                values: dict[str, Any] = {"family": "trend", **fields}
                return Candidate(
                    at_ms=end,
                    symbol=self.stock.symbol,
                    setup="scripted",
                    bar=i,
                    price=int(self.stock.bars1.close[i]),
                    **values,
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


HUGE_CAPITAL = 10**12  # paise: account limits never bind unless a test sets them


class FixedQtyGuard(Guard):
    """The real guard, but every passing entry asks for at most `qty` shares (`qty(candidate
    price)` when callable), so fill and exit tests control the size."""

    def __init__(
        self, qty: int | Callable[[int], int], capital: int = HUGE_CAPITAL, **account: Any
    ) -> None:
        from nova_contracts import default_research_settings

        settings = default_research_settings().account.model_copy(update=account)
        super().__init__(settings, capital, {}, lambda _b, _s: 0)
        self.fixed = qty

    def review_entry(self, symbol: str, *args: Any, **kwargs: Any) -> Verdict:
        verdict = super().review_entry(symbol, *args, **kwargs)
        if verdict.hold is None:
            return verdict
        price = args[3]
        cap = self.fixed(price) if callable(self.fixed) else self.fixed
        if cap <= 0:
            self.release(verdict.hold)
            return Verdict(0, ["zero_qty"], None)
        verdict.hold.value = min(verdict.qty, cap) * price
        return Verdict(min(verdict.qty, cap), [], verdict.hold)


def replay(
    tapes: dict[str, Sequence[T]],
    plans: dict[str, dict[str, dict[str, Any]]],
    execution: Execution = BASE,
    qty: int | Callable[[int], int] | Guard = 100,
    tick_size: int = 5,
    when: Timing | None = None,
    charges: OrderCharges | None = None,
    cls: type[DayReplay] = DayReplay,
) -> DayReplay:
    stocks = {s: stock_day(s, tape) for s, tape in tapes.items()}
    setups: dict[str, StockSetup] = {
        s: ScriptedSetup(stock, plans.get(s, {})) for s, stock in stocks.items()
    }
    guard = qty if isinstance(qty, Guard) else FixedQtyGuard(qty)
    run = cls(
        stocks,
        setups,
        execution,
        when or timing(),
        dict.fromkeys(stocks, tick_size),
        DepthAt(eager_depth),
        charges or flat_charges(),
        guard,
    )
    run.run()
    return run


def minute_tape(
    start: str,
    end: str,
    price: int,
    spread: int = 10,
    every_s: int = 20,
    volume_step: int = 0,
    **extra: Any,
) -> list[T]:
    """Calm ticks every `every_s` seconds from `start` to `end` (IST `HH:MM:SS`, end excluded);
    with `volume_step` the day volume grows by that much a tick from 09:15."""
    out: list[T] = []
    t = ms(start)
    while t < ms(end):
        clock = datetime.fromtimestamp(t / 1000, UTC).astimezone(IST).strftime("%H:%M:%S")
        if volume_step:
            extra["volume"] = (t - ms("09:15:00")) // (every_s * 1000) * volume_step
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


def insert_history_days(
    db: Session,
    symbol: str,
    days: Sequence[date],
    price: int = 10_000,
    half_range: int = 50,
    volume: int = 1_000,
) -> None:
    """Kite 1m candles for whole sessions (375 a day) with their `candle_days` rows."""
    for day in days:
        start = datetime.combine(day, time(9, 15), IST).astimezone(UTC)
        for minute in range(375):
            db.execute(
                text(
                    "INSERT INTO candles (exchange, symbol, timeframe, ts, open_paise, high_paise,"
                    " low_paise, close_paise, volume) VALUES ('NSE', :symbol, '1m', :ts, :price,"
                    " :high, :low, :price, :volume)"
                ),
                {
                    "symbol": symbol,
                    "ts": start + timedelta(minutes=minute),
                    "price": price,
                    "high": price + half_range,
                    "low": price - half_range,
                    "volume": volume,
                },
            )
        db.execute(
            text(
                "INSERT INTO candle_days (exchange, symbol, timeframe, day, bars)"
                " VALUES ('NSE', :symbol, '1m', :day, 375)"
            ),
            {"symbol": symbol, "day": day},
        )


def research_settings(**groups: dict[str, Any]) -> dict[str, Any]:
    """Default research settings (camelCase JSON) with some fields changed per group."""
    from nova_contracts import default_research_settings

    values = default_research_settings().model_dump(mode="json", by_alias=True)
    for group, fields in groups.items():
        values[group] |= fields
    return values


Ohlc = tuple[str, int, int, int, int]  # IST "HH:MM", open, high, low, close


def bar_tape(
    minutes: Sequence[Ohlc],
    spread: int = 4,
    vwap: int | Callable[[int], int] | dict[str, int] = 0,
    volume_per_minute: int = 3_000,
) -> list[T]:
    """Five ticks a minute (open :05, high :20, low :35, close :50 and :59) so each 1m bar has
    exactly the given OHLC and a fresh quote at its close; the day volume grows
    `volume_per_minute` a minute; `vwap` = a price or f(price)."""
    out: list[T] = []
    for clock, *prices in minutes:
        hh, mm = (int(x) for x in clock.split(":"))
        elapsed = (hh * 60 + mm) - (9 * 60 + 15)
        for second, price in zip((5, 20, 35, 50, 59), [*prices, prices[-1]], strict=True):
            if isinstance(vwap, dict):
                average = vwap.get(clock, 0)
            else:
                average = vwap(price) if callable(vwap) else vwap
            out.append(
                T(
                    f"{clock}:{second:02d}",
                    price,
                    bid=price - spread // 2,
                    ask=price + spread // 2,
                    volume=elapsed * volume_per_minute + second * volume_per_minute // 60,
                    vwap=average,
                )
            )
    return out


def flat_minutes(start: str, end: str, price: int, half: int = 0) -> list[Ohlc]:
    """Bars from `start` to `end` (IST "HH:MM", end excluded) around `price`."""
    out: list[Ohlc] = []
    h, m = (int(x) for x in start.split(":"))
    eh, em = (int(x) for x in end.split(":"))
    while (h, m) < (eh, em):
        out.append((f"{h:02d}:{m:02d}", price, price + half, price - half, price))
        h, m = (h + 1, 0) if m == 59 else (h, m + 1)
    return out


def earlier_sessions(count: int = 20, price: int = 10_000, half: int = 50) -> Any:
    """`count` flat Kite sessions before DAY (warm-up), oldest first."""
    from nova_backtest.intraday.context import DayBars, History

    sessions = []
    for k in range(count):
        day = DAY - timedelta(days=count - k)
        open_ms = ms("09:15:00", day)
        start = open_ms + np.arange(375, dtype=np.int64) * 60_000

        def same(value: int) -> Any:  # Any: an int64 array
            return np.full(375, value, dtype=np.int64)

        sessions.append(
            DayBars(
                open_ms,
                start,
                same(price + half),
                same(price - half),
                same(price),
                same(price),
                same(1_000),
                "history",
            )
        )
    return History(sessions)


def live_replay(
    tapes: dict[str, Sequence[T]],
    setup: dict[str, Any],
    history: Any = None,
    market_gate: bool = False,
    **signal: Any,
) -> DayReplay:
    """A whole day through the real setup, context, signal checks and account guard (default
    profile on ₹10 L, no charges, the market gate switched off) with flat Kite warm-up sessions."""
    from nova_backtest.intraday.context import build_context
    from nova_backtest.intraday.gate import IndexGate
    from nova_backtest.intraday.guard import SignalChecks
    from nova_backtest.intraday.setups import factory_for
    from nova_contracts import StrategySpecIntraday, default_research_settings

    settings = default_research_settings()
    signals = settings.signal.model_copy(update=signal)
    market = settings.market.model_copy(update={"market_gate": market_gate})
    spec = StrategySpecIntraday.model_validate(ORR_SPEC | {"setup": setup})
    make = factory_for(spec.setup)
    stocks: dict[str, StockDay] = {}
    for symbol, tape in tapes.items():
        plain = stock_day(symbol, tape)
        context = build_context(plain.bars1, plain.bars5, history or earlier_sessions(), signals)
        stocks[symbol] = StockDay(symbol, DAY, plain.ticks, plain.bars1, plain.bars5, context)
    gate = IndexGate(market, None, None, ms("09:15:00"))
    guard = Guard(settings.account, 100_000_000, {}, lambda _b, _s: 0)
    run = DayReplay(
        stocks,
        {s: make(spec.setup, stock) for s, stock in stocks.items()},
        BASE,
        timing(),
        dict.fromkeys(stocks, 5),
        DepthAt(eager_depth),
        flat_charges(),
        guard,
        SignalChecks(
            signals,
            {s: stock.context for s, stock in stocks.items() if stock.context is not None},
            gate,
        ),
    )
    run.run()
    return run


def with_context(
    stock: StockDay,
    atr: float,
    prev_high: int | None = None,
    prev_low: int | None = None,
    vwap: float | None = None,
) -> StockDay:
    """The stock-day with a hand-set context: constant ATR (and VWAP), previous session levels."""
    from nova_backtest.intraday.context import StockContext

    n = len(stock.bars1)
    nan = np.full(n, np.nan)
    context = StockContext(
        atr=np.full(n, atr),
        ema=nan,
        ema_before=nan,
        close5=nan,
        span6=nan,
        vwap=nan if vwap is None else np.full(n, vwap),
        rel_volume=nan,
        prev_high=prev_high,
        prev_low=prev_low,
        sources=frozenset(),
    )
    return StockDay(stock.symbol, stock.day, stock.ticks, stock.bars1, stock.bars5, context)
