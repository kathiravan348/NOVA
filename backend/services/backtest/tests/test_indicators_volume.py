from datetime import UTC, datetime, timedelta

import pytest
from nova_backtest.bars import Bar
from nova_backtest.indicators_volume import mfi, obv, volume_sma

T0 = datetime(2026, 9, 1, 4, 0, tzinfo=UTC)


def _bars(*cv: tuple[float, int]) -> list[Bar]:
    """Bars from (close, volume) with no range: typical price = close."""
    bars = []
    for i, (close, volume) in enumerate(cv):
        paise = round(close * 100)
        bars.append(Bar(T0 + timedelta(days=i), paise, paise, paise, paise, volume))
    return bars


def test_obv_adds_on_up_closes_and_subtracts_on_down_closes() -> None:
    # 0; up +200; down −300; unchanged; up +50
    bars = _bars((10, 100), (11, 200), (10, 300), (10, 400), (12, 50))

    assert obv(bars) == [0, 200, -100, -100, -50]


def test_money_flow_index() -> None:
    # flows 11·200 = 2200 (up), 10·300 = 3000 (down), 12·100 = 1200 (up)
    # bar 2 (period 2): 100 − 100/(1 + 2200/3000) = 42.31; bar 3: 100 − 100/(1 + 1200/3000) = 28.57
    bars = _bars((10, 100), (11, 200), (10, 300), (12, 100))

    expected = [None, None, 100 - 100 / (1 + 2200 / 3000), 100 - 100 / 1.4]
    assert mfi(bars, 2) == pytest.approx(expected)
    assert mfi(_bars((10, 1), (11, 1), (12, 1)), 2)[2] == 100  # no negative flow


def test_volume_sma() -> None:
    assert volume_sma(_bars((1, 100), (1, 200), (1, 600)), 3) == [None, None, 300.0]
