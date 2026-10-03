"""The account guard of an intraday run (D84, `docs/INTRADAY-RESEARCH.md` §2 Account, §5.2–§5.4).

Limits are percents of the run's starting capital. The guard keeps, per run: cash, the capital each
open or pending position holds (first buys count against `initialPoolPercent`, adds against
`addPoolPercent`, released when the position closes), its risk (loss at the stop incl. charges),
and per day: realised P&L, new positions, the losing streak, cooldowns and the shutdown flag.
A candidate goes through the checks in the §5.4 order; the first failure is its skip reason and
every failure is kept. A passing candidate reserves its capacity at once, so candidates of the same
moment, taken in ranked order, never spend the same pool twice.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Literal

from nova_contracts.research_profile import ResearchAccount

from nova_backtest.intraday.sizing import CostToClose, loss_at_stop, loss_of, money_qty, risk_qty

REASONS = (
    "entry_window",
    "daily_shutdown",
    "loss_pause",
    "daily_new_limit",
    "cooldown",
    "market_gate",
    "context",
    "relative_volume",
    "warmup",
    "stop_too_narrow",
    "stop_too_wide",
    "reward_room",
    "max_positions",
    "stock_cap",
    "sector_cap",
    "initial_pool",
    "add_pool",
    "cash_reserve",
    "open_risk",
    "position_risk",
    "no_quote",
    "stale_quote",
    "wide_spread",
    "spread_to_stop",
    "too_little_depth",
    "zero_qty",
    "invalid_at_fill",
)
UNCLASSIFIED = "Unclassified"
Pool = Literal["initial", "add"]


def ordered(reasons: Sequence[str]) -> list[str]:
    """Reasons in the §5.4 order, each once."""
    return sorted(set(reasons), key=REASONS.index)


@dataclass
class Hold:
    """Capacity a pending or open buy holds until its position closes."""

    symbol: str
    pool: Pool
    value: int  # committed capital (paise)
    risk: int  # loss at the stop incl. charges (paise)
    allowance: int  # the risk room it was sized with
    money_cap: int  # the money room it was sized with
    filled: bool = False


@dataclass(frozen=True)
class Verdict:
    qty: int
    reasons: list[str]
    hold: Hold | None


@dataclass
class DayState:
    realised: int = 0
    new_positions: int = 0
    streak: int = 0  # losing positions in a row (a zero result does not reset it)
    shutdown: bool = False
    cooldown_until: dict[str, int] = field(default_factory=dict)


class Guard:
    def __init__(
        self,
        account: ResearchAccount,
        capital: int,
        sectors: dict[str, str],
        costs: CostToClose,
    ) -> None:
        self.account, self.capital, self.costs = account, capital, costs
        self.sectors = sectors
        self.cash = capital
        self.holds: dict[str, list[Hold]] = {}
        self.day = DayState()

    def pct(self, percent: float) -> int:
        return int(self.capital * percent / 100)

    def sector(self, symbol: str) -> str:
        return self.sectors.get(symbol) or UNCLASSIFIED

    def start_day(self) -> None:
        self.day = DayState()

    # ---- what is held --------------------------------------------------------------------------

    def _all(self) -> list[Hold]:
        return [h for holds in self.holds.values() for h in holds]

    def committed(self, pool: Pool | None = None) -> int:
        return sum(h.value for h in self._all() if pool is None or h.pool == pool)

    def exposure(self, symbol: str, marks: dict[str, int]) -> int:
        """Capital a stock holds: its committed capital or, if higher, its marked value."""
        committed = sum(h.value for h in self.holds.get(symbol, []))
        return max(committed, marks.get(symbol, 0))

    def sector_exposure(self, sector: str, marks: dict[str, int]) -> int:
        return sum(self.exposure(s, marks) for s in self.holds if self.sector(s) == sector)

    def open_risk(self) -> int:
        return sum(h.risk for h in self._all())

    # ---- a new entry ---------------------------------------------------------------------------

    def review_entry(
        self,
        symbol: str,
        attempt_ms: int,
        window: tuple[int, int],
        signal_reasons: Sequence[str],
        price: int,
        stop: int,
        marks: dict[str, int],
        decided_ms: int,
    ) -> Verdict:
        """Every §5.4 check before the attempt for a first buy at about `price`."""
        a = self.account
        reasons: list[str] = []
        if not window[0] <= attempt_ms < window[1]:
            reasons.append("entry_window")
        if self.day.shutdown:
            reasons.append("daily_shutdown")
        if a.loss_streak_pause > 0 and self.day.streak >= a.loss_streak_pause:
            reasons.append("loss_pause")
        if self.day.new_positions >= a.max_new_positions_per_day:
            reasons.append("daily_new_limit")
        if decided_ms < self.day.cooldown_until.get(symbol, 0):
            reasons.append("cooldown")
        reasons.extend(signal_reasons)
        if len(self.holds) >= a.max_positions:
            reasons.append("max_positions")
        limits = self._money_rooms(symbol, "initial", marks)
        quantities = []
        for reason, room in limits:
            qty = money_qty(price, room)
            if qty <= 0:
                reasons.append(reason)
            quantities.append(qty)
        open_room = self.pct(a.open_risk_percent) - self.open_risk()
        position_room = self.pct(a.risk_per_position_percent)
        for reason, room in (("open_risk", open_room), ("position_risk", position_room)):
            qty = risk_qty(price, stop, room, self.costs)
            if qty <= 0:
                reasons.append(reason)
            quantities.append(qty)
        if reasons:
            return Verdict(0, ordered(reasons), None)
        qty = min(quantities)
        if qty <= 0:
            return Verdict(0, ["zero_qty"], None)
        allowance = min(open_room, position_room)
        money_cap = min(room for _, room in limits)
        risk = loss_at_stop(qty, price, stop, self.costs)
        hold = Hold(symbol, "initial", qty * price, risk, allowance, money_cap)
        self.holds.setdefault(symbol, []).append(hold)
        return Verdict(qty, [], hold)

    def _money_rooms(self, symbol: str, pool: Pool, marks: dict[str, int]) -> list[tuple[str, int]]:
        a = self.account
        pool_percent = a.initial_pool_percent if pool == "initial" else a.add_pool_percent
        return [
            ("stock_cap", self.pct(a.stock_cap_percent) - self.exposure(symbol, marks)),
            (
                "sector_cap",
                self.pct(a.sector_cap_percent) - self.sector_exposure(self.sector(symbol), marks),
            ),
            (f"{pool}_pool", self.pct(pool_percent) - self.committed(pool)),
            ("cash_reserve", self.cash - self.committed() - self.pct(a.reserve_percent)),
        ]

    # ---- fills, refusals, closes ---------------------------------------------------------------

    def release(self, hold: Hold) -> None:
        holds = self.holds.get(hold.symbol, [])
        if hold in holds:
            holds.remove(hold)
        if not holds:
            self.holds.pop(hold.symbol, None)

    def fit(self, hold: Hold, stop: int, parts: Sequence[tuple[int, int]]) -> tuple[int, int]:
        """The most shares of a walked fill (`parts` = (shares, price) per level, cheapest first)
        that stay inside the hold's money and risk room at the real prices: (shares, value).
        (0, 0) = `invalid_at_fill`."""
        qty, value = 0, 0
        for level_qty, price in parts:
            low, high = 0, level_qty
            while low < high:  # the room shrinks as shares are added, so search each level
                mid = (low + high + 1) // 2
                if self._fits(qty + mid, value + mid * price, stop, hold):
                    low = mid
                else:
                    high = mid - 1
            qty, value = qty + low, value + low * price
            if low < level_qty:
                break
        return qty, value

    def _fits(self, qty: int, value: int, stop: int, hold: Hold) -> bool:
        return value <= hold.money_cap and loss_of(qty, value, stop, self.costs) <= hold.allowance

    def filled(self, hold: Hold, value: int, risk: int, first_buy: bool) -> None:
        hold.value, hold.risk, hold.filled = value, risk, True
        if first_buy:
            self.day.new_positions += 1

    def close(self, symbol: str, net: int, at_ms: int) -> None:
        """A position closed (fully): its capacity is free again; P&L, streak, cooldown follow."""
        self.holds.pop(symbol, None)
        self.cash += net
        self.day.realised += net
        if net < 0:
            self.day.streak += 1
        elif net > 0:
            self.day.streak = 0
        self.day.cooldown_until[symbol] = at_ms + self.account.cooldown_minutes * 60_000

    def daily_loss_hit(self, open_pnl: int) -> bool:
        """True the first time realised + open P&L reaches −`dailyLossPercent` today."""
        if self.day.shutdown:
            return False
        if self.day.realised + open_pnl <= -self.pct(self.account.daily_loss_percent):
            self.day.shutdown = True
            return True
        return False
