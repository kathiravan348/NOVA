"""Indicator catalog (D51): mirrors `frontend/packages/contracts/src/indicators.ts`."""

from dataclasses import dataclass
from typing import Literal

IndicatorGroup = Literal["trend", "momentum", "volatility", "volume", "levels"]
IndicatorName = Literal[
    "sma",
    "ema",
    "wma",
    "macd",
    "macd_signal",
    "macd_hist",
    "supertrend",
    "adx",
    "plus_di",
    "minus_di",
    "psar",
    "rsi",
    "stoch_k",
    "stoch_d",
    "stoch_rsi",
    "cci",
    "williams_r",
    "roc",
    "atr",
    "bb_upper",
    "bb_middle",
    "bb_lower",
    "keltner_upper",
    "keltner_lower",
    "donchian_upper",
    "donchian_lower",
    "vwap",
    "obv",
    "mfi",
    "volume_sma",
    "prev_day_high",
    "prev_day_low",
    "prev_day_close",
    "pivot",
    "pivot_r1",
    "pivot_s1",
    "pivot_r2",
    "pivot_s2",
]


@dataclass(frozen=True)
class IndicatorParam:
    key: str
    label: str
    default: float
    integer: bool  # whole number >= 1 when true; any number > 0 when false


@dataclass(frozen=True)
class Indicator:
    name: str
    label: str
    group: IndicatorGroup
    params: tuple[IndicatorParam, ...]

    def param(self, key: str) -> IndicatorParam | None:
        return next((p for p in self.params if p.key == key), None)

    def defaults(self) -> dict[str, float]:
        return {p.key: p.default for p in self.params}


def _int(key: str, label: str, default: int) -> IndicatorParam:
    return IndicatorParam(key, label, default, True)


def _dec(key: str, label: str, default: float) -> IndicatorParam:
    return IndicatorParam(key, label, default, False)


