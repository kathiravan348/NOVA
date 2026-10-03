"""One recorded session of an intraday run (D84, `docs/INTRADAY-RESEARCH.md` §5).

Signals come from 1m closes; ticks are read only for open positions and entry attempts. The day is
walked minute by minute: first every tick of the minute that matters, in time order (at equal times
exits before entries, then by symbol), then the 1m bars that closed at the minute's end feed the
setups, whose candidates are checked and tried at close + delay.
Exits (§5.1): a stop when a tick's best bid ≤ stop, a target when it is ≥ target, a time exit at
`maxHoldMinutes` after the first fill, square-off at `squareOff`; each fills from trigger + delay
on, walking the bid levels; what is left waits for later ticks. Still held at 15:30 →
**unresolved**: valued at the stock's last bid of the day (its stop when it had none), never at
a better price.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date

import numpy as np
from nova_contracts.trade import ExitReason

from nova_backtest.intraday import fills
from nova_backtest.intraday.fills import DepthAt, Execution, Fill, LevelUse, Refusal
from nova_backtest.intraday.position import Order, OrderCharges, Position
from nova_backtest.intraday.setups import Candidate, StockDay, StockSetup
from nova_backtest.intraday.tick_data import MINUTE_MS, ist_ms, session_ms

UNRESOLVED_AT_MS = 1_000  # an unresolved position is valued at 15:29:59


@dataclass(frozen=True)
class Timing:
    """The profile's timing group for one day, in epoch ms."""

    earliest_entry_ms: int
    last_entry_ms: int
    square_off_ms: int
    max_hold_ms: int

    @classmethod
    def of(
        cls, day: date, earliest: str, last: str, square_off: str, max_hold_minutes: int
    ) -> "Timing":
        return cls(
            ist_ms(day, earliest),
            ist_ms(day, last),
            ist_ms(day, square_off),
            max_hold_minutes * MINUTE_MS,
        )


@dataclass
class Decision:
    """One candidate (or add) and what became of it (NOVA-186 stores these)."""

    at_ms: int
    symbol: str
    setup: str
    action: str  # entry | add
    requested_qty: int
    outcome: str = "skipped"  # filled | partial | skipped
    first_reason: str | None = None
    reasons: list[str] = field(default_factory=list)
    filled_qty: int = 0
    position: Position | None = None

    def skip(self, reasons: list[str] | tuple[str, ...]) -> None:
        self.outcome, self.first_reason, self.reasons = "skipped", reasons[0], list(reasons)


@dataclass
class Pending:
    candidate: Candidate
    attempt_ms: int
    want: int
    decision: Decision


# A candidate → the shares to ask for (0 = `zero_qty`); NOVA-186 replaces this with risk sizing.
Sizer = Callable[[Candidate], int]


