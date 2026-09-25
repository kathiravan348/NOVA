from datetime import UTC, datetime, timedelta

import pytest
from nova_backtest.bars import Bar
from nova_backtest.indicators import indicator
from nova_backtest.indicators_momentum import cci, roc, stoch_d, stoch_k, stoch_rsi, williams_r

T0 = datetime(2026, 9, 1, 4, 0, tzinfo=UTC)


def _p(rupees: float) -> int:
    return round(rupees * 100)


def _bars(*hlc: tuple[float, float, float]) -> list[Bar]:
    return [
        Bar(
            T0 + timedelta(days=i),
            round(c * 100),
            round(h * 100),
            round(low * 100),
            round(c * 100),
            100,
        )
        for i, (h, low, c) in enumerate(hlc)
    ]


HLC = ((10, 8, 9), (11, 9, 10), (12, 10, 11), (12, 9, 9), (13, 11, 12))


def test_stochastic_k_and_d() -> None:
    # raw %K(3): bar 2 (11 − 8)/(12 − 8) = 75; bar 3 (9 − 9)/(12 − 9) = 0;
    # bar 4 (12 − 9)/(13 − 9) = 75
    # %K smooth 2: 37.5, 37.5; %D signal 2: 37.5
    bars = _bars(*HLC)

    assert stoch_k(bars, 3, 1) == [None, None, 75, 0, 75]
    assert stoch_k(bars, 3, 2) == [None, None, None, 37.5, 37.5]
    assert stoch_d(bars, 3, 2, 2) == [None, None, None, None, 37.5]
    assert stoch_k(_bars(*[(5, 5, 5)] * 3), 3, 1)[2] == 50  # flat range


def test_stochastic_rsi() -> None:
    # RSI(2) of 1,2,1,2,1,2 = −, −, 50, 75, 37.5, 68.75
    # bar 4: 37.5 in [37.5, 75] → 0; bar 5: (68.75 − 37.5)/(75 − 37.5) = 83.33
    assert stoch_rsi([1, 2, 1, 2, 1, 2], 2, 3) == pytest.approx(
        [None, None, None, None, 0, 250 / 3]
    )


def test_cci() -> None:
    # TP = close (no range): bar 2 mean 2, mean deviation 2/3 → (3 − 2)/(0.015 · 2/3) = 100
    bars = _bars(*[(c, c, c) for c in (1, 2, 3, 4)])

    assert cci(bars, 3) == pytest.approx([None, None, 100, 100])
    assert cci(_bars(*[(5, 5, 5)] * 3), 3)[2] == 0


def test_williams_r() -> None:
    # bar 1: HH 11, LL 8, close 10 → −100 · 1/3
    assert williams_r(_bars(*HLC), 2)[:2] == pytest.approx([None, -100 / 3])
    assert williams_r(_bars(*[(5, 5, 5)] * 2), 2)[1] == -50


def test_rate_of_change() -> None:
    # 100 · (121/100 − 1) = 21
    assert roc([100, 110, 121], 2) == pytest.approx([None, None, 21])


@pytest.mark.parametrize(
    ("name", "first"),
    [
        ("stoch_k", 15),
        ("stoch_d", 17),
        ("stoch_rsi", 27),
        ("cci", 19),
        ("williams_r", 13),
        ("roc", 12),
    ],
)
def test_none_prefix_with_defaults(name: str, first: int) -> None:
    bars = _bars(*[(100 + i % 7 + 1, 100 + i % 7 - 1, 100 + i % 7) for i in range(60)])

    values = indicator(name, {}, bars)

    assert len(values) == 60
    assert all(v is None for v in values[:first])
    assert all(v is not None for v in values[first:])
