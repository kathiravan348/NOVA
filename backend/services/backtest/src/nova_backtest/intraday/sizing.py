"""Risk sizing (D84, `docs/INTRADAY-RESEARCH.md` §2 `riskPerPositionPercent`, §5.5).

The quantity is the largest whole number of shares whose loss if the stop is hit — shares × (entry −
stop) plus the real charges of buying at the entry and selling at the stop for that many shares —
fits the risk allowance. Charges are not a constant per share (brokerage has a per-order cap), so
the quantity is searched, not divided out. Money in integer paise.
"""

from collections.abc import Callable

# (value bought, value sold at the stop) in paise → charges of that buy and that sell, in paise.
CostToClose = Callable[[int, int], int]


def loss_at_stop(qty: int, entry: int, stop: int, costs: CostToClose) -> int:
    return qty * (entry - stop) + (costs(qty * entry, qty * stop) if qty > 0 else 0)


def loss_of(qty: int, value: int, stop: int, costs: CostToClose) -> int:
    """Loss at the stop of `qty` shares bought for `value` paise in all."""
    return value - qty * stop + (costs(value, qty * stop) if qty > 0 else 0)


def risk_qty(entry: int, stop: int, allowance: int, costs: CostToClose) -> int:
    """Largest quantity whose loss at the stop (charges included) is at most `allowance`."""
    per_share = entry - stop
    if per_share <= 0 or allowance <= 0:
        return 0
    high = allowance // per_share  # charges only lower it
    low = 0
    while low < high:
        mid = (low + high + 1) // 2
        if loss_at_stop(mid, entry, stop, costs) <= allowance:
            low = mid
        else:
            high = mid - 1
    return low


def money_qty(price: int, room: int) -> int:
    """Shares a money limit with `room` paise left allows at `price`."""
    return max(room, 0) // price if price > 0 else 0
