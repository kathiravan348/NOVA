from datetime import UTC, datetime, timedelta

from intraday_factory import DAY, ms
from nova_backtest.intraday.gate import IndexGate, _bars_from_ticks
from nova_backtest.intraday.tick_data import MINUTE_MS, session_ms
from nova_contracts import default_research_settings
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session, sessionmaker

MARKET = default_research_settings().market  # NIFTY 50, 15 minutes, 0.3 % decline veto


def gate(prices: dict[str, int], **market: object) -> IndexGate:
    """An index day from (IST time → price) ticks."""
    ts = [ms(clock) for clock in prices]
    ltp = list(prices.values())
    settings = MARKET.model_copy(update=market)
    return IndexGate(
        settings,
        _bars_from_ticks(DAY, ts, ltp, MINUTE_MS),
        _bars_from_ticks(DAY, ts, ltp, 5 * MINUTE_MS),
        session_ms(DAY)[0],
    )


OPENING = {"09:15:10": 2_200_000, "09:20:10": 2_202_000, "09:29:50": 2_199_000}


def test_trend_gate_needs_a_close_above_the_opening_range_high() -> None:
    above = gate(OPENING | {"09:30:30": 2_202_100})
    at = gate(OPENING | {"09:30:30": 2_202_000})
    assert above.trend(ms("09:31:00")) is True
    assert at.trend(ms("09:31:00")) is False  # equal is not above
    assert above.trend(ms("09:30:40")) is False  # the 09:30 bar has not closed yet
    assert above.trend(ms("09:29:00")) is False  # the opening range is not complete


def test_range_gate_inside_the_range_and_the_decline_veto() -> None:
    calm = gate(OPENING | {"09:40:30": 2_200_500})
    assert calm.range(ms("09:41:00")) is True
    # 3 completed 5m bars from 09:25: open 22,010 → close 21,919.96 is −0.41 % (> 0.3 %)
    falling = gate(
        {"09:15:10": 2_200_000, "09:20:10": 2_210_000, "09:25:10": 2_201_000}
        | {"09:30:10": 2_196_000, "09:39:50": 2_191_996}
    )
    assert falling.declined(ms("09:40:00")) is True
    assert falling.range(ms("09:40:00")) is False
    outside = gate(OPENING | {"09:40:30": 2_210_000})
    assert outside.range(ms("09:41:00")) is False


def test_no_index_data_closes_the_gate_unless_it_is_off() -> None:
    none = IndexGate(MARKET, None, None, session_ms(DAY)[0])
    assert none.trend(ms("10:00:00")) is False and none.range(ms("10:00:00")) is False
    off = IndexGate(MARKET.model_copy(update={"market_gate": False}), None, None, 0)
    assert off.trend(ms("10:00:00")) is True and off.range(ms("10:00:00")) is True


def test_recorded_index_ticks_first_then_kite_candles_listed(
    factory: sessionmaker[Session], clean: Engine
) -> None:
    with factory() as db:
        db.execute(text("DELETE FROM index_ticks"))
        empty, used = IndexGate.load(db, MARKET, DAY)
        assert (empty.bars1, used) == (None, None)
        open_ = datetime.fromtimestamp(session_ms(DAY)[0] / 1000, UTC)
        for minute in range(20):
            db.execute(
                text(
                    "INSERT INTO candles (exchange, symbol, timeframe, ts, open_paise, high_paise,"
                    " low_paise, close_paise, volume) VALUES ('NSE', 'NIFTY 50', '1m', :ts, :p,"
                    " :h, :l, :p, 0)"
                ),
                {
                    "ts": open_ + timedelta(minutes=minute),
                    "p": 2_200_000,
                    "h": 2_201_000,
                    "l": 2_199_000,
                },
            )
        fallback, used = IndexGate.load(db, MARKET, DAY)
        assert used == "index:2026-10-01" and fallback.bars1 is not None
        assert len(fallback.bars1) == 20 and int(fallback.bars1.high.max()) == 2_201_000
        for second in range(0, 1_200, 30):
            moment = open_ + timedelta(seconds=second)
            db.execute(
                text(
                    "INSERT INTO index_ticks (symbol, received_at, exchange_ts, last_price_paise)"
                    " VALUES ('NIFTY 50', :at, :at, :p)"
                ),
                {"at": moment, "p": 2_200_000 + second},
            )
        recorded, used = IndexGate.load(db, MARKET, DAY)
        assert used is None and recorded.bars1 is not None and len(recorded.bars1) == 20
        assert recorded.trend(ms("09:35:00")) is True  # 09:34 close 22,011.70 > OR high 22,008.70
        db.rollback()
