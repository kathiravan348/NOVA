from datetime import date

import pytest
from nova_db.models import ChargeRate
from nova_ledger import rates_for, trade_charges
from sqlalchemy.orm import Session


def test_seeded_rates_reproduce_the_worked_example(session: Session) -> None:
    rates = rates_for(session, "equity_delivery", date(2026, 9, 25))

    assert trade_charges(rates, "buy", 100, 100_000, 110_000).total_paise == 24_795


def test_the_newest_row_effective_on_the_day_wins(session: Session) -> None:
    newer = rates_for(session, "equity_delivery", date(2026, 1, 1)).model_dump(mode="json")
    session.add(
        ChargeRate(
            id="rate_test_2026",
            segment="equity_delivery",
            effective_from=date(2026, 4, 1),
            rates=newer | {"dp_per_sell_paise": "1500"},
            source="test",
        )
    )
    session.flush()

    assert rates_for(session, "equity_delivery", date(2026, 3, 31)).dp_per_sell_paise == 1300
    assert rates_for(session, "equity_delivery", date(2026, 4, 1)).dp_per_sell_paise == 1500


def test_no_rates_before_the_first_row(session: Session) -> None:
    with pytest.raises(LookupError, match="futures"):
        rates_for(session, "futures", date(2026, 1, 1))
    with pytest.raises(LookupError):
        rates_for(session, "equity_delivery", date(2020, 1, 1))
