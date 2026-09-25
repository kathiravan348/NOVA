"""Indicator series by catalog name (D45, D51).

Settings are checked against `nova_contracts.indicators`; missing ones get the catalog defaults.
Every series has one value per bar, `None` until there are enough bars; values are rupee floats.
"""

from collections.abc import Callable, Sequence

from nova_contracts.indicators import BY_NAME, check_params

from nova_backtest.bars import Bar
from nova_backtest.indicators_core import (
    Series,
    atr,
    bollinger,
    ema,
    macd,
    rsi,
    sma,
    vwap,
)
from nova_backtest.indicators_momentum import cci, roc, stoch_d, stoch_k, stoch_rsi, williams_r
from nova_backtest.indicators_trend import (
    adx,
    macd_hist,
    macd_signal,
    minus_di,
    plus_di,
    psar,
    supertrend,
    wma,
)

__all__ = ["Series", "atr", "bollinger", "ema", "indicator", "rsi", "sma", "vwap"]


class Settings:
    """An indicator's settings with defaults filled in."""

    def __init__(self, values: dict[str, float]) -> None:
        self._values = values

    def whole(self, key: str) -> int:
        return int(self._values[key])

    def number(self, key: str) -> float:
        return self._values[key]


Compute = Callable[[Sequence[Bar], list[float], Settings], Series]

_DISPATCH: dict[str, Compute] = {
    "sma": lambda _, c, s: sma(c, s.whole("period")),
    "ema": lambda _, c, s: ema(c, s.whole("period")),
    "wma": lambda _, c, s: wma(c, s.whole("period")),
    "macd": lambda _, c, s: macd(c, s.whole("fast"), s.whole("slow")),
    "macd_signal": lambda _, c, s: macd_signal(
        c, s.whole("fast"), s.whole("slow"), s.whole("signal")
    ),
    "macd_hist": lambda _, c, s: macd_hist(c, s.whole("fast"), s.whole("slow"), s.whole("signal")),
    "supertrend": lambda b, _, s: supertrend(b, s.whole("period"), s.number("multiplier")),
    "adx": lambda b, _, s: adx(b, s.whole("period")),
    "plus_di": lambda b, _, s: plus_di(b, s.whole("period")),
    "minus_di": lambda b, _, s: minus_di(b, s.whole("period")),
    "psar": lambda b, _, s: psar(b, s.number("step"), s.number("max")),
    "rsi": lambda _, c, s: rsi(c, s.whole("period")),
    "stoch_k": lambda b, _, s: stoch_k(b, s.whole("period"), s.whole("smooth")),
    "stoch_d": lambda b, _, s: stoch_d(b, s.whole("period"), s.whole("smooth"), s.whole("signal")),
    "stoch_rsi": lambda _, c, s: stoch_rsi(c, s.whole("rsi_period"), s.whole("period")),
    "cci": lambda b, _, s: cci(b, s.whole("period")),
    "williams_r": lambda b, _, s: williams_r(b, s.whole("period")),
    "roc": lambda _, c, s: roc(c, s.whole("period")),
    "atr": lambda b, _, s: atr(b, s.whole("period")),
    "bb_upper": lambda _, c, s: bollinger(c, s.whole("period"), s.number("stddev"), upper=True),
    "bb_lower": lambda _, c, s: bollinger(c, s.whole("period"), s.number("stddev"), upper=False),
    "bb_middle": lambda _, c, s: sma(c, s.whole("period")),
    "vwap": lambda b, _, __: vwap(b),
}


def settings_for(name: str, params: dict[str, float]) -> Settings:
    """Checks `params` against the catalog (ValueError) and fills in the defaults."""
    check_params(name, params)
    return Settings(BY_NAME[name].defaults() | params)


def indicator(name: str, params: dict[str, float], bars: Sequence[Bar]) -> Series:
    settings = settings_for(name, params)
    compute = _DISPATCH.get(name)
    if compute is None:
        raise ValueError(f"{BY_NAME[name].label} is not available yet")
    return compute(bars, [bar.close / 100 for bar in bars], settings)
