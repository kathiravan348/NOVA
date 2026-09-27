"""NOVA-116 (D62 (6)): the year-by-year table and the benchmark curve."""

from datetime import date, timedelta

from nova_backtest.benchmark import benchmark_curve
from nova_backtest.years import blocks, year_rows


def test_blocks_are_12_months_from_the_start_and_the_last_may_be_short() -> None:
    five = blocks(date(2021, 10, 1), date(2026, 9, 30))
    assert len(five) == 5
    assert five[0] == (date(2021, 10, 1), date(2022, 9, 30))
    assert five[-1] == (date(2025, 10, 1), date(2026, 9, 30))
    months_26 = blocks(date(2024, 1, 15), date(2026, 3, 14))
    assert len(months_26) == 3 and months_26[-1] == (date(2026, 1, 15), date(2026, 3, 14))


def test_profits_add_up_and_drawdown_is_per_block() -> None:
    first = date(2024, 1, 1)
    equity = [
        (first + timedelta(days=10), 1_100),
        (first + timedelta(days=200), 900),  # −18.18 % from the 1,100 peak
        (first + timedelta(days=380), 1_000),  # year 2: starts at 900
        (first + timedelta(days=500), 1_200),
    ]
    rows = year_rows(equity, [None] * 4, 1_000, first, date(2025, 12, 31))

    assert [(r["year"], r["profit_paise"]) for r in rows] == [(1, -100), (2, 300)]
    assert sum(r["profit_paise"] for r in rows) == 1_200 - 1_000
    assert rows[0]["max_drawdown_percent"] == round((900 - 1_100) * 100 / 1_100, 4)
    assert rows[1]["max_drawdown_percent"] == 0.0  # the peak starts at 900
    assert rows[1]["return_percent"] == round((1_200 / 900 - 1) * 100, 4)
    assert all(r["benchmark_percent"] is None for r in rows)


def test_a_block_without_equity_points_keeps_the_last_value() -> None:
    rows = year_rows(
        [(date(2024, 2, 1), 1_050)], [1_020], 1_000, date(2024, 1, 1), date(2025, 6, 1)
    )

    assert [r["profit_paise"] for r in rows] == [50, 0]
    assert rows[0]["benchmark_percent"] == 2.0 and rows[1]["benchmark_percent"] is None


def test_the_benchmark_starts_at_the_initial_capital() -> None:
    closes = [(date(2024, 1, 2), 20_000_00), (date(2024, 1, 3), 21_000_00)]
    dates = [date(2024, 1, 1), date(2024, 1, 2), date(2024, 1, 3), date(2024, 1, 4)]

    assert benchmark_curve(closes, dates, 1_000_000) == [None, 1_000_000, 1_050_000, 1_050_000]
    assert benchmark_curve([], dates, 1_000_000) == [None] * 4
