"""NOVA-116 (D62 (6)): estimated capital-gains tax on delivery runs."""

from datetime import date, datetime, time, timedelta

from nova_backtest.bars import IST
from nova_backtest.book import ClosedTrade
from nova_backtest.tax import estimate_tax, financial_year, year_tax
from nova_contracts import Charges

RUPEE = 100


def _trade(
    profit_rupees: int, bought: date, sold: date, stt: int = 0, other: int = 0
) -> ClosedTrade:
    """One share bought at ₹1,000; `profit_rupees` gross; charges = STT + other (paise)."""
    charges = Charges(
        brokerage_paise=other,
        stt_paise=stt,
        exchange_txn_paise=0,
        sebi_fee_paise=0,
        stamp_duty_paise=0,
        gst_paise=0,
        dp_paise=0,
        total_paise=stt + other,
    )
    entry = 1_000 * RUPEE
    return ClosedTrade(
        "INFY",
        1,
        datetime.combine(bought, time(10), tzinfo=IST),
        entry,
        datetime.combine(sold, time(10), tzinfo=IST),
        entry + profit_rupees * RUPEE,
        charges,
    )


def test_intraday_runs_get_no_estimate() -> None:
    trade = _trade(5_000, date(2025, 5, 2), date(2025, 5, 2))
    assert estimate_tax([trade], "equity_intraday") is None


def test_a_short_term_gain_pays_20_percent_plus_cess() -> None:
    estimate = estimate_tax([_trade(10_000, date(2025, 5, 1), date(2025, 6, 1))], "equity_delivery")
    assert estimate is not None and estimate.tax_paise == 208_000  # ₹10,000 × 20 % × 1.04


def test_a_400_day_winner_is_long_term() -> None:
    held = _trade(200_000, date(2024, 1, 1), date(2024, 1, 1) + timedelta(days=400))
    estimate = estimate_tax([held], "equity_delivery")
    # (₹2,00,000 − ₹1,25,000) × 12.5 % × 1.04 = ₹9,750.
    assert estimate is not None and estimate.tax_paise == 975_000


def test_a_long_term_gain_under_the_exemption_pays_nothing() -> None:
    held = _trade(100_000, date(2023, 4, 1), date(2024, 6, 1))
    estimate = estimate_tax([held], "equity_delivery")
    assert estimate is not None and estimate.tax_paise == 0


def test_a_short_term_loss_offsets_a_long_term_gain_in_the_same_year() -> None:
    gain = _trade(200_000, date(2023, 1, 2), date(2024, 6, 1))
    loss = _trade(-50_000, date(2024, 5, 1), date(2024, 7, 1))
    estimate = estimate_tax([gain, loss], "equity_delivery")
    # Long-term ₹1,50,000 left: (₹1,50,000 − ₹1,25,000) × 12.5 % × 1.04 = ₹3,250.
    assert estimate is not None and estimate.tax_paise == 325_000
    assert year_tax(short=10_000_00, long=-5_000_00) == 208_000  # a long-term loss cannot offset


def test_separate_years_do_not_offset_each_other() -> None:
    gain = _trade(10_000, date(2025, 3, 1), date(2025, 3, 20))  # FY 2024–25
    loss = _trade(-10_000, date(2025, 3, 25), date(2025, 4, 2))  # FY 2025–26
    estimate = estimate_tax([gain, loss], "equity_delivery")
    assert estimate is not None
    assert estimate.by_year == {2024: 208_000, 2025: 0}
    assert (financial_year(date(2025, 3, 31)), financial_year(date(2025, 4, 1))) == (2024, 2025)


def test_stt_is_not_deducted() -> None:
    trade = _trade(10_000, date(2025, 5, 1), date(2025, 6, 1), stt=100_000, other=100_000)
    estimate = estimate_tax([trade], "equity_delivery")
    # Gain = ₹10,000 − ₹1,000 other charges (the ₹1,000 STT stays in): ₹9,000 × 20 % × 1.04.
    assert estimate is not None and estimate.tax_paise == 187_200