INDICATORS: tuple[Indicator, ...] = (
    # Trend
    Indicator("sma", "SMA", "trend", (_int("period", "Period", 20),)),
    Indicator("ema", "EMA", "trend", (_int("period", "Period", 20),)),
    Indicator("wma", "WMA", "trend", (_int("period", "Period", 20),)),
    Indicator("macd", "MACD line", "trend", (_int("fast", "Fast", 12), _int("slow", "Slow", 26))),
    Indicator(
        "macd_signal",
        "MACD signal",
        "trend",
        (_int("fast", "Fast", 12), _int("slow", "Slow", 26), _int("signal", "Signal", 9)),
    ),
    Indicator(
        "macd_hist",
        "MACD histogram",
        "trend",
        (_int("fast", "Fast", 12), _int("slow", "Slow", 26), _int("signal", "Signal", 9)),
    ),
    Indicator(
        "supertrend",
        "SuperTrend",
        "trend",
        (_int("period", "Period", 10), _dec("multiplier", "Multiplier", 3.0)),
    ),
    Indicator("adx", "ADX", "trend", (_int("period", "Period", 14),)),
    Indicator("plus_di", "+DI", "trend", (_int("period", "Period", 14),)),
    Indicator("minus_di", "−DI", "trend", (_int("period", "Period", 14),)),
    Indicator(
        "psar", "Parabolic SAR", "trend", (_dec("step", "Step", 0.02), _dec("max", "Max", 0.2))
    ),
    # Momentum
    Indicator("rsi", "RSI", "momentum", (_int("period", "Period", 14),)),
    Indicator(
        "stoch_k",
        "Stochastic %K",
        "momentum",
        (_int("period", "Period", 14), _int("smooth", "Smooth", 3)),
    ),
    Indicator(
        "stoch_d",
        "Stochastic %D",
        "momentum",
        (_int("period", "Period", 14), _int("smooth", "Smooth", 3), _int("signal", "Signal", 3)),
    ),
    Indicator(
        "stoch_rsi",
        "Stochastic RSI",
        "momentum",
        (_int("rsi_period", "RSI period", 14), _int("period", "Period", 14)),
    ),
    Indicator("cci", "CCI", "momentum", (_int("period", "Period", 20),)),
    Indicator("williams_r", "Williams %R", "momentum", (_int("period", "Period", 14),)),
    Indicator("roc", "Rate of change %", "momentum", (_int("period", "Period", 12),)),
    # Volatility
    Indicator("atr", "ATR", "volatility", (_int("period", "Period", 14),)),
    Indicator(
        "bb_upper",
        "Bollinger upper",
        "volatility",
        (_int("period", "Period", 20), _dec("stddev", "Std dev", 2.0)),
    ),
    Indicator(
        "bb_middle",
        "Bollinger middle",
        "volatility",
        (_int("period", "Period", 20), _dec("stddev", "Std dev", 2.0)),
    ),
    Indicator(
        "bb_lower",
        "Bollinger lower",
        "volatility",
        (_int("period", "Period", 20), _dec("stddev", "Std dev", 2.0)),
    ),
    Indicator(
        "keltner_upper",
        "Keltner upper",
        "volatility",
        (
            _int("period", "Period", 20),
            _dec("multiplier", "Multiplier", 2.0),
            _int("atr_period", "ATR period", 10),
        ),
    ),
    Indicator(
        "keltner_lower",
        "Keltner lower",
        "volatility",
        (
            _int("period", "Period", 20),
            _dec("multiplier", "Multiplier", 2.0),
            _int("atr_period", "ATR period", 10),
        ),
    ),
    Indicator("donchian_upper", "Highest high", "volatility", (_int("period", "Period", 20),)),
    Indicator("donchian_lower", "Lowest low", "volatility", (_int("period", "Period", 20),)),
    # Volume
    Indicator("vwap", "VWAP", "volume", ()),
    Indicator("obv", "OBV", "volume", ()),
    Indicator("mfi", "MFI", "volume", (_int("period", "Period", 14),)),
    Indicator("volume_sma", "Volume SMA", "volume", (_int("period", "Period", 20),)),
    # Levels
    Indicator("prev_day_high", "Previous day high", "levels", ()),
    Indicator("prev_day_low", "Previous day low", "levels", ()),
    Indicator("prev_day_close", "Previous day close", "levels", ()),
    Indicator("pivot", "Pivot", "levels", ()),
    Indicator("pivot_r1", "Pivot R1", "levels", ()),
    Indicator("pivot_s1", "Pivot S1", "levels", ()),
    Indicator("pivot_r2", "Pivot R2", "levels", ()),
    Indicator("pivot_s2", "Pivot S2", "levels", ()),
)
BY_NAME: dict[str, Indicator] = {i.name: i for i in INDICATORS}


def param_problems(name: str, params: dict[str, float]) -> list[str]:
    """Same rules as TypeScript `checkIndicatorParams`. Missing keys are fine (defaults apply)."""
    indicator = BY_NAME.get(name)
    if indicator is None:
        return [f"Unknown indicator '{name}'"]
    problems: list[str] = []
    for key, value in params.items():
        param = indicator.param(key)
        if param is None:
            problems.append(f"Unknown setting '{key}' for {indicator.label}")
        elif param.integer and (value != int(value) or value < 1):
            problems.append(
                f"{indicator.label} {param.label.lower()} must be a whole number of at least 1"
            )
        elif not param.integer and not value > 0:
            problems.append(f"{indicator.label} {param.label.lower()} must be above 0")
    defaults = indicator.defaults()
    fast, slow = params.get("fast", defaults.get("fast")), params.get("slow", defaults.get("slow"))
    if fast is not None and slow is not None and fast >= slow:
        problems.append(f"{indicator.label} fast must be less than slow")
    return problems


def check_params(name: str, params: dict[str, float]) -> None:
    """Raises `ValueError` with every problem joined; used by write bodies and the engine."""
    problems = param_problems(name, params)
    if problems:
        raise ValueError("; ".join(problems))
