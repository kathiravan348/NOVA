"""Estimated capital-gains tax on a delivery run (D62 (6)), at today's rates for every year.

Trades are grouped by the Indian financial year (1 Apr – 31 Mar) of their exit. A gain is the
gross profit less the charges, except STT, which cannot be deducted. A trade held more than
365 days from its first buy is long-term. In a year, short-term losses offset long-term gains,
long-term losses offset only long-term gains, and nothing carries forward. Tax = (short-term ×
20 % + (long-term − ₹1,25,000, not below 0) × 12.5 %) × 1.04 cess, half-up paise per year.
Intraday runs get no estimate: that is business income, taxed at slab rates.
"""

from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from nova_backtest.bars import IST
from nova_backtest.book import ClosedTrade

SHORT_RATE = Decimal("0.20")
LONG_RATE = Decimal("0.125")
LONG_EXEMPT_PAISE = 12_500_000  # ₹1,25,000 per financial year
CESS = Decimal("1.04")
LONG_TERM_DAYS = 365


@dataclass(frozen=True)
class TaxEstimate:
    tax_paise: int
    by_year: dict[int, int]  # financial year (its starting calendar year) → tax paise


def financial_year(day: date) -> int:
    """2025 for 1 Apr 2025 – 31 Mar 2026."""
    return day.year if day.month >= 4 else day.year - 1


def taxable_gain(trade: ClosedTrade) -> int:
    return trade.gross - (trade.charges.total_paise - trade.charges.stt_paise)


def is_long_term(trade: ClosedTrade) -> bool:
    held = trade.exit_at.astimezone(IST).date() - trade.entry_at.astimezone(IST).date()
    return held.days > LONG_TERM_DAYS


def year_tax(short: int, long: int) -> int:
    """One financial year's tax from its net short-term and long-term gains (paise)."""
    if short < 0:
        long += short  # a short-term loss also offsets long-term gains
        short = 0
    taxable_long = max(long - LONG_EXEMPT_PAISE, 0)
    value = (Decimal(short) * SHORT_RATE + Decimal(taxable_long) * LONG_RATE) * CESS
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def estimate_tax(trades: Sequence[ClosedTrade], segment: str) -> TaxEstimate | None:
    if segment != "equity_delivery":
        return None
    gains: dict[int, list[int]] = defaultdict(lambda: [0, 0])  # year → [short, long]
    for trade in trades:
        year = financial_year(trade.exit_at.astimezone(IST).date())
        gains[year][1 if is_long_term(trade) else 0] += taxable_gain(trade)
    by_year = {year: year_tax(short, long) for year, (short, long) in sorted(gains.items())}
    return TaxEstimate(tax_paise=sum(by_year.values()), by_year=by_year)
