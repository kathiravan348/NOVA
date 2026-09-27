"""NOVA-110 oracle: the pre-D61 `simulate` over `Bar` lists, changed only to run D61's order.

Events are grouped by time; at each time every stock runs step a (day change, square-off, pending
sells), then b (pending buys), then c (adds, stop, target), then d (close, signals). Kept simple on
purpose: the streaming simulator must give exactly the same trades and equity.
"""

from datetime import date, datetime, time
from itertools import groupby

from nova_backtest.bars import IST, Bar
from nova_backtest.book import ChargesFn, ClosedTrade, Position, percent_of, shares
from nova_backtest.scratch import Signals
from nova_backtest.simulate import Simulation
from nova_contracts import Sizing
from nova_contracts.strategy import Averaging, Risk


def reference_simulate(
    bars: dict[str, list[Bar]],
    signals: Signals,
    sizing: Sizing,
    risk: Risk,
    cash: int,
    start: datetime,
    charges: ChargesFn,
    square_off: time | None = None,
    averaging: Averaging | None = None,
) -> Simulation:
    events = sorted(
        ((bar.ts, symbol, i) for symbol, series in bars.items() for i, bar in enumerate(series)),
        key=lambda event: (event[0], event[1]),
    )
    positions: dict[str, Position] = {}
    pending: dict[str, str] = {}
    last_close: dict[str, int] = {}
    trades: list[ClosedTrade] = []
    equity: list[tuple[date, int]] = []

    def worth() -> int:
        return cash + sum(p.qty * last_close[s] for s, p in positions.items())

    def close(symbol: str, at: datetime, price: int) -> None:
        nonlocal cash
        position = positions.pop(symbol)
        entry = position.average
        cost = charges(position.qty, entry, price, position.entry_at)
        trades.append(
            ClosedTrade(
                symbol, position.qty, position.entry_at, entry, at, price, cost, position.cost
            )
        )
        cash += position.qty * price - cost.total_paise

    def stop_price_of(position: Position) -> int | None:
        stop = risk.stop_loss_percent
        return percent_of(position.average, 100 - stop) if stop else None

    def average_down(symbol: str, bar: Bar) -> None:
        nonlocal cash
        position = positions[symbol]
        while averaging is not None and position.adds < averaging.max_adds:
            trigger = percent_of(position.last_buy, 100 - averaging.drop_percent)
            stop_price = stop_price_of(position)
            if bar.low > trigger or (stop_price is not None and stop_price >= trigger):
                return
            fill = min(bar.open, trigger)
            qty = shares(sizing, worth(), fill)
            if qty < 1 or qty * fill > cash:
                return
            position.buy(qty, fill)
            position.adds += 1
            cash -= qty * fill

    def step_a(ts: datetime, symbol: str, i: int) -> bool:
        bar = bars[symbol][i]
        if square_off is not None:
            previous = bars[symbol][i - 1] if i else None
            if previous is not None and previous.ist_date != bar.ist_date:
                pending.pop(symbol, None)
                if symbol in positions:
                    close(symbol, previous.ts, previous.close)
            if bar.ts.astimezone(IST).time() >= square_off:
                pending.pop(symbol, None)
                if symbol in positions:
                    close(symbol, ts, bar.open)
                return False
        if pending.get(symbol) == "exit":
            del pending[symbol]
            if symbol in positions:
                close(symbol, ts, bar.open)
        return True

    def step_b(ts: datetime, symbol: str, i: int) -> None:
        nonlocal cash
        if pending.get(symbol) != "enter":
            return
        del pending[symbol]
        bar = bars[symbol][i]
        if symbol not in positions:
            qty = shares(sizing, worth(), bar.open)
            if qty >= 1 and qty * bar.open <= cash:
                positions[symbol] = Position(qty, ts, qty * bar.open, bar.open)
                cash -= qty * bar.open

    def step_c(ts: datetime, symbol: str, i: int) -> None:
        position = positions.get(symbol)
        if position is None:
            return
        bar = bars[symbol][i]
        average_down(symbol, bar)
        target = risk.target_percent
        stop_price = stop_price_of(position)
        target_price = percent_of(position.average, 100 + target) if target else None
        if stop_price is not None and bar.low <= stop_price:
            close(symbol, ts, min(bar.open, stop_price))
        elif target_price is not None and bar.high >= target_price:
            close(symbol, ts, max(bar.open, target_price))

    def step_d(symbol: str, i: int, active: bool) -> None:
        last_close[symbol] = bars[symbol][i].close
        if not active:
            return
        if symbol in positions:
            if signals.exit(symbol, i):
                pending[symbol] = "exit"
        elif signals.enter(symbol, i):
            pending[symbol] = "enter"

    day: date | None = None
    for ts, grouped in groupby(events, key=lambda event: event[0]):
        group = [(symbol, i) for _, symbol, i in grouped]
        if ts < start:
            for symbol, i in group:
                last_close[symbol] = bars[symbol][i].close
            continue
        bar_day = ts.astimezone(IST).date()
        if day is not None and bar_day != day:
            equity.append((day, worth()))
        day = bar_day
        active = {symbol: step_a(ts, symbol, i) for symbol, i in group}
        for symbol, i in group:
            if active[symbol]:
                step_b(ts, symbol, i)
        for symbol, i in group:
            if active[symbol]:
                step_c(ts, symbol, i)
        for symbol, i in group:
            step_d(symbol, i, active[symbol])

    for symbol in list(positions):
        final = bars[symbol][-1]
        close(symbol, final.ts, final.close)
    if day is not None:
        equity.append((day, worth()))
    return Simulation(trades=trades, equity=equity)