class DayReplay:
    def __init__(
        self,
        stocks: dict[str, StockDay],
        setups: dict[str, StockSetup],
        execution: Execution,
        timing: Timing,
        tick_sizes: dict[str, int],
        depth_at: DepthAt,
        order_charges: OrderCharges,
        size: Sizer,
    ) -> None:
        self.stocks, self.setups = stocks, setups
        self.execution, self.timing = execution, timing
        self.tick_sizes, self.depth_at = tick_sizes, depth_at
        self.order_charges, self.size = order_charges, size
        self.open: dict[str, Position] = {}
        self.pending: dict[str, Pending] = {}
        self.closed: list[Position] = []
        self.decisions: list[Decision] = []
        self.levels = LevelUse()
        self._from_tick: dict[str, int] = {}  # exits read ticks after the entry's tick

    def run(self) -> None:
        if not self.stocks:
            return
        open_ms, close_ms = session_ms(next(iter(self.stocks.values())).day)
        closes: dict[int, list[tuple[str, int]]] = {}
        for symbol in sorted(self.stocks):
            for i, end in enumerate(self.stocks[symbol].bars1.end.tolist()):
                closes.setdefault(int(end), []).append((symbol, i))
        start = open_ms
        for end in range(open_ms + MINUTE_MS, close_ms + 1, MINUTE_MS):
            self._ticks(start, end)
            self._bar_closes(end, closes.get(end, []))
            start = end
        self._session_end(close_ms)

    # ---- ticks between two minute ends -------------------------------------------------------

    def _ticks(self, start: int, end: int) -> None:
        events: list[tuple[int, int, str, int]] = []
        for symbol in set(self.open) | set(self.pending):
            ts = self.stocks[symbol].ticks.ts
            lo = int(np.searchsorted(ts, start, side="left"))
            hi = int(np.searchsorted(ts, end, side="left"))
            for i in range(lo, hi):
                events.append((int(ts[i]), 0, symbol, i))
        for symbol, pending in self.pending.items():
            if start <= pending.attempt_ms < end:
                events.append((pending.attempt_ms, 1, symbol, -1))
        for moment, phase, symbol, i in sorted(events):
            if phase == 0:
                self._exit_tick(symbol, i, moment)
            elif symbol in self.pending:
                self._attempt(self.pending.pop(symbol))

    def _exit_tick(self, symbol: str, i: int, moment: int) -> None:
        position = self.open.get(symbol)
        if position is None or i <= self._from_tick[symbol]:
            return
        ticks = self.stocks[symbol].ticks
        bid = int(ticks.bid[i])
        if position.exit_reason is None:
            self._check_exit(position, bid, moment)
        if position.exit_from_ms is not None and moment >= position.exit_from_ms:
            self._sell(position, i)

    def _check_exit(self, position: Position, bid: int, moment: int) -> None:
        delay = self.execution.delay_ms
        hold_end = position.opened_ms + self.timing.max_hold_ms
        reason: ExitReason | None = None
        trigger_at = moment
        if 0 < bid <= position.stop:
            reason = "stop"
        elif position.target is not None and bid >= position.target > 0:
            reason = "target"
        elif moment >= hold_end:
            reason, trigger_at = "time_exit", hold_end
        elif moment >= self.timing.square_off_ms:
            reason, trigger_at = "square_off", self.timing.square_off_ms
        if reason is not None:
            position.trigger(reason, trigger_at, delay)

    def _sell(self, position: Position, i: int) -> None:
        symbol = position.symbol
        fill = fills.sell(
            self.stocks[symbol].ticks,
            self.depth_at,
            i,
            position.held,
            self.execution,
            self.tick_sizes[symbol],
            self.levels,
        )
        if fill is None:
            return
        position.sells.append(self._order("sell", fill.at_ms, fill.qty, fill.value))
        if position.closed:
            self._close(position)

    def _close(self, position: Position) -> None:
        del self.open[position.symbol]
        self.closed.append(position)

    def _order(self, side: str, at: int, qty: int, value: int) -> Order:
        return Order(at, qty, value, self.order_charges(side, value, at))

    # ---- 1m closes ---------------------------------------------------------------------------

    def _bar_closes(self, end: int, bars: list[tuple[str, int]]) -> None:
        candidates: list[Candidate] = []
        for symbol, i in bars:
            candidate = self.setups[symbol].on_bar(i)
            if candidate is None or symbol in self.open or symbol in self.pending:
                continue  # a stock with a position or an entry under way takes no new candidate
            candidates.append(candidate)
        for candidate in sorted(candidates, key=lambda c: (c.at_ms, c.symbol)):
            self._decide(candidate)

    def _decide(self, candidate: Candidate) -> None:
        attempt = candidate.at_ms + self.execution.delay_ms
        decision = Decision(candidate.at_ms, candidate.symbol, candidate.setup, "entry", 0)
        self.decisions.append(decision)
        reasons: list[str] = []
        if not self.timing.earliest_entry_ms <= attempt < self.timing.last_entry_ms:
            reasons.append("entry_window")
        want = self.size(candidate)
        decision.requested_qty = want
        if want <= 0:
            reasons.append("zero_qty")
        if reasons:
            decision.skip(reasons)
            return
        self.pending[candidate.symbol] = Pending(candidate, attempt, want, decision)

    def _attempt(self, pending: Pending) -> None:
        candidate, decision = pending.candidate, pending.decision
        symbol = candidate.symbol
        result: Fill | Refusal = fills.buy(
            self.stocks[symbol].ticks,
            self.depth_at,
            pending.attempt_ms,
            pending.want,
            candidate.stop,
            self.execution,
            self.tick_sizes[symbol],
            self.levels,
        )
        if isinstance(result, Refusal):
            decision.skip(result.reasons)
            return
        if not self._valid_at_fill(candidate, result):
            decision.skip(["invalid_at_fill"])
            return
        first_fill = round(result.price)
        position = Position(
            candidate,
            result.at_ms,
            candidate.stop,
            candidate.target_at(first_fill),
            first_fill,
        )
        position.buys.append(self._order("buy", result.at_ms, result.qty, result.value))
        self.open[symbol] = position
        self._from_tick[symbol] = result.tick
        decision.outcome = "filled" if result.qty == pending.want else "partial"
        decision.filled_qty, decision.position = result.qty, position

    @staticmethod
    def _valid_at_fill(candidate: Candidate, fill: Fill) -> bool:
        """Risk and reward recomputed at the real price (§5.4 `invalid_at_fill`)."""
        price = fill.price
        if round(price) <= candidate.stop:
            return False
        if candidate.target is not None and candidate.min_reward_r is not None:
            return candidate.target - price >= candidate.min_reward_r * (price - candidate.stop)
        return True

    # ---- session end -------------------------------------------------------------------------

    def _session_end(self, close_ms: int) -> None:
        self.pending.clear()
        for symbol in sorted(self.open):
            position = self.open[symbol]
            ticks = self.stocks[symbol].ticks
            bids = np.asarray(ticks.bid)
            with_bid = np.flatnonzero(bids > 0)
            value_at = int(bids[with_bid[-1]]) if len(with_bid) else position.stop
            at = close_ms - UNRESOLVED_AT_MS
            position.sells.append(self._order("sell", at, position.held, position.held * value_at))
            position.exit_reason = "unresolved"
            position.unresolved = True
            self.closed.append(position)
        self.open.clear()
