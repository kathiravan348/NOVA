"""Bid/ask fills from recorded quotes (D82 (5))."""

from datetime import UTC, datetime
from pathlib import Path

import numpy as np
from nova_backtest.quotes import QuoteBook, TickQuotes

# 09:16:00 IST on 1 Oct 2026 and the next day's open.
T0 = int(datetime(2026, 10, 1, 3, 46, tzinfo=UTC).timestamp())
NEXT_DAY = int(datetime(2026, 10, 2, 3, 45, tzinfo=UTC).timestamp())


def book(tmp_path: Path) -> QuoteBook:
    quotes = TickQuotes(
        ts=np.array([T0 + 2, T0 + 2, T0 + 20, T0 + 70, NEXT_DAY], dtype=np.int64),
        ltp=np.array([10_000, 10_010, 9_900, 10_100, 11_000], dtype=np.int64),
        bid=np.array([9_995, 10_005, 0, 10_095, 10_990], dtype=np.int64),
        ask=np.array([10_005, 10_015, 0, 10_105, 11_010], dtype=np.int64),
    )
    quote_book = QuoteBook(tmp_path / "quotes", width=60)
    quote_book.add("INFY", quotes)
    return quote_book


def test_the_first_tick_at_or_after_the_moment_gives_ask_or_bid(tmp_path: Path) -> None:
    quotes = book(tmp_path)
    buy = quotes.at("INFY", T0, "buy")
    sell = quotes.at("INFY", T0, "sell")
    assert buy is not None and (buy.price, buy.ltp) == (10_005, 10_000)
    assert sell is not None and (sell.price, sell.ltp) == (9_995, 10_000)
    later = quotes.at("INFY", T0 + 3, "buy")
    assert later is not None and later.price == 9_900  # no depth: the last price


def test_a_tick_on_the_next_day_is_never_used(tmp_path: Path) -> None:
    quotes = book(tmp_path)
    assert quotes.at("INFY", T0 + 71, "sell") is None
    assert quotes.at("TCS", T0, "buy") is None


def test_cross_finds_the_first_tick_in_the_bar_past_the_level(tmp_path: Path) -> None:
    quotes = book(tmp_path)
    stop = quotes.cross("INFY", T0, 9_950, below=True, side="sell")
    assert stop is not None and (stop.price, stop.ltp) == (9_900, 9_900)  # zero bid → last price
    target = quotes.cross("INFY", T0 + 60, 10_050, below=False, side="sell")
    assert target is not None and (target.price, target.ltp) == (10_095, 10_100)
    assert quotes.cross("INFY", T0, 9_000, below=True, side="sell") is None
    quotes.close()
